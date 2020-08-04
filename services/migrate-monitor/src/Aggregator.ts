import { MetricReporter, Metric } from './types';
import { CloudWatch } from 'aws-sdk';
import Counter from './Counter';

/**
 * This class is the central store of metrics for a given migration run.
 */
class Aggregator {
  /**
   * Counts the number of messages received by this daemon during its execution.
   */
  private messages = new Counter('Message');

  /**
   * Used for the migration dimension.
   */
  private migration: string | undefined = undefined;

  /**
   * Metric: Times taken for each import task.
   */
  private importTimes: number[] = [];

  /**
   * Counts the number of imports processed by Drush.
   */
  private imports = new Counter('Import');

  /**
   * Reporting function used to send metric batches to CloudWatch.
   */
  private reporter: MetricReporter;

  constructor(reporter: MetricReporter) {
    this.reporter = reporter;
  }

  /**
   * Submit internal metrics to CloudWatch. These metrics are counters related to this
   * daemon's functions, rather than migrate-related metrics.
   *
   * As a side effect of calling this method, the `messages` counter is reset.
   *
   * @param timestamp The timestamp covering this metric.
   */
  private flushInternalMetrics(timestamp: Date) {
    const metrics = [this.messages.getMetric()];

    this.messages.reset();

    return this.reporter('EPA/MigrationMonitor', timestamp, metrics);
  }

  /**
   * Submit external metrics to CloudWatch. These metrics are counters and times related
   * to Drupal's migrate module.
   *
   * As a side effect of calling this method, the `imports` and `importTimes` metrics are
   * reset.
   *
   * @param timestamp The timestamp covering this metric.
   */
  private flushExternalMetrics(timestamp: Date) {
    const dimensions: CloudWatch.Dimension[] = [];
    if (this.migration === undefined) {
      console.warn('Flushing migration metrics with no migration name');
    } else {
      dimensions.push({
        Name: 'MigrationName',
        Value: this.migration,
      });
    }

    const metrics: Metric[] = [
      this.imports.getMetric(dimensions),
      {
        name: 'ImportTime',
        dimensions,
        unit: 'Seconds',
        value: this.importTimes.map(value => ({
          value,
          count: 1,
        })),
      },
    ];

    this.imports.reset();
    this.importTimes = [];

    return this.reporter('EPA/DrupalMigrate', timestamp, metrics);
  }

  /**
   * Sends all metrics to CloudWatch.
   *
   * As a result of calling this method, all metrics are reset. This allows accurate
   * per-minute reporting in CloudWatch's dashboard and alarm functionality.
   */
  flushMetrics(): Promise<void> {
    const timestamp = new Date();

    const internal = this.flushInternalMetrics(timestamp).then(
      () => true,
      error => {
        console.error(`Failed to flush internal metrics: ${error}`);
        return false;
      },
    );

    const external = this.flushExternalMetrics(timestamp).then(
      () => true,
      error => {
        console.error(`Failed to flush external metrics: ${error}`);
        return false;
      },
    );

    return Promise.all([internal, external]).then(
      ([internalSuccess, externalSuccess]) => {
        if (internalSuccess && externalSuccess) {
          console.log('Sent metrics to CloudWatch');
        } else if (internalSuccess || externalSuccess) {
          console.warn('Sent partial metrics to CloudWatch');
        } else {
          console.error(
            'Failed to send metrics to CloudWatch. Data points for this period will be missing.',
          );
        }
      },
    );
  }

  /**
   * Increments the count of failed messages.
   */
  countMessageFailure(): void {
    this.messages.countFailure();
  }

  /**
   * Increments the count of successful messages.
   */
  countMessageSuccess(): void {
    this.messages.countFailure();
  }

  /**
   * Logs a migration event.
   *
   * @param time The amount of time the entity import took.
   * @param success Was the import a success?
   */
  countMigration(time: number, success: boolean): void {
    this.importTimes.push(time);

    if (success) {
      this.imports.countSuccess();
    } else {
      this.imports.countFailure();
    }
  }

  /**
   * Updates the migration name. This is reflected in CloudWatch as a dimension
   */
  setMigrationName(name: string): void {
    this.migration = name;
  }
}

export default Aggregator;

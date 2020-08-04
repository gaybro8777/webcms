import { CloudWatch } from 'aws-sdk';

import Counter from './Counter';
import logger from './logger';
import { MetricReporter, Metric } from './types';

/**
 * This class is the central store of metrics for a given migration run.
 *
 * An `Aggregator` instance is responsible for client-side metrics aggregation. It is used
 * mainly to report on Drush migration-related metrics, but also self-reports a few values
 * for performance turning.
 *
 * See the public methods for points of interest, beginning with the `flushMetrics`
 * method.
 */
class Aggregator {
  /**
   * Tracks the previous CPU usage. This lets us report per-minute CPU activity to
   * CloudWatch.
   */
  private lastUsage: NodeJS.CpuUsage;

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

  /**
   * Creates a new metrics aggregator.
   *
   * @param reporter The metric reporter to use for this instance.
   */
  constructor(reporter: MetricReporter) {
    this.lastUsage = process.cpuUsage();
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
    const usage = process.cpuUsage(this.lastUsage);

    // What we're reporting, and why:
    // 1. Messages-related metrics.
    //    Why: If we see anything other than successes, then it means that Drush isn't
    //    doing something right (or we're seeing lower-level issues, like exceeing the 64k
    //    max UDP packet size).
    //
    // 2. User CPU usage (in μs)
    //    Why: It's how much time we're spending processing data. If it gets high, then we
    //    need to do some perf tuning.
    //
    // 3. System CPU usage (also in μs)
    //    Why: High system CPU means we're asking the kernel to do a lot of work on our
    //    behalf. This is likely to be higher than user CPU in most cases since we're doing
    //    a lot of network I/O, but if it's very high, then it could mean too much work
    //    spent resizing memory or we're otherwise overtaxing the system.
    //
    // 4. Memory usage (bytes) - RSS is short for "Resident Set Size" and is the amount of
    //    non-swap memory committed to the Node.js process.
    //    Why: We want to keep an eye on this in order to tune the ECS task's memory
    //    limits.
    const metrics: Metric[] = [
      this.messages.getMetric(),
      {
        name: 'UserCPU',
        dimensions: [],
        unit: 'Microseconds',
        value: usage.user,
      },
      {
        name: 'SystemCPU',
        dimensions: [],
        unit: 'Microseconds',
        value: usage.system,
      },
      {
        name: 'MemoryUsage',
        dimensions: [],
        unit: 'Bytes',
        // cf. https://nodejs.org/dist/latest-v12.x/docs/api/process.html#process_process_memoryusage
        value: process.memoryUsage().rss,
      },
    ];

    this.lastUsage = usage;
    this.messages.reset();

    return this.reporter('EPA/MigrationMonitor', timestamp, metrics);
  }

  /**
   * Submit external metrics to CloudWatch. These metrics are counters and times related
   * to Drupal's migrate module, as reported to this daemon by the Drush container.
   *
   * As a side effect of calling this method, the `imports` and `importTimes` metrics are
   * reset.
   *
   * @param timestamp The timestamp covering this metric.
   */
  private flushExternalMetrics(timestamp: Date) {
    const dimensions: CloudWatch.Dimension[] = [];
    if (this.migration === undefined) {
      logger.warn('Flushing migration metrics with no migration name');
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
   * All metrics and counters are reset when this method is called. This enables accurate
   * per-period reporting in CloudWatch. The main use case is to enable alarm
   * notifications based on encountring multiple zero values over a time period
   * (indicating a stalled migration process).
   *
   * The promise returned by this method never rejects. All exceptions are captured and
   * logged centrally.
   */
  async flushMetrics(): Promise<void> {
    const timestamp = new Date();

    // The return value of this promise is a boolean indicating success/failure - it's
    // used later in our logging message when we wait on all of the metric flush tasks.
    const internal = this.flushInternalMetrics(timestamp).then(
      () => true,
      error => {
        logger.error(`Failed to flush internal metrics: ${error}`);
        return false;
      },
    );

    // See above for the boolean values here.
    const external = this.flushExternalMetrics(timestamp).then(
      () => true,
      error => {
        logger.error(`Failed to flush external metrics: ${error}`);
        return false;
      },
    );

    // Wait on the metrics to be flushed and report success/failure as appropriate.
    return Promise.all([internal, external]).then(successes => {
      // Was every flush a success?
      const allSuccesses = successes.every(Boolean);

      // Was there at least one success?
      const someSuccesses = successes.some(Boolean);

      if (allSuccesses) {
        logger.log('Sent metrics to CloudWatch');
      } else if (someSuccesses) {
        logger.warn('Sent partial metrics to CloudWatch');
      } else {
        logger.error(
          'Failed to send metrics to CloudWatch. Data points for this period will be missing.',
        );
      }
    });
  }

  /**
   * Increments the count of UDP packets were not successfully handled.
   */
  countMessageFailure(): void {
    this.messages.countFailure();
  }

  /**
   * Increments the count of UDP packets successfully handled.
   */
  countMessageSuccess(): void {
    this.messages.countFailure();
  }

  /**
   * Records metrics for a migrated Drupal entity.
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
   * Updates the migration name. The migration's name is used by CloudWatch as a
   * dimension, enabling finer-grained views of timing across different migrations.
   */
  setMigrationName(name: string): void {
    this.migration = name;
  }
}

export default Aggregator;

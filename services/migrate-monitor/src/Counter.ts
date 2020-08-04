import { Metric } from './types';
import { CloudWatch } from 'aws-sdk';

/**
 * A `Counter` instance counts the number of occurrences of a specific event.
 *
 * It uses a standard CloudWatch idiom to publish three logical values in a single metric.
 *
 * The metric `<name>Successes` is published to CloudWatch with a pair of statistics. The
 * number of zeroes indicates how many failures occurred, and the number of ones indicates
 * how many successes occured. Thus, we can derive the total, successful, and failed
 * counts as follows:
 * 1. The total number of events is SampleCount(metric).
 * 2. The number of successful events is Sum(metric).
 * 3. The number of failures is SampleCount(metric) - Sum(metric).
 */
class Counter {
  /**
   * Name of the metric this counter tracks.
   */
  private name: string;

  /**
   * The total number of events seen by this counter.
   */
  private total = 0;

  /**
   * The number of failed events seen by this counter.
   */
  private failed = 0;

  /**
   * Creates a new counter.
   *
   * @param name The name of this metric. The suffix `"Successes"` will be added
   * automatically.
   */
  constructor(name: string) {
    this.name = `${name}Successes`;
  }

  /**
   * Logs a success event.
   */
  countSuccess(): void {
    this.total++;
  }

  /**
   * Logs a failure event.
   */
  countFailure(): void {
    this.total++;
    this.failed++;
  }

  /**
   * Resets the internal counters to zero.
   */
  reset(): void {
    this.total = 0;
    this.failed = 0;
  }

  /**
   * Export this counter as a CloudWatch metric.
   *
   * @return The exported metric, suitable for reporting.
   */
  getMetric(dimensions: CloudWatch.Dimension[] = []): Metric {
    return {
      name: this.name,
      dimensions,
      unit: 'Count',
      value: [
        {
          value: 0,
          count: this.failed,
        },
        {
          value: 1,
          count: this.total - this.failed,
        },
      ],
    };
  }
}

export default Counter;

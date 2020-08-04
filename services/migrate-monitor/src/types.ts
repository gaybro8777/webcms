import { CloudWatch } from 'aws-sdk';

/**
 * A `MetricSample` wraps the logic needed for client-side metrics aggregation in
 * CloudWatch. Metric batches are sent to CloudWatch as a pair of arrays: the first is an
 * array of values, and the second is an array of counts. In order to avoid potential
 * pitfalls of this approach, we couple the value and its counts, and require that the
 * `MetricReporter` function perform the necessary transformation.
 */
export interface MetricSample {
  /**
   * The value of this sample.
   */
  readonly value: number;

  /**
   * The number of times this sample was observed in the time range.
   */
  readonly count: number;
}

/**
 * This is a subset of the metric for the CloudWatch API's `PutMetricDataInput` interface.
 */
export interface Metric {
  /**
   * The name of this metric. Should be in PascalCase to match AWS conventions.
   */
  readonly name: string;

  /**
   * The value of a metric can be one of three things:
   * 1. A plain number, covering the entire time range.
   * 2. An array of numbers representing a batch of samples in the time range. See
   *    `MetricSample` for more information.
   * 3. A pre-computed statistics object. This has implications on using percentiles, see
   *    the notes in the [PutMetricData
   *    API](https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_PutMetricData.html)
   *    documentation.
   */
  readonly value: number | MetricSample[] | CloudWatch.StatisticSet;

  /**
   * The unit for this metric. See the Unit field in the [MetricDatum
   * API](https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_MetricDatum.html)
   * documentation.
   */
  readonly unit: CloudWatch.StandardUnit;

  /**
   * Any dimensions to attach to this metric. In the case of monitoring migrations, this
   * should be the migration's name.
   */
  readonly dimensions: readonly CloudWatch.Dimension[];
}

/**
 * A `MetricReporter` is a function that publishes a batch of metrics to some remote
 * destination. In production this will simply be a facade over the AWS SDK's `CloudWatch`
 * client class, but it can be used to inject testing or null functions in other
 * environments.
 *
 * The value returned by the reporter's promise is ignored.
 */
export type MetricReporter = (
  /**
   * The namespace for the metrics.
   */
  namespace: string,

  /**
   * The timestamp for reporting these metrics.
   */
  timestamp: Date,

  /**
   * An array of metrics for this batch.
   */
  metrics: readonly Metric[],
) => Promise<unknown>;

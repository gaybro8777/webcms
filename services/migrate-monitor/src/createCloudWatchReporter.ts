import { CloudWatch } from 'aws-sdk';

import { MetricReporter } from './types';

/**
 * Creates a metric reporting function for sending metrics to CloudWatch.
 */
function createCloudWatchReporter(): MetricReporter {
  const client = new CloudWatch();

  return async (namespace, timestamp, metrics) => {
    // Create the array of metric data in CloudWatch's expected format
    const metricData = metrics.map(metric => {
      const datum: CloudWatch.MetricDatum = {
        MetricName: metric.name,
        Unit: metric.unit,
        Timestamp: timestamp,
      };

      // Copy over the dimensions if there are any
      if (metric.dimensions.length > 0) {
        datum.Dimensions = [...metric.dimensions];
      }

      const value = metric.value;
      if (typeof value === 'number') {
        // Single-valued metric
        datum.Value = value;
      } else if (Array.isArray(value)) {
        // Batch of multiple samples
        datum.Counts = value.map(sample => sample.count);
        datum.Values = value.map(sample => sample.value);
      } else {
        // Pre-computed stastitics
        datum.StatisticValues = value;
      }

      return datum;
    });

    // Return the API promise
    return client
      .putMetricData({
        Namespace: namespace,
        MetricData: metricData,
      })
      .promise();
  };
}

export default createCloudWatchReporter;

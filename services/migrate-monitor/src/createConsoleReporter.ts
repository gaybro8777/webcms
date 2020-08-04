import { MetricReporter } from './types';

function createConsoleReporter(): MetricReporter {
  return async (namespace, timestamp, metrics) => {
    console.log(`[${timestamp}] Namespace: ${namespace}`);
    console.log(`[${timestamp}] Metrics: ${JSON.stringify(metrics)}`);
  };
}

export default createConsoleReporter;

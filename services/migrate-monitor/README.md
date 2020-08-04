# Migration Performance Monitor

## Table of Contents

- [About](#about)
- [Short Reference](#short-reference)
- [CloudWatch Metrics](#cloudwatch-metrics)
  - [Internal Metrics](#internal-metrics)
  - [External Metrics](#external-metrics)
  - [On the Success Metrics](#on-the-success-metrics)
- [Layout](#layout)
- [Further Reading](#further-reading)

## About

This is a [Node.js](https://nodejs.org/en) container designed to be run as a sidecar
alongside Drush migration imports. The container listens on a UDP port (much like other
performance or debugging daemons such as StatsD or the AWS X-Ray daemon) and handles
incoming metrics messages.

## Short Reference

- The container listens on the UDP address `127.0.0.1:2000` for JSON messages.
- There are two kinds of JSON messages that the daemon understands:
  1. `{ "type": "migration", "name": <name: string> }` tells the daemon to use `<name>` as
     the migration name.
  2. `{ "type": "import", "time": <time: number>, "success": <success: boolean> }` tells
     the daemon to log an entity import. The `<time>` value indicates how long the
     import lasted, in seconds, and `<success>` is `true` if the import succeeded.

## Running

This container should always be run as a sidecar container (see [Sidecar
pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/sidecar)) for any
Drush migrations. It should not be run alongside arbitrary Drush commands, as it will
dutifully report zeroes for the duration of the Drush invocation (cron, cache clear,
etc.).

The only configuration value it respects is the `NODE_ENV` environment variable, which it uses like so:

1. When unset or explicitly set to `production`, the container assumes it is running in
   ECS and should therefore push metrics to CloudWatch.
2. Otherwise, it sends metrics to the container's logs intead.

This convention follows Node.js' and npm's. A value of `production` mimics the
`--production` flag for `npm ci` and `npm install`: when set, it simply means that the
code is being run in a non-test or non-build environment.

## CloudWatch Metrics

This container publishes custom metrics to CloudWatch every 60 seconds. When metrics are
sent to CloudWatch, the internal counters are reset. This enables creating alarms based on
what the container saw: a period of zeroes for the migration metrics, for example, can
indicate that the migration has stalled.

### Internal Metrics

These metrics are internal to the monitor container, and are useful mainly in performance
tuning scenarios.

They are published under the `EPA/MigrationMonitor` metric namespace.

| Metric         | Unit         | About                                    | Statistics     |
| -------------- | ------------ | ---------------------------------------- | -------------- |
| MessageSuccess | Count        | Number of messages successfully handled  | See note       |
| UserCPU        | Microseconds | Amount of CPU time spent in user land    | Avg or Min/Max |
| SystemCPU      | Microseconds | Amount of CPU time spent in system calls | Avg or Min/Max |
| MemoryUsage    | Bytes        | Amount of memory in use by Node.js       | Avg or Min/Max |

### Migration Metrics

These metrics are the metrics sent to the container by Drush.

They are published under the `EPA/DrupalMigration` metric namespace.

| Metric        | Unit    | About                       | Statistics     |
| ------------- | ------- | --------------------------- | -------------- |
| ImportSuccess | Count   | Number of entities imported | See note       |
| ImportTime    | Seconds | Import timing information   | Avg or Min/Max |

### On the Success Metrics

In order to reduce the amount of data stored in CloudWatch, this container uses the
Success idiom. This metric is handled as if it were a counter, with three properties:

1. The SampleCount of the metric is the _total_ number of events counted.
2. The Sum of the metric is the number of successful events counted.
3. The number of failures is a derived metric, expressed as _SampleCount(metric) - Sum(metric)_.

## Layout

The container's source code is laid out as follows:

- `src/` - [TypeScript](https://www.typescriptlang.org/) sources
  - `src/index.ts` - Entry point. This starts up the UDP server and handles incoming messages.
  - `src/Aggregator.ts` - The metrics aggregator. The aggregator is responsible for retaining all metrics as well as the logic to send the data to CloudWatch.
  - `src/Counter.ts` - A helper class to manage the Success idiom (see above).
  - `src/createCloudWatchReporter.ts` - Adapter to send metrics to CloudWatch.
  - `src/createConsoleReporter.ts` - Adapter to log metrics to the JS console. Useful for local development.
  - `src/logger.ts` - Shared logger for logging to the JS console. It ensures there is always a timestamp in front of the message.
  - `src/types.ts` - TypeScript types shared by multiple files.

## Further Reading

- [Node.js API docs](https://nodejs.org/dist/latest-v12.x/docs/api)
- [The `PutMetricData` API](https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_PutMetricData.html)
- [CloudWatch custom metrics](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/publishingMetrics.html)

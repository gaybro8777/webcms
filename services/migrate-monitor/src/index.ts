import dgram from 'dgram';

import Aggregator from './Aggregator';
import createCloudWatchReporter from './createCloudWatchReporter';
import createConsoleReporter from './createConsoleReporter';
import handleMessage from './handleMessage';
import logger from './logger';

const environment = process.env.NODE_ENV ?? 'production';

// The `createReporter()` function switches reporters. If we're running in a production
// environment, then the reporter will send metrics to CloudWatch. Otherwise, we write to
// the Node.js console.
const createReporter =
  environment === 'production'
    ? createCloudWatchReporter
    : createConsoleReporter;

const aggregator = new Aggregator(createReporter());

// 60-second metrics flush interval
const flushInterval = 60 * 1000;

const server = dgram.createSocket('udp4');

/**
 * Global timer for the metrics flush process.
 *
 * When set, it needs to be flushed with `clearInterval` or else the event loop won't
 * auto-close.
 */
let timer: NodeJS.Timeout | undefined;

/**
 * Performs final cleanup tasks. This flushes the last batch of metrics (if any), and
 * closes the server socket.
 */
async function shutdown() {
  if (timer !== undefined) {
    clearInterval(timer);
  }

  await aggregator.flushMetrics();

  await new Promise<void>(resolve => {
    server.close(resolve);
  });
}

/**
 * Shuts down the process. Attempts a graceful exit but
 */
function exitProcess() {
  shutdown().then(
    () => {
      // Successful shutdown
      process.exit();
    },
    error => {
      // If we reached here, then we've encountered an error during the shutdown handler,
      // so we should report any issues if we see them.
      logger.warn(`Unclean shutdown due to ${error}`);
      process.exit(process.exitCode ?? 1);
    },
  );
}

// SIGTERM is the default
process.on('SIGTERM', () => {
  exitProcess();
});

server.on('error', error => {
  // Close the server socket if there was an error - in UDP, this usually means the socket
  // couldn't be bound, rather than any transmission errors.
  logger.error(`Socket error: ${error}`);

  // Flag this run as an error
  process.exitCode = 1;

  // Clean up any resources we may have initialized
  exitProcess();
});

// For message format, see tryDecode.ts
server.on('message', (message, info) => {
  logger.log(
    `Received message from ${info.address}:${info.port} (${info.size} bytes)`,
  );

  handleMessage(message, aggregator);
});

server.bind(2000, '127.0.0.1', () => {
  logger.info(`Server listening on 127.0.0.1:2000`);

  timer = setInterval(() => aggregator.flushMetrics(), flushInterval);
});

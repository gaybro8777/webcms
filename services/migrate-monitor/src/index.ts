import dgram from 'dgram';

import Aggregator from './Aggregator';
import createCloudWatchReporter from './createCloudWatchReporter';
import tryDecode from './tryDecode';

// 60-second metrics flush interval
const flushInterval = 60 * 1000;

const aggregator = new Aggregator(createCloudWatchReporter());

const server = dgram.createSocket('udp4');

let timer: NodeJS.Timeout | undefined;

server.on('error', error => {
  // Close the server socket if there was an error
  console.error(`Socket error: ${error}`);
  server.close();
});

// For message format, see tryDecode.ts
server.on('message', (message, info) => {
  console.log(
    `Received message from ${info.address}:${info.port} (${info.size} bytes)`,
  );

  try {
    const decoded = tryDecode(message);
    switch (decoded.type) {
      case 'migration':
        aggregator.setMigrationName(decoded.name);
        break;

      case 'import':
        aggregator.countMigration(decoded.time, decoded.success);
        break;
    }

    aggregator.countMessageSuccess();
  } catch (err) {
    aggregator.countMessageFailure();
  }
});

server.bind(2000, '127.0.0.1', () => {
  console.log(`Server listening on 127.0.0.1:2000`);

  timer = setInterval(() => aggregator.flushMetrics(), flushInterval);
});

async function shutdown() {
  if (timer !== undefined) {
    clearInterval(timer);
  }

  await aggregator.flushMetrics();

  await new Promise<void>(resolve => {
    server.close(resolve);
  });
}

process.on('SIGTERM', () => {
  shutdown().then(() => {
    process.exit(0);
  });
});

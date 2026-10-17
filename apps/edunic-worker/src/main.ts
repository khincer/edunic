import { bootstrapWorker } from './bootstrap.js';

async function main() {
  const { config, consumer } = bootstrapWorker();

  // Join first, then read: the group starts at the stream tip, so events
  // published while the worker was down before its first start are skipped
  // (unconsumed rows stay recoverable in the outbox until published).
  await consumer.ensureGroup();

  let running = true;
  const stop = () => {
    running = false;
    // Disconnecting unblocks a pending XREADGROUP so the loop can finish.
    consumer.close();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  console.log(`worker consuming "${config.streamName}" (group edunic-worker)`);

  while (running) {
    try {
      await consumer.pollOnce({ blockMs: 2000 });
    } catch (error) {
      if (!running) {
        break;
      }
      // No ack happened for the failed entry: the next iteration retries it.
      console.error('[worker] stream poll failed', error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

void main().catch((error) => {
  console.error('[worker] fatal bootstrap error', error);
  process.exit(1);
});

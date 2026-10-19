import { bootstrapWorker } from './bootstrap.js';

async function main() {
  const { config, consumer, emailWorker, emailQueue, pool } = bootstrapWorker();

  // The BullMQ worker starts with the stream loop and drains its own queue; the
  // group is joined before the first read so the stream tip is the start point.
  await emailWorker.waitUntilReady();
  await consumer.ensureGroup();

  let running = true;
  let stopping: Promise<void> | null = null;

  const stop = (): Promise<void> => {
    if (stopping) {
      return stopping;
    }

    running = false;
    // Disconnecting unblocks a pending XREADGROUP so the loop can finish.
    consumer.close();

    // D3: close queue and worker before the database pool.
    stopping = (async () => {
      await emailWorker.close();
      await emailQueue.close();
      await pool.end();
    })();

    return stopping;
  };

  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());

  console.log(
    `worker consuming "${config.streamName}" (group edunic-worker) and sending email through queue "${config.emailQueueName}"`
  );

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

  await stop();
}

void main().catch((error) => {
  console.error('[worker] fatal bootstrap error', error);
  process.exit(1);
});

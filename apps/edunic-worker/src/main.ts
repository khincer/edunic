import { bootstrapWorker } from './bootstrap.js';

// Task 7.1 entrypoint: loads env and builds the Redis Streams bus. The
// consumer loop starts once the stream consumer lands (task 7.2).
const { config } = bootstrapWorker();

console.log(`worker ready for stream "${config.streamName}"`);

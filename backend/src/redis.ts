/** BullMQ connection options from REDIS_URL, or undefined when Redis is not configured. */
export function redisConnection() {
  if (!process.env.REDIS_URL) return undefined;
  const url = new URL(process.env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}

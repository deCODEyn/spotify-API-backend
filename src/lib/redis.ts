import type { FastifyInstance } from "fastify";
import RedisPkg from "ioredis";
import { env } from "../env.ts";

const Redis = RedisPkg.default;

export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
});

export async function connectRedis(app: FastifyInstance) {
  try {
    await redis.connect();
    app.log.info("Redis connected");
  } catch (error) {
    app.log.error(`Failed to connect Redis: ${error}`);
  }
}

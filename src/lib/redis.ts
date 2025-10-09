import type { FastifyInstance } from "fastify";
import RedisPkg from "ioredis";
import { env } from "@/env.ts";

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
    app.log.info("Conexão com Redis OK.");
  } catch (error) {
    app.log.error(`Falha o conectar com o Redis: ${error}`);
  }
}

import { env } from "../env.ts";

export const TOKEN_PREFIX = "spotify:tokens:";

export const BASIC = Buffer.from(
  `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`
).toString("base64");

export const CACHE_TTL_SECONDS = 60 * 60;

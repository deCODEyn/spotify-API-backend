import { env } from "@/env.ts";
import { BadRequestError } from "@/errors/bad-request-error.ts";
import { UnauthorizedError } from "@/errors/unauthorized-error.ts";
import { redis } from "@/lib/redis.ts";
import {
  type TokenSchema,
  tokenSchema,
  type UserSchema,
  userSchema,
} from "@/schemas/auth-schemas.ts";

const TOKEN_PREFIX = "spotify:tokens:";

export async function exchangeCodeForToken(code: string) {
  const basic = Buffer.from(
    `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: env.SPOTIFY_REDIRECT_URI,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new UnauthorizedError("Falha ao trocar 'code' por token.");
  }

  const data = await response.json();
  const spotifyTokens = tokenSchema.parse(data);

  return {
    access_token: spotifyTokens.access_token,
    refresh_token: spotifyTokens.refresh_token,
    expires_in: spotifyTokens.expires_in ?? 3600,
  };
}

export async function getSpotifyUser(accessToken: string) {
  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new BadRequestError("Falha ao buscar usuário do Spotify.");
  }
  const data = await response.json();
  const user = userSchema.parse(data);

  return {
    userId: user.userId,
    display_name: user.display_name ?? null,
    email: user.email ?? null,
  };
}

export async function saveTokensAndUser(user: UserSchema, tokens: TokenSchema) {
  const expiresAt = Date.now() + tokens.expires_in * 1000;
  const payload = {
    ...user,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
  };
  const prefix = `${TOKEN_PREFIX}${user.userId}`;

  await redis.set(
    prefix,
    JSON.stringify(payload),
    "EX",
    tokens.expires_in + 60
  );
}

export async function getUserFromRedis(userId: string) {
  const data = await redis.get(`${TOKEN_PREFIX}${userId}`);
  if (!data) {
    throw new UnauthorizedError("Usuário não localizado.");
  }
  const parsed = JSON.parse(data);
  const user = userSchema.parse(parsed);
  return user;
}

import { BASIC, TOKEN_PREFIX } from "../constants/index.ts";
import { env } from "../env.ts";
import { BadRequestError } from "../errors/bad-request-error.ts";
import { ForbiddenError } from "../errors/forbidden-error.ts";
import { UnauthorizedError } from "../errors/unauthorized-error.ts";
import { redis } from "../lib/redis.ts";
import {
  redisStoredSchema,
  type TokenSchema,
  tokenSchema,
  type UserSchema,
  userSchema,
} from "../schemas/auth-schemas.ts";

/**
 * Troca o code retornado pelo Spotify por tokens.
 */
export async function exchangeCodeForToken(code: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: env.SPOTIFY_REDIRECT_URI,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${BASIC}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new UnauthorizedError("Falha ao trocar 'code' por token.");
  }

  const data = await response.json();

  return tokenSchema.parse(data);
}

/**
 * Busca dados do usuário no Spotify via access_token.
 */
export async function getSpotifyUser(accessToken: string) {
  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new BadRequestError("Falha ao buscar usuário do Spotify.");
  }

  const data = await response.json();

  return userSchema.parse(data);
}

/**
 * Salva os tokens e usuário no Redis.
 */
export async function saveTokensAndUser(user: UserSchema, tokens: TokenSchema) {
  const payload = {
    ...user,
    ...tokens,
    expires_at: Date.now() + tokens.expires_in * 1000,
  };

  await redis.set(
    `${TOKEN_PREFIX}${user.id}`,
    JSON.stringify(payload),
    "EX",
    tokens.expires_in + 60
  );

  return payload;
}

/**
 * Busca dados do usuário no Redis (somente user, sem tokens).
 */
export async function getUserFromRedis(userId: string) {
  const data = await redis.get(`${TOKEN_PREFIX}${userId}`);
  if (!data) {
    throw new UnauthorizedError("Usuário não localizado.");
  }
  const parsed = JSON.parse(data);
  return userSchema.parse(parsed);
}

/**
 * Refresha o token do usuário e atualiza o Redis.
 */
export async function refreshSpotifyToken(userId: string) {
  const data = await redis.get(`${TOKEN_PREFIX}${userId}`);

  if (!data) {
    throw new UnauthorizedError("User not authenticated");
  }

  const parsed = JSON.parse(data);
  const stored = redisStoredSchema.parse(parsed);

  if (!stored.refresh_token) {
    throw new ForbiddenError(
      "O token para atualizar credenciais está faltando."
    );
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: stored.refresh_token,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${BASIC}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new UnauthorizedError("Falha ai atualizar o Spotify token");
  }

  const token = await response.json();
  const refreshedTokens = tokenSchema.parse(token);
  const mergedTokens = {
    ...refreshedTokens,
    refresh_token: refreshedTokens.refresh_token ?? stored.refresh_token,
  };
  const user = userSchema.parse(stored);

  return saveTokensAndUser(user, mergedTokens);
}

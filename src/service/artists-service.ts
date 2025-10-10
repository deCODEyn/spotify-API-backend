import { CACHE_TTL_SECONDS, TOKEN_PREFIX } from "../constants/index.ts";
import { UnauthorizedError } from "../errors/unauthorized-error.ts";
import { redis } from "../lib/redis.ts";
import {
  simplifiedArtistSchema,
  spotifyTopArtistsResponseSchema,
} from "../schemas/artists-schema.ts";
import { tokenSchema } from "../schemas/auth-schemas.ts";
import { refreshSpotifyToken } from "./auth-service.ts";

/**
 * Busca os top artistas do usuário autenticado no Spotify.
 */
async function fetchArtists(token: string) {
  const response = await fetch("https://api.spotify.com/v1/me/top/artists", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response;
}

/**
 * Faz a validação e refresh token para chamada da API.
 */
export async function fetchArtistsWithRefresh(userId: string) {
  const data = await redis.get(`${TOKEN_PREFIX}${userId}`);

  if (!data) {
    throw new UnauthorizedError("Usuário não autenticado ou token expirado.");
  }

  const { access_token } = tokenSchema.parse(JSON.parse(data));
  let response = await fetchArtists(access_token);

  // Se o token expirou, tenta refresh
  if (response.status === 401) {
    await refreshSpotifyToken(userId);
    const refreshed = await redis.get(`${TOKEN_PREFIX}${userId}`);

    if (!refreshed) {
      throw new UnauthorizedError("Falha ao atualizar token Spotify.");
    }

    const { access_token: newToken } = tokenSchema.parse(JSON.parse(refreshed));
    response = await fetchArtists(newToken);
  }

  if (!response.ok) {
    throw new UnauthorizedError("Erro ao buscar artistas no Spotify.");
  }

  const json = await response.json();
  const parsed = spotifyTopArtistsResponseSchema.parse(json);

  const artists = parsed.items.map((artist) =>
    simplifiedArtistSchema.parse({
      id: artist.id,
      name: artist.name,
      genres: artist.genres,
      imageUrl: artist.images?.[0]?.url ?? null,
      followers: artist.followers.total,
    })
  );

  return artists;
}

/**
 * Main function. Aplicação de cache.
 */
export async function getTopArtists(userId: string) {
  const cacheKey = `${TOKEN_PREFIX}${userId}:top-artists`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const artists = await fetchArtistsWithRefresh(userId);
  await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(artists));

  return artists;
}

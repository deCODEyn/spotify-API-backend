import { CACHE_TTL_SECONDS, TOKEN_PREFIX } from "../constants/index.ts";
import { redis } from "../lib/redis.ts";
import {
  type SimplifiedArtist,
  simplifiedArtistSchema,
  spotifyTopArtistsResponseSchema,
} from "../schemas/artists-schemas.ts";
import { withSpotifyAuthRetry } from "../utils/with-spotify-auth-retry.ts";

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
  const response = await withSpotifyAuthRetry(userId, (token) =>
    fetchArtists(token)
  );

  const data = await response.json();
  const parsed = spotifyTopArtistsResponseSchema.parse(data);

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
export async function getTopArtists(
  userId: string
): Promise<SimplifiedArtist[]> {
  const cacheKey = `${TOKEN_PREFIX}${userId}:top-artists`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const artists = await fetchArtistsWithRefresh(userId);
  await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(artists));

  return artists;
}

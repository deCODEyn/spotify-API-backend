import { CACHE_TTL_SECONDS, TOKEN_PREFIX } from "../constants/index.ts";
import { redis } from "../lib/redis.ts";
import {
  type SimplifiedAlbum,
  simplifiedAlbumSchema,
  spotifyAlbumsResponseSchema,
} from "../schemas/artists-schemas.ts";
import { withSpotifyAuthRetry } from "../utils/with-spotify-auth-retry.ts";

/**
 * Busca os álbuns de um artista no Spotify, com paginação.
 */
export async function fetchArtistAlbums(
  token: string,
  artistId: string,
  limit: number,
  offset: number
) {
  const url = new URL(`https://api.spotify.com/v1/artists/${artistId}/albums`);
  url.searchParams.set("limit", limit.toString());
  url.searchParams.set("offset", offset.toString());

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  return response;
}

/**
 * Busca os álbuns de um artista no Spotify, com paginação.
 */
export async function fetchAlbumsWithRefresh(
  userId: string,
  artistId: string,
  limit = 20,
  offset = 0
) {
  const response = await withSpotifyAuthRetry(userId, (token) =>
    fetchArtistAlbums(token, artistId, limit, offset)
  );

  const data = await response.json();
  const parsed = spotifyAlbumsResponseSchema.parse(data);

  const albums = parsed.items.map((album) =>
    simplifiedAlbumSchema.parse({
      id: album.id,
      name: album.name,
      imageUrl: album.images?.[0]?.url ?? null,
      totalTracks: album.total_tracks,
      releaseDate: album.release_date,
    })
  );

  return { albums, total: parsed.total };
}

/**
 * Main function. Aplicação de cache.
 */
export async function getArtistAlbums(
  userId: string,
  artistId: string,
  limit = 20,
  offset = 0
): Promise<{ albums: SimplifiedAlbum[]; total: number }> {
  const cacheKey = `${TOKEN_PREFIX}${userId}:artist:${artistId}:albums:limit${limit}:offset${offset}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const result = await fetchAlbumsWithRefresh(userId, artistId, limit, offset);
  await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(result));

  return result;
}

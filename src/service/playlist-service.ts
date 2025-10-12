import { CACHE_TTL_SECONDS, TOKEN_PREFIX } from "../constants/index.ts";
import { redis } from "../lib/redis.ts";
import {
  type CreatePlaylistBody,
  createPlaylistBodySchema,
  type SimplifiedPlaylist,
  simplifiedPlaylistSchema,
  spotifyPlaylistsResponseSchema,
} from "../schemas/playlist-schemas.ts";
import { withSpotifyAuthRetry } from "../utils/with-spotify-auth-retry.ts";

/**
 * Faz a requisição para buscar playlists do usuário no Spotify.
 */
export async function fetchPlaylists(token: string) {
  const response = await fetch("https://api.spotify.com/v1/me/playlists", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response;
}

/**
 * Faz a validação e refresh token para chamada da API.
 */
export async function fetchPlaylistsWithRefresh(userId: string) {
  const response = await withSpotifyAuthRetry(userId, (token) =>
    fetchPlaylists(token)
  );

  const data = await response.json();
  const parsed = spotifyPlaylistsResponseSchema.parse(data);

  const playlists = parsed.items.map((playlist) =>
    simplifiedPlaylistSchema.parse({
      id: playlist.id,
      name: playlist.name,
      description: playlist.description || null,
      imageUrl: playlist.images?.[0]?.url ?? null,
      tracks: playlist.tracks.total,
    })
  );

  return playlists;
}

/**
 * Main function. Aplicação de cache.
 */
export async function getUserPlaylists(
  userId: string
): Promise<SimplifiedPlaylist[]> {
  const cacheKey = `${TOKEN_PREFIX}${userId}:playlists`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const playlists = await fetchPlaylistsWithRefresh(userId);
  await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(playlists));

  return playlists;
}

/**
 * Faz a requisição para criar uma nova playlist.
 */
export async function fetchCreatePlaylist(
  token: string,
  userId: string,
  body: CreatePlaylistBody
) {
  const response = await fetch(
    `https://api.spotify.com/v1/users/${userId}/playlists`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  return response;
}

/**
 * Criação de nova playlist.
 */
export async function createPlaylist(userId: string, body: CreatePlaylistBody) {
  const parsedBody = createPlaylistBodySchema.parse(body);
  const response = await withSpotifyAuthRetry(userId, (token) =>
    fetchCreatePlaylist(token, userId, parsedBody)
  );

  const data = await response.json();
  const parsed = spotifyPlaylistsResponseSchema.parse({ items: [data] });

  const playlist = simplifiedPlaylistSchema.parse({
    id: parsed.items[0].id,
    name: parsed.items[0].name,
    description: parsed.items[0].description ?? null,
    imageUrl: parsed.items[0].images[0]?.url ?? null,
    tracks: parsed.items[0].tracks.total ?? 0,
  });

  return playlist;
}

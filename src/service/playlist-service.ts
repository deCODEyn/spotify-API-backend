import { CACHE_TTL_SECONDS, TOKEN_PREFIX } from "../constants/index.ts";
import { UnauthorizedError } from "../errors/unauthorized-error.ts";
import { redis } from "../lib/redis.ts";
import { tokenSchema } from "../schemas/auth-schemas.ts";
import {
  type CreatePlaylistBody,
  createPlaylistBodySchema,
  type SimplifiedPlaylist,
  simplifiedPlaylistSchema,
  spotifyPlaylistsResponseSchema,
} from "../schemas/playlist-schemas.ts";

import { refreshSpotifyToken } from "./auth-service.ts";

/**
 * Faz a requisição para buscar playlists do usuário no Spotify.
 */
async function fetchPlaylists(token: string) {
  const response = await fetch("https://api.spotify.com/v1/me/playlists", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response;
}

/**
 * Faz a validação e refresh token para chamada da API.
 */
export async function fetchPlaylistsWithRefresh(userId: string) {
  const data = await redis.get(`${TOKEN_PREFIX}${userId}`);

  if (!data) {
    throw new UnauthorizedError("Usuário não autenticado ou token expirado.");
  }

  const { access_token } = tokenSchema.parse(JSON.parse(data));
  let response = await fetchPlaylists(access_token);

  // Se o token expirou, tenta refresh
  if (response.status === 401) {
    await refreshSpotifyToken(userId);
    const refreshed = await redis.get(`${TOKEN_PREFIX}${userId}`);

    if (!refreshed) {
      throw new UnauthorizedError("Falha ao atualizar token Spotify.");
    }

    const { access_token: newToken } = tokenSchema.parse(JSON.parse(refreshed));
    response = await fetchPlaylists(newToken);
  }

  if (!response.ok) {
    throw new UnauthorizedError("Erro ao buscar playlists no Spotify.");
  }

  const json = await response.json();
  const parsed = spotifyPlaylistsResponseSchema.parse(json);

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
async function fetchCreatePlaylist(
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
  const tokenData = await redis.get(`${TOKEN_PREFIX}${userId}`);

  if (!tokenData) {
    throw new UnauthorizedError("Usuário não autenticado.");
  }

  const { access_token } = tokenSchema.parse(JSON.parse(tokenData));
  let response = await fetchCreatePlaylist(access_token, userId, parsedBody);

  if (response.status === 401) {
    await refreshSpotifyToken(userId);
    const refreshed = await redis.get(`spotify:token:${userId}`);

    if (!refreshed) {
      throw new UnauthorizedError("Falha ao atualizar token Spotify.");
    }

    const { access_token: newToken } = tokenSchema.parse(JSON.parse(refreshed));
    response = await fetchCreatePlaylist(newToken, userId, parsedBody);
  }

  if (!response.ok) {
    throw new Error("Falha ao criar playlist no Spotify.");
  }

  const json = await response.json();
  const parsed = spotifyPlaylistsResponseSchema.parse({ items: [json] });

  const playlist = simplifiedPlaylistSchema.parse({
    id: parsed.items[0].id,
    name: parsed.items[0].name,
    description: parsed.items[0].description ?? null,
    imageUrl: parsed.items[0].images[0]?.url ?? null,
    tracks: parsed.items[0].tracks.total ?? 0,
  });

  return playlist;
}

import { TOKEN_PREFIX } from "../constants/index.ts";
import { UnauthorizedError } from "../errors/unauthorized-error.ts";
import { redis } from "../lib/redis.ts";
import { tokenSchema } from "../schemas/auth-schemas.ts";
import { refreshSpotifyToken } from "../service/auth-service.ts";

/**
 * Executa uma função de fetch Spotify com retry automático em caso de 401.
 */
export async function withSpotifyAuthRetry(
  userId: string,
  fetchFN: (token: string) => Promise<Response>
): Promise<Response> {
  const cached = await redis.get(`${TOKEN_PREFIX}${userId}`);
  if (!cached) {
    throw new UnauthorizedError("Token do Spotify não encontrado.");
  }

  const { access_token } = tokenSchema.parse(JSON.parse(cached));
  let response = await fetchFN(access_token);

  // Se o token expirou, tenta refresh
  if (response.status === 401) {
    await refreshSpotifyToken(userId);
    const refreshed = await redis.get(`${TOKEN_PREFIX}${userId}`);
    if (!refreshed) {
      throw new UnauthorizedError("Falha ao atualizar token Spotify.");
    }

    const { access_token: newToken } = tokenSchema.parse(JSON.parse(refreshed));
    response = await fetchFN(newToken);
  }

  if (!response.ok) {
    throw new UnauthorizedError("Erro ao buscar dados no Spotify.");
  }

  return response;
}

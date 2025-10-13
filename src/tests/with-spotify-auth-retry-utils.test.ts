import { TOKEN_PREFIX } from "../constants/index.ts";
import { UnauthorizedError } from "../errors/unauthorized-error.ts";
import { redis } from "../lib/redis.ts";
import { refreshSpotifyToken } from "../service/auth-service.ts";
import { withSpotifyAuthRetry } from "../utils/with-spotify-auth-retry.ts";

jest.mock("../service/auth-service.ts", () => ({
  refreshSpotifyToken: jest.fn(),
}));

describe("withSpotifyAuthRetry", () => {
  const USER_ID = "user123";
  const ACCESS_TOKEN = "valid-token";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Happy Path", () => {
    it("deve executar a função se token for válido e retornar Response 200", async () => {
      (redis.get as jest.Mock).mockResolvedValue(
        JSON.stringify({ access_token: ACCESS_TOKEN, expires_in: 3600 })
      );
      const mockResponse = new Response(null, { status: 200 });
      const fetchFn = jest.fn().mockResolvedValue(mockResponse);
      const result = await withSpotifyAuthRetry(USER_ID, fetchFn);

      expect(redis.get).toHaveBeenCalledWith(`${TOKEN_PREFIX}${USER_ID}`);
      expect(fetchFn).toHaveBeenCalledWith(ACCESS_TOKEN);
      expect(refreshSpotifyToken).not.toHaveBeenCalled();
      expect(result).toBe(mockResponse);
    });
  });

  describe("Token não encontrado", () => {
    it("deve lançar UnauthorizedError se o token não existir no cache", async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      const fetchFn = jest.fn();

      await expect(withSpotifyAuthRetry(USER_ID, fetchFn)).rejects.toThrow(
        UnauthorizedError
      );
    });
  });

  describe("Token expirado / Refresh Token", () => {
    it("deve chamar refreshSpotifyToken e usar novo token se a primeira chamada retornar 401", async () => {
      const oldToken = JSON.stringify({
        access_token: "old-token",
        expires_in: 3600,
      });
      const newToken = JSON.stringify({
        access_token: "new-token",
        expires_in: 3600,
      });
      (redis.get as jest.Mock)
        .mockResolvedValueOnce(oldToken)
        .mockResolvedValueOnce(newToken);
      const fetchFn = jest
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(new Response(null, { status: 200 }));
      const result = await withSpotifyAuthRetry(USER_ID, fetchFn);

      expect(refreshSpotifyToken).toHaveBeenCalledWith(USER_ID);
      expect(fetchFn).toHaveBeenCalledTimes(2);
      expect(result.status).toBe(200);
    });

    it("deve lançar UnauthorizedError se refresh_token falhar", async () => {
      const oldToken = JSON.stringify({
        access_token: "old-token",
        expires_in: 3600,
      });
      (redis.get as jest.Mock)
        .mockResolvedValueOnce(oldToken)
        .mockResolvedValueOnce(null);
      const fetchFn = jest
        .fn()
        .mockResolvedValue(new Response(null, { status: 401 }));
      await expect(withSpotifyAuthRetry(USER_ID, fetchFn)).rejects.toThrow(
        new UnauthorizedError("Falha ao atualizar token Spotify.")
      );

      expect(refreshSpotifyToken).toHaveBeenCalledWith(USER_ID);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("Fetch falha", () => {
    it("deve lançar UnauthorizedError se fetchFN retornar status diferente de 200 e 401", async () => {
      const cachedToken = JSON.stringify({
        access_token: ACCESS_TOKEN,
        expires_in: 3600,
      });
      (redis.get as jest.Mock).mockResolvedValue(cachedToken);
      const fetchFn = jest
        .fn()
        .mockResolvedValue(new Response(null, { status: 500 }));
      await expect(withSpotifyAuthRetry(USER_ID, fetchFn)).rejects.toThrow(
        new UnauthorizedError("Erro ao buscar dados no Spotify.")
      );

      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(refreshSpotifyToken).not.toHaveBeenCalled();
    });
  });

  describe("Token inválido", () => {
    it("deve lançar ZodError se o token no cache estiver mal formatado", async () => {
      const invalidToken = JSON.stringify({ token: "wrong-key" });
      (redis.get as jest.Mock).mockResolvedValue(invalidToken);
      const fetchFn = jest.fn();

      await expect(withSpotifyAuthRetry(USER_ID, fetchFn)).rejects.toThrow();
    });
  });

  describe("Call count checks", () => {
    it("deve chamar redis.get e fetchFN apenas uma vez quando token é válido", async () => {
      (redis.get as jest.Mock).mockResolvedValue(
        JSON.stringify({ access_token: ACCESS_TOKEN, expires_in: 3600 })
      );
      const fetchFn = jest
        .fn()
        .mockResolvedValue(new Response(null, { status: 200 }));
      await withSpotifyAuthRetry(USER_ID, fetchFn);

      expect(redis.get).toHaveBeenCalledTimes(1);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it("deve chamar redis.get e fetchFN apenas duas vezes se houver refresh", async () => {
      const oldToken = JSON.stringify({
        access_token: "old-token",
        expires_in: 3600,
      });
      const newToken = JSON.stringify({
        access_token: "new-token",
        expires_in: 3600,
      });
      (redis.get as jest.Mock)
        .mockResolvedValueOnce(oldToken)
        .mockResolvedValueOnce(newToken);
      const fetchFn = jest
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(new Response(null, { status: 200 }));
      await withSpotifyAuthRetry(USER_ID, fetchFn);

      expect(redis.get).toHaveBeenCalledTimes(2);
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });
  });
});

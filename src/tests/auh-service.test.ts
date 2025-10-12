import { BASIC, TOKEN_PREFIX } from "../constants/index.ts";
import { BadRequestError } from "../errors/bad-request-error.ts";
import { ForbiddenError } from "../errors/forbidden-error.ts";
import { UnauthorizedError } from "../errors/unauthorized-error.ts";
import { redis } from "../lib/redis.ts";
import {
  exchangeCodeForToken,
  getSpotifyUser,
  getUserFromRedis,
  refreshSpotifyToken,
  saveTokensAndUser,
} from "../service/auth-service.ts";

const mockFetch = jest.fn();
global.fetch = mockFetch as typeof global.fetch;

describe("Auth Service", () => {
  const USER_ID = "user123";
  const CODE = "code123";
  const ACCESS_TOKEN = "access123";
  const REFRESH_TOKEN = "refresh123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("exchangeCodeForToken", () => {
    it("deve chamar o endpoint de token do Spotify corretamente com POST, headers e body", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: ACCESS_TOKEN,
          refresh_token: REFRESH_TOKEN,
          expires_in: 3600,
          token_type: "Bearer",
        }),
      });
      await exchangeCodeForToken(CODE);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://accounts.spotify.com/api/token",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Basic ${BASIC}`,
            "Content-Type": "application/x-www-form-urlencoded",
          }),
          body: expect.any(String),
        })
      );
    });

    it("deve retornar tokens válidos", async () => {
      const data = {
        access_token: ACCESS_TOKEN,
        refresh_token: REFRESH_TOKEN,
        expires_in: 3600,
        token_type: "Bearer",
      };
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(data), { status: 200 })
      );
      const result = await exchangeCodeForToken(CODE);

      expect(result).toEqual(data);
    });

    it("deve lançar UnauthorizedError se fetch retornar !ok", async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 400 }));

      await expect(exchangeCodeForToken(CODE)).rejects.toThrow(
        UnauthorizedError
      );
    });

    it("deve lançar erro se schema estiver inválido", async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ invalid: "data" }), { status: 200 })
      );

      await expect(exchangeCodeForToken(CODE)).rejects.toThrow();
    });
  });

  describe("getSpotifyUser", () => {
    it("deve chamar /v1/me com header correto", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: USER_ID, display_name: "User" }),
      });
      await getSpotifyUser(ACCESS_TOKEN);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.spotify.com/v1/me",
        expect.objectContaining({
          headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
        })
      );
    });

    it("deve retornar usuário validado", async () => {
      const data = { id: USER_ID, display_name: "User" };
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(data), { status: 200 })
      );
      const result = await getSpotifyUser(ACCESS_TOKEN);

      expect(result).toEqual(data);
    });

    it("deve lançar BadRequestError se fetch retornar !ok", async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 400 }));

      await expect(getSpotifyUser(ACCESS_TOKEN)).rejects.toThrow(
        BadRequestError
      );
    });

    it("deve lançar erro se schema estiver inválido", async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ invalid: "data" }), { status: 200 })
      );

      await expect(getSpotifyUser(ACCESS_TOKEN)).rejects.toThrow();
    });
  });

  describe("saveTokensAndUser", () => {
    it("deve salvar payload corretamente no Redis", async () => {
      const user = { id: USER_ID, display_name: "User" };
      const tokens = {
        access_token: ACCESS_TOKEN,
        refresh_token: REFRESH_TOKEN,
        expires_in: 3600,
        token_type: "Bearer",
      };
      const payload = await saveTokensAndUser(user, tokens);

      expect(redis.set).toHaveBeenCalledWith(
        `${TOKEN_PREFIX}${USER_ID}`,
        expect.any(String),
        "EX",
        tokens.expires_in + 60
      );
      expect(payload).toMatchObject(user);
      expect(payload).toMatchObject(tokens);
      expect(payload).toHaveProperty("expires_at");
    });

    it("deve retornar payload mesclado corretamente", async () => {
      const user = { id: USER_ID, display_name: "User" };
      const tokens = {
        access_token: ACCESS_TOKEN,
        refresh_token: REFRESH_TOKEN,
        expires_in: 3600,
        token_type: "Bearer",
      };
      const payload = await saveTokensAndUser(user, tokens);

      expect(payload).toEqual(
        expect.objectContaining({
          ...user,
          ...tokens,
          expires_at: expect.any(Number),
        })
      );
    });
  });

  describe("getUserFromRedis", () => {
    it("deve retornar usuário do Redis corretamente", async () => {
      const data = {
        id: USER_ID,
        display_name: "User",
        access_token: ACCESS_TOKEN,
        refresh_token: REFRESH_TOKEN,
        expires_in: 3600,
        expires_at: Date.now() + 3600 * 1000,
      };
      (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(data));
      const result = await getUserFromRedis(USER_ID);

      expect(result).toEqual({
        id: USER_ID,
        display_name: "User",
      });
    });

    it("deve lançar UnauthorizedError se usuário não encontrado", async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);

      await expect(getUserFromRedis(USER_ID)).rejects.toThrow(
        UnauthorizedError
      );
    });

    it("deve lançar erro se schema estiver inválido", async () => {
      (redis.get as jest.Mock).mockResolvedValue(
        JSON.stringify({ invalid: "data" })
      );

      await expect(getUserFromRedis(USER_ID)).rejects.toThrow();
    });
  });

  describe("refreshSpotifyToken", () => {
    it("deve lançar UnauthorizedError se não houver dados no Redis", async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);

      await expect(refreshSpotifyToken(USER_ID)).rejects.toThrow(
        UnauthorizedError
      );
    });

    it("deve lançar ForbiddenError se refresh_token estiver faltando", async () => {
      const data = {
        id: USER_ID,
        display_name: "User",
        access_token: ACCESS_TOKEN,
        expires_in: 3600,
        expires_at: Date.now() + 3600 * 1000,
      };
      (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(data));

      await expect(refreshSpotifyToken(USER_ID)).rejects.toThrow(
        ForbiddenError
      );
    });

    it("deve chamar endpoint de token do Spotify para refresh corretamente", async () => {
      const data = {
        id: USER_ID,
        display_name: "User",
        access_token: ACCESS_TOKEN,
        refresh_token: REFRESH_TOKEN,
        expires_in: 3600,
        expires_at: Date.now() + 3600 * 1000,
      };
      (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(data));
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: ACCESS_TOKEN,
          expires_in: 3600,
          token_type: "Bearer",
        }),
      });
      const spySave = jest.spyOn(
        require("../service/auth-service.ts"),
        "saveTokensAndUser"
      );
      await refreshSpotifyToken(USER_ID);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://accounts.spotify.com/api/token",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Basic ${BASIC}`,
            "Content-Type": "application/x-www-form-urlencoded",
          }),
        })
      );

      spySave.mockRestore();
    });

    it("deve atualizar token com sucesso e salvar no Redis", async () => {
      const data = {
        id: USER_ID,
        display_name: "User",
        access_token: ACCESS_TOKEN,
        refresh_token: REFRESH_TOKEN,
        expires_in: 3600,
        expires_at: Date.now() + 3600 * 1000,
      };
      (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(data));
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: ACCESS_TOKEN,
          expires_in: 3600,
          token_type: "Bearer",
        }),
      });
      const result = await refreshSpotifyToken(USER_ID);

      expect(result).toMatchObject(
        expect.objectContaining({
          access_token: ACCESS_TOKEN,
          refresh_token: REFRESH_TOKEN,
          expires_at: expect.any(Number),
        })
      );
    });

    it("deve retornar payload mesclado corretamente", async () => {
      const data = {
        id: USER_ID,
        display_name: "User",
        access_token: ACCESS_TOKEN,
        refresh_token: REFRESH_TOKEN,
        expires_in: 3600,
        expires_at: Date.now() + 3600 * 1000,
      };
      (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(data));
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: ACCESS_TOKEN,
          expires_in: 3600,
          token_type: "Bearer",
        }),
      });
      const result = await refreshSpotifyToken(USER_ID);

      expect(result).toMatchObject(
        expect.objectContaining({
          id: USER_ID,
          access_token: ACCESS_TOKEN,
          refresh_token: REFRESH_TOKEN,
          expires_at: expect.any(Number),
        })
      );
    });

    it("deve lançar UnauthorizedError se fetch falhar", async () => {
      const data = {
        id: USER_ID,
        display_name: "User",
        access_token: ACCESS_TOKEN,
        refresh_token: REFRESH_TOKEN,
        expires_in: 3600,
        expires_at: Date.now() + 3600 * 1000,
      };
      (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(data));
      mockFetch.mockResolvedValue(new Response(null, { status: 400 }));

      await expect(refreshSpotifyToken(USER_ID)).rejects.toThrow(
        UnauthorizedError
      );
    });

    it("deve lançar erro se tokenSchema ou userSchema for inválido", async () => {
      const data = {
        id: USER_ID,
        display_name: "User",
        access_token: ACCESS_TOKEN,
        refresh_token: REFRESH_TOKEN,
        expires_in: 3600,
        expires_at: Date.now() + 3600 * 1000,
      };
      (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(data));
      const invalidToken = { invalid: "data" };
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(invalidToken), { status: 200 })
      );

      await expect(refreshSpotifyToken(USER_ID)).rejects.toThrow();
    });
  });
});

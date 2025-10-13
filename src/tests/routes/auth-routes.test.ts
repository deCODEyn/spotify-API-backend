import type { FastifyInstance } from "fastify";
import { env } from "../../env.ts";

jest.mock("../../service/auth-service.ts", () => {
  const actual = jest.requireActual("../../service/auth-service.ts");
  return {
    ...actual,
    exchangeCodeForToken: jest.fn(),
    getSpotifyUser: jest.fn(),
    saveTokensAndUser: jest.fn(),
    refreshSpotifyToken: jest.fn(),
    getUserFromRedis: jest.fn(),
  };
});

import {
  exchangeCodeForToken,
  getSpotifyUser,
  getUserFromRedis,
  refreshSpotifyToken,
  saveTokensAndUser,
} from "../../service/auth-service.ts";
import { buildTestServer } from "../utils/build-test-server.ts";

const mockExchange = exchangeCodeForToken as jest.Mock;
const mockGetSpotifyUser = getSpotifyUser as jest.Mock;
const mockSaveTokens = saveTokensAndUser as jest.Mock;
const mockRefresh = refreshSpotifyToken as jest.Mock;

describe("Auth routes (integration via fastify.inject + real JWT)", () => {
  let app: FastifyInstance;
  const USER_ID = "user123";
  const CODE = "code-abc";
  const ACCESS_TOKEN = "spotify-access";
  const REFRESH_TOKEN = "spotify-refresh";

  beforeAll(async () => {
    app = await buildTestServer();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/auth/login", () => {
    it("deve retornar spotifyUrl contendo client_id e redirect_uri", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/auth/login",
      });
      const body = JSON.parse(res.body);

      expect(res.statusCode).toBe(200);
      expect(body).toHaveProperty("spotifyUrl");
      expect(body.spotifyUrl).toContain(
        `client_id=${encodeURIComponent(env.SPOTIFY_CLIENT_ID)}`
      );
      expect(body.spotifyUrl).toContain(
        `redirect_uri=${encodeURIComponent(env.SPOTIFY_REDIRECT_URI)}`
      );
    });
  });

  describe("POST /api/auth/callback", () => {
    it("deve retornar 400 quando o código estiver faltando", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/callback",
      });
      const body = JSON.parse(res.body);

      expect(res.statusCode).toBe(400);
      expect(body).toHaveProperty("message");
    });

    it("deve trocar código, buscar usuário do Spotify, salvar tokens e retornar jwtToken (201)", async () => {
      mockExchange.mockResolvedValue({
        access_token: ACCESS_TOKEN,
        refresh_token: REFRESH_TOKEN,
        expires_in: 3600,
        token_type: "Bearer",
      });
      mockGetSpotifyUser.mockResolvedValue({
        id: USER_ID,
        display_name: "User",
      });
      mockSaveTokens.mockResolvedValue(true);
      const res = await app.inject({
        method: "POST",
        url: `/api/auth/callback?code=${encodeURIComponent(CODE)}`,
      });
      const body = JSON.parse(res.body);

      expect(mockExchange).toHaveBeenCalledWith(CODE);
      expect(mockGetSpotifyUser).toHaveBeenCalledWith(ACCESS_TOKEN);
      expect(mockSaveTokens).toHaveBeenCalled();
      expect(res.statusCode).toBe(201);
      expect(body).toHaveProperty("jwtToken");
      expect(typeof body.jwtToken).toBe("string");
    });

    it("deve retornar 401 quando exchangeCodeForToken for lançado", async () => {
      mockExchange.mockRejectedValue(new Error("spotify fail"));
      const res = await app.inject({
        method: "POST",
        url: `/api/auth/callback?code=${encodeURIComponent(CODE)}`,
      });
      const body = JSON.parse(res.body);

      expect(res.statusCode).toBe(401);
      expect(body).toHaveProperty("message");
    });
  });

  describe("GET /api/auth/me", () => {
    it("deve retornar 401 quando o token estiver ausente ou for inválido", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
      });

      expect(res.statusCode).toBe(401);
    });

    it("deve retornar o usuário quando autenticado", async () => {
      const user = { id: USER_ID, display_name: "User" };
      (getUserFromRedis as jest.Mock).mockResolvedValue(user);
      const jwtToken = await app.jwt.sign({ sub: USER_ID });
      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      const body = JSON.parse(res.body);

      expect(res.statusCode).toBe(200);
      expect(body).toEqual(user);
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("deve retornar 401 se o token estiver faltando", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
      });

      expect(res.statusCode).toBe(401);
    });

    it("deve retornar 200 e jwtToken quando a atualização for bem-sucedida", async () => {
      mockRefresh.mockResolvedValue(true);
      const jwtToken = await app.jwt.sign({ sub: USER_ID });
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      const body = JSON.parse(res.body);

      expect(mockRefresh).toHaveBeenCalledWith(USER_ID);
      expect(res.statusCode).toBe(200);
      expect(body).toHaveProperty("jwtToken");
      expect(typeof body.jwtToken).toBe("string");
    });

    it("deve retornar 401 quando a atualização falhar", async () => {
      mockRefresh.mockRejectedValue(new Error("refresh fail"));
      const jwtToken = await app.jwt.sign({ sub: USER_ID });
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      const body = JSON.parse(res.body);

      expect(res.statusCode).toBe(401);
      expect(body).toHaveProperty("message");
    });
  });
});

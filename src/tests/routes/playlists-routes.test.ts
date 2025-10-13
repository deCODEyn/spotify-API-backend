import type { FastifyInstance } from "fastify";
import { buildTestServer } from "../utils/build-test-server.ts";

jest.mock("../../service/playlist-service.ts", () => ({
  createPlaylist: jest.fn(),
  getUserPlaylists: jest.fn(),
}));

import {
  createPlaylist,
  getUserPlaylists,
} from "../../service/playlist-service.ts";

const mockCreatePlaylist = createPlaylist as jest.Mock;
const mockGetUserPlaylists = getUserPlaylists as jest.Mock;

describe("Playlists routes", () => {
  let app: FastifyInstance;
  const USER_ID = "user123";

  beforeAll(async () => {
    app = await buildTestServer();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/playlists", () => {
    it("deve criar uma nova playlist e retornar 200", async () => {
      const playlist = {
        id: "1",
        name: "My Playlist",
        description: "desc",
        imageUrl: "http://img/1.jpg",
        tracks: 0,
      };
      mockCreatePlaylist.mockResolvedValue(playlist);
      const jwtToken = await app.jwt.sign({ sub: USER_ID });
      const res = await app.inject({
        method: "POST",
        url: "/api/playlists",
        headers: { Authorization: `Bearer ${jwtToken}` },
        payload: { name: "My Playlist", description: "desc" },
      });
      const body = JSON.parse(res.body);

      expect(res.statusCode).toBe(200);
      expect(body).toEqual(playlist);
      expect(mockCreatePlaylist).toHaveBeenCalledWith(USER_ID, {
        name: "My Playlist",
        description: "desc",
      });
    });

    it("deve retornar 401 se não estiver autenticado", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/playlists",
        payload: { name: "My Playlist", description: "desc" },
      });

      expect(res.statusCode).toBe(401);
    });

    it("deve retornar 502 se o service falhar", async () => {
      mockCreatePlaylist.mockRejectedValue(new Error("fail"));
      const jwtToken = await app.jwt.sign({ sub: USER_ID });
      const res = await app.inject({
        method: "POST",
        url: "/api/playlists",
        headers: { Authorization: `Bearer ${jwtToken}` },
        payload: { name: "My Playlist", description: "desc" },
      });
      const body = JSON.parse(res.body);

      expect(res.statusCode).toBe(502);
      expect(body).toHaveProperty("message");
    });
  });

  describe("GET /api/playlists", () => {
    it("deve retornar as playlists do usuário com 200", async () => {
      const playlists = [
        {
          id: "1",
          name: "Playlist 1",
          description: "desc",
          imageUrl: "http://img/1.jpg",
          tracks: 20,
        },
      ];
      mockGetUserPlaylists.mockResolvedValue(playlists);
      const jwtToken = await app.jwt.sign({ sub: USER_ID });
      const res = await app.inject({
        method: "GET",
        url: "/api/playlists",
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      const body = JSON.parse(res.body);

      expect(res.statusCode).toBe(200);
      expect(body).toEqual(playlists);
      expect(mockGetUserPlaylists).toHaveBeenCalledWith(USER_ID);
    });

    it("deve retornar 401 se não estiver autenticado", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/playlists",
      });

      expect(res.statusCode).toBe(401);
    });

    it("deve retornar 502 se o service falhar", async () => {
      mockGetUserPlaylists.mockRejectedValue(new Error("fail"));
      const jwtToken = await app.jwt.sign({ sub: USER_ID });
      const res = await app.inject({
        method: "GET",
        url: "/api/playlists",
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      const body = JSON.parse(res.body);

      expect(res.statusCode).toBe(502);
      expect(body).toHaveProperty("message");
    });
  });
});

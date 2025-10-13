import type { FastifyInstance } from "fastify";

jest.mock("../../service/artists-service.ts", () => ({
  getTopArtists: jest.fn(),
}));

jest.mock("../../service/albums-service.ts", () => ({
  getArtistAlbums: jest.fn(),
}));

import { getArtistAlbums } from "../../service/albums-service.ts";
import { getTopArtists } from "../../service/artists-service.ts";
import { buildTestServer } from "../utils/build-test-server.ts";

const mockGetArtistAlbums = getArtistAlbums as jest.Mock;
const mockGetTopArtists = getTopArtists as jest.Mock;

describe("Artists routes", () => {
  let app: FastifyInstance;
  const USER_ID = "user123";
  const ARTIST_ID = "artist123";

  beforeAll(async () => {
    app = await buildTestServer();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/artists/:artistId/albums", () => {
    it("deve retornar 200 com os álbuns do artista", async () => {
      const albums = [
        {
          id: "1",
          name: "Album 1",
          imageUrl: "http://img/1.jpg",
          releaseDate: "2020-01-01",
          totalTracks: 10,
        },
      ];
      const total = 1;
      mockGetArtistAlbums.mockResolvedValue({ albums, total });
      const jwtToken = await app.jwt.sign({ sub: USER_ID });
      const res = await app.inject({
        method: "GET",
        url: `/api/artists/${ARTIST_ID}/albums?limit=10&offset=0`,
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      const body = JSON.parse(res.body);

      expect(res.statusCode).toBe(200);
      expect(body).toEqual({ albums, total, limit: 10, offset: 0 });
      expect(mockGetArtistAlbums).toHaveBeenCalledWith(
        USER_ID,
        ARTIST_ID,
        10,
        0
      );
    });

    it("deve retornar 401 se não estiver autenticado", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/artists/${ARTIST_ID}/albums`,
      });

      expect(res.statusCode).toBe(401);
    });

    it("deve lançar SpotifyFetchError se falhar", async () => {
      mockGetArtistAlbums.mockRejectedValue(new Error("fail"));
      const jwtToken = await app.jwt.sign({ sub: USER_ID });
      const res = await app.inject({
        method: "GET",
        url: `/api/artists/${ARTIST_ID}/albums`,
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      const body = JSON.parse(res.body);

      expect(res.statusCode).toBe(502);
      expect(body).toHaveProperty("message");
    });
  });

  describe("GET /api/artists", () => {
    it("deve retornar 200 com os top artistas do usuário", async () => {
      const artists = [
        {
          id: "1",
          name: "Artist 1",
          genres: [],
          imageUrl: "http://img/1.jpg",
          followers: 20,
        },
      ];
      mockGetTopArtists.mockResolvedValue(artists);
      const jwtToken = await app.jwt.sign({ sub: USER_ID });
      const res = await app.inject({
        method: "GET",
        url: "/api/artists",
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      const body = JSON.parse(res.body);

      expect(res.statusCode).toBe(200);
      expect(body).toEqual(artists);
      expect(mockGetTopArtists).toHaveBeenCalledWith(USER_ID);
    });

    it("deve retornar 401 se não estiver autenticado", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/artists",
      });

      expect(res.statusCode).toBe(401);
    });

    it("deve lançar SpotifyFetchError se falhar", async () => {
      mockGetTopArtists.mockRejectedValue(new Error("fail"));
      const jwtToken = await app.jwt.sign({ sub: USER_ID });
      const res = await app.inject({
        method: "GET",
        url: "/api/artists",
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      const body = JSON.parse(res.body);

      expect(res.statusCode).toBe(502);
      expect(body).toHaveProperty("message");
    });
  });
});

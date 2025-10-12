import { TOKEN_PREFIX } from "../constants/index.ts";
import { redis } from "../lib/redis.ts";
import {
  fetchAlbumsWithRefresh,
  fetchArtistAlbums,
  getArtistAlbums,
} from "../service/albums-service.ts";
import { withSpotifyAuthRetry } from "../utils/with-spotify-auth-retry.ts";

jest.mock("../utils/with-spotify-auth-retry.ts", () => ({
  withSpotifyAuthRetry: jest.fn(),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as typeof global.fetch;

const mockWithSpotifyAuthRetry = withSpotifyAuthRetry as jest.Mock;

describe("Albums Service", () => {
  const USER_ID = "user123";
  const ARTIST_ID = "artist123";
  const LIMIT = 20;
  const OFFSET = 0;
  const CACHE_KEY = `${TOKEN_PREFIX}${USER_ID}:artist:${ARTIST_ID}:albums:limit${LIMIT}:offset${OFFSET}`;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("fetchArtistAlbums", () => {
    it("deve retornar um response do fetch com Authorization header", async () => {
      const fakeResponse = new Response(JSON.stringify({ ok: true }), {
        status: 200,
      });
      mockFetch.mockResolvedValue(fakeResponse);
      const response = await fetchArtistAlbums(
        "token123",
        ARTIST_ID,
        LIMIT,
        OFFSET
      );
      const url = new URL(mockFetch.mock.calls[0][0]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(url.href).toContain(`/artists/${ARTIST_ID}/albums`);
      expect(url.searchParams.get("limit")).toBe(String(LIMIT));
      expect(url.searchParams.get("offset")).toBe(String(OFFSET));
      expect(mockFetch.mock.calls[0][1]?.headers).toEqual({
        Authorization: "Bearer token123",
      });
      expect(response).toBe(fakeResponse);
    });

    it("retorna erro caso fetch rejeite (Spotify fora)", async () => {
      mockFetch.mockRejectedValue(new Error("Spotify down"));

      await expect(
        fetchArtistAlbums("token123", ARTIST_ID, LIMIT, OFFSET)
      ).rejects.toThrow("Spotify down");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("fetchAlbumsWithRefresh", () => {
    it("deve chama withSpotifyAuthRetry e retorna os dados corretos", async () => {
      mockWithSpotifyAuthRetry.mockImplementation(async () => ({
        json: async () => ({
          items: [
            {
              id: "1",
              name: "Album 1",
              images: [{ url: "http://img/1.jpg" }],
              total_tracks: 10,
              release_date: "2023-01-01",
            },
          ],
          total: 1,
        }),
      }));
      const result = await fetchAlbumsWithRefresh(
        USER_ID,
        ARTIST_ID,
        LIMIT,
        OFFSET
      );

      expect(mockWithSpotifyAuthRetry).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        albums: [
          {
            id: "1",
            name: "Album 1",
            imageUrl: "http://img/1.jpg",
            totalTracks: 10,
            releaseDate: "2023-01-01",
          },
        ],
        total: 1,
      });
    });

    it("deve lançar ZodError para dados mal formatados", async () => {
      mockWithSpotifyAuthRetry.mockResolvedValue({
        json: async () => ({ invalid: "data" }),
      });

      await expect(
        fetchAlbumsWithRefresh(USER_ID, ARTIST_ID)
      ).rejects.toThrow();
      expect(mockWithSpotifyAuthRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe("getArtistAlbums", () => {
    it("deve retornar dados do cache sem chamar fetchAlbumsWithRefresh", async () => {
      const cachedData = { albums: [], total: 0 };
      (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedData));
      const result = await getArtistAlbums(USER_ID, ARTIST_ID, LIMIT, OFFSET);

      expect(redis.get).toHaveBeenCalledTimes(1);
      expect(redis.get).toHaveBeenCalledWith(CACHE_KEY);
      expect(redis.setex).not.toHaveBeenCalled();
      expect(mockWithSpotifyAuthRetry).not.toHaveBeenCalled();
      expect(result).toEqual(cachedData);
    });

    it("deve chamar fetchAlbumsWithRefresh se não houver cache e armazenar o resultado", async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      mockWithSpotifyAuthRetry.mockImplementation(async () => ({
        json: async () => ({
          items: [
            {
              id: "1",
              name: "Album 1",
              images: [{ url: "http://img/1.jpg" }],
              total_tracks: 10,
              release_date: "2023-01-01",
            },
          ],
          total: 1,
        }),
      }));
      const result = await getArtistAlbums(USER_ID, ARTIST_ID, LIMIT, OFFSET);

      expect(redis.get).toHaveBeenCalledTimes(1);
      expect(mockWithSpotifyAuthRetry).toHaveBeenCalledTimes(1);
      expect(redis.setex).toHaveBeenCalledTimes(1);
      expect(result.albums[0].id).toBe("1");
      expect(result.total).toBe(1);
    });

    it("deve passar corretamente limit e offset para fetchAlbumsWithRefresh", async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      mockWithSpotifyAuthRetry.mockImplementation(async () => ({
        json: async () => ({
          items: [],
          total: 0,
        }),
      }));
      await getArtistAlbums(USER_ID, ARTIST_ID, 50, 100);

      expect(withSpotifyAuthRetry).toHaveBeenCalledTimes(1);
    });

    it("deve lançar erro se fetchAlbumsWithRefresh falhar", async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      mockWithSpotifyAuthRetry.mockResolvedValue({
        json: async () => ({ invalid: "data" }),
      });

      await expect(
        getArtistAlbums(USER_ID, ARTIST_ID, LIMIT, OFFSET)
      ).rejects.toThrow();
    });
  });
});

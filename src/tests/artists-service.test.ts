import { TOKEN_PREFIX } from "../constants/index.ts";
import { redis } from "../lib/redis.ts";
import {
  fetchArtists,
  fetchArtistsWithRefresh,
  getTopArtists,
} from "../service/artists-service.ts";
import { withSpotifyAuthRetry } from "../utils/with-spotify-auth-retry.ts";

jest.mock("../utils/with-spotify-auth-retry.ts", () => ({
  withSpotifyAuthRetry: jest.fn(),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as typeof global.fetch;

const mockWithSpotifyAuthRetry = withSpotifyAuthRetry as jest.Mock;

describe("Artists Service", () => {
  const USER_ID = "user123";
  const CACHE_KEY = `${TOKEN_PREFIX}${USER_ID}:top-artists`;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("fetchArtists", () => {
    it("deve retornar um response do fetch com Authorization header", async () => {
      const fakeResponse = new Response(JSON.stringify({ ok: true }), {
        status: 200,
      });
      mockFetch.mockResolvedValue(fakeResponse);
      const response = await fetchArtists("token123");
      const url = new URL(mockFetch.mock.calls[0][0]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(url.href).toBe("https://api.spotify.com/v1/me/top/artists");
      expect(mockFetch.mock.calls[0][1]?.headers).toEqual({
        Authorization: "Bearer token123",
      });
      expect(response).toBe(fakeResponse);
    });

    it("deve retornar erro caso fetch rejeite (Spotify fora)", async () => {
      mockFetch.mockRejectedValue(new Error("Spotify down"));

      await expect(fetchArtists("token123")).rejects.toThrow("Spotify down");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("fetchArtistsWithRefresh", () => {
    it("deve chamar withSpotifyAuthRetry e retornar os dados corretos", async () => {
      mockWithSpotifyAuthRetry.mockImplementation(async () => ({
        json: async () => ({
          items: [
            {
              id: "1",
              name: "Artist 1",
              genres: ["pop"],
              images: [{ url: "http://img/1.jpg" }],
              followers: { total: 100 },
            },
          ],
        }),
      }));
      const result = await fetchArtistsWithRefresh(USER_ID);

      expect(mockWithSpotifyAuthRetry).toHaveBeenCalledTimes(1);
      expect(result).toEqual([
        {
          id: "1",
          name: "Artist 1",
          genres: ["pop"],
          imageUrl: "http://img/1.jpg",
          followers: 100,
        },
      ]);
    });

    it("deve lançar ZodError para dados mal formatados", async () => {
      mockWithSpotifyAuthRetry.mockResolvedValue({
        json: async () => ({ invalid: "data" }),
      });

      await expect(fetchArtistsWithRefresh(USER_ID)).rejects.toThrow();
      expect(mockWithSpotifyAuthRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe("getTopArtists", () => {
    it("deve retornar dados do cache sem chamar fetchArtistsWithRefresh", async () => {
      const cachedData = [
        { id: "1", name: "Artist 1", genres: [], imageUrl: null, followers: 0 },
      ];
      (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedData));
      const result = await getTopArtists(USER_ID);

      expect(redis.get).toHaveBeenCalledTimes(1);
      expect(redis.get).toHaveBeenCalledWith(CACHE_KEY);
      expect(redis.setex).not.toHaveBeenCalled();
      expect(mockWithSpotifyAuthRetry).not.toHaveBeenCalled();
      expect(result).toEqual(cachedData);
    });

    it("deve chamar fetchArtistsWithRefresh se não houver cache e armazenar o resultado", async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      mockWithSpotifyAuthRetry.mockImplementation(async () => ({
        json: async () => ({
          items: [
            {
              id: "1",
              name: "Artist 1",
              genres: ["pop"],
              images: [{ url: "http://img/1.jpg" }],
              followers: { total: 100 },
            },
          ],
        }),
      }));
      const result = await getTopArtists(USER_ID);

      expect(redis.get).toHaveBeenCalledTimes(1);
      expect(mockWithSpotifyAuthRetry).toHaveBeenCalledTimes(1);
      expect(redis.setex).toHaveBeenCalledTimes(1);
      expect(result[0].id).toBe("1");
      expect(result[0].name).toBe("Artist 1");
    });

    it("deve lançar erro se fetchArtistsWithRefresh falhar", async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      mockWithSpotifyAuthRetry.mockResolvedValue({
        json: async () => ({ invalid: "data" }),
      });

      await expect(getTopArtists(USER_ID)).rejects.toThrow();
    });
  });
});

import { TOKEN_PREFIX } from "../constants/index.ts";
import { redis } from "../lib/redis.ts";
import {
  createPlaylist,
  fetchCreatePlaylist,
  fetchPlaylists,
  fetchPlaylistsWithRefresh,
  getUserPlaylists,
} from "../service/playlist-service.ts";
import { withSpotifyAuthRetry } from "../utils/with-spotify-auth-retry.ts";

jest.mock("../utils/with-spotify-auth-retry.ts", () => ({
  withSpotifyAuthRetry: jest.fn(),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as typeof global.fetch;

const mockWithSpotifyAuthRetry = withSpotifyAuthRetry as jest.Mock;
const body = { name: "Nova Playlist", description: "desc", public: false };

describe("Playlist Service", () => {
  const USER_ID = "user123";
  const CACHE_KEY = `${TOKEN_PREFIX}${USER_ID}:playlists`;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("fetchPlaylists", () => {
    it("deve retornar um response do fetch com Authorization header", async () => {
      const fakeResponse = new Response(JSON.stringify({ ok: true }), {
        status: 200,
      });
      mockFetch.mockResolvedValue(fakeResponse);
      const response = await fetchPlaylists("token123");
      const url = new URL(mockFetch.mock.calls[0][0]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(url.href).toBe("https://api.spotify.com/v1/me/playlists");
      expect(mockFetch.mock.calls[0][1]?.headers).toEqual({
        Authorization: "Bearer token123",
      });
      expect(response).toBe(fakeResponse);
    });

    it("deve retornar erro caso fetch rejeite (Spotify fora)", async () => {
      mockFetch.mockRejectedValue(new Error("Spotify down"));

      await expect(fetchPlaylists("token123")).rejects.toThrow("Spotify down");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("fetchCreatePlaylist", () => {
    it("deve chamar fetch POST corretamente", async () => {
      const fakeResponse = new Response(JSON.stringify({ ok: true }), {
        status: 201,
      });
      mockFetch.mockResolvedValue(fakeResponse);
      const response = await fetchCreatePlaylist("token123", USER_ID, body);
      const [url, options] = mockFetch.mock.calls[0];

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(url).toBe(`https://api.spotify.com/v1/users/${USER_ID}/playlists`);
      expect(options.method).toBe("POST");
      expect(options.headers).toEqual({
        Authorization: "Bearer token123",
        "Content-Type": "application/json",
      });
      expect(JSON.parse(options.body)).toEqual(body);
      expect(response).toBe(fakeResponse);
    });

    it("deve retornar erro caso fetch rejeite (Spotify fora)", async () => {
      mockFetch.mockRejectedValue(new Error("Spotify down"));

      await expect(
        fetchCreatePlaylist("token123", USER_ID, body)
      ).rejects.toThrow("Spotify down");
    });
  });

  describe("fetchPlaylistsWithRefresh", () => {
    it("deve chamar withSpotifyAuthRetry e retornar os dados corretos", async () => {
      mockWithSpotifyAuthRetry.mockImplementation(async () => ({
        json: async () => ({
          items: [
            {
              id: "1",
              name: "Playlist 1",
              description: "desc",
              images: [{ url: "http://img/1.jpg" }],
              tracks: { total: 10 },
            },
          ],
        }),
      }));
      const result = await fetchPlaylistsWithRefresh(USER_ID);

      expect(mockWithSpotifyAuthRetry).toHaveBeenCalledTimes(1);
      expect(result).toEqual([
        {
          id: "1",
          name: "Playlist 1",
          description: "desc",
          imageUrl: "http://img/1.jpg",
          tracks: 10,
        },
      ]);
    });

    it("deve lançar ZodError para dados mal formatados", async () => {
      mockWithSpotifyAuthRetry.mockResolvedValue({
        json: async () => ({ invalid: "data" }),
      });

      await expect(fetchPlaylistsWithRefresh(USER_ID)).rejects.toThrow();
      expect(mockWithSpotifyAuthRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe("getUserPlaylists", () => {
    it("deve retornar dados do cache sem chamar fetchPlaylistsWithRefresh", async () => {
      const cachedData = [
        {
          id: "1",
          name: "Playlist 1",
          description: null,
          imageUrl: null,
          tracks: 0,
        },
      ];
      (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedData));
      const result = await getUserPlaylists(USER_ID);

      expect(redis.get).toHaveBeenCalledTimes(1);
      expect(redis.get).toHaveBeenCalledWith(CACHE_KEY);
      expect(redis.setex).not.toHaveBeenCalled();
      expect(mockWithSpotifyAuthRetry).not.toHaveBeenCalled();
      expect(result).toEqual(cachedData);
    });

    it("deve chamar fetchPlaylistsWithRefresh se não houver cache e armazenar o resultado", async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      mockWithSpotifyAuthRetry.mockImplementation(async () => ({
        json: async () => ({
          items: [
            {
              id: "1",
              name: "Playlist 1",
              description: "desc",
              images: [{ url: "http://img/1.jpg" }],
              tracks: { total: 10 },
            },
          ],
        }),
      }));
      const result = await getUserPlaylists(USER_ID);

      expect(redis.get).toHaveBeenCalledTimes(1);
      expect(mockWithSpotifyAuthRetry).toHaveBeenCalledTimes(1);
      expect(redis.setex).toHaveBeenCalledTimes(1);
      expect(result[0].id).toBe("1");
      expect(result[0].name).toBe("Playlist 1");
    });

    it("deve lançar erro se fetchPlaylistsWithRefresh falhar", async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      mockWithSpotifyAuthRetry.mockResolvedValue({
        json: async () => ({ invalid: "data" }),
      });

      await expect(getUserPlaylists(USER_ID)).rejects.toThrow();
    });
  });

  describe("createPlaylist", () => {
    it("deve criar playlist e retornar dados corretos", async () => {
      mockWithSpotifyAuthRetry.mockImplementation(async () => ({
        json: async () => ({
          id: "1",
          name: "Nova Playlist",
          description: "desc",
          images: [{ url: "http://img/1.jpg" }],
          tracks: { total: 0 },
        }),
      }));
      const result = await createPlaylist(USER_ID, body);

      expect(mockWithSpotifyAuthRetry).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        id: "1",
        name: "Nova Playlist",
        description: "desc",
        imageUrl: "http://img/1.jpg",
        tracks: 0,
      });
    });

    it("deve lançar erro se dados mal formatados forem passados", async () => {
      const invalidBody = { name: "", description: "desc" };

      await expect(createPlaylist(USER_ID, invalidBody)).rejects.toThrow();
    });

    it("deve lançar erro se fetchCreatePlaylist falhar", async () => {
      mockWithSpotifyAuthRetry.mockRejectedValue(new Error("Fail"));

      await expect(createPlaylist(USER_ID, body)).rejects.toThrow("Fail");
    });
  });
});

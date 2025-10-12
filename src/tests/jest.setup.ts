jest.mock("../env.ts", () => ({
  env: {
    SPOTIFY_CLIENT_ID: "dummy",
    SPOTIFY_CLIENT_SECRET: "dummy",
    SPOTIFY_REDIRECT_URI: "http://localhost",
    REDIS_HOST: "localhost",
    REDIS_PASSWORD: "dummy",
    JWT_SECRET: "secret",
  },
}));

jest.mock("../lib/redis.ts", () => ({
  redis: { get: jest.fn(), setex: jest.fn(), set: jest.fn(), del: jest.fn() },
}));

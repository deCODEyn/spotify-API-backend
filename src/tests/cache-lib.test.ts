import { cacheGetOrSet } from "../lib/cache.ts";
import { redis } from "../lib/redis.ts";

jest.mock("../lib/redis.ts");

describe("cacheGetOrSet", () => {
  const KEY = "key123";
  const VALUE = { name: "Test" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deve retornar valor do cache se existir", async () => {
    (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(VALUE));

    const result = await cacheGetOrSet(KEY, jest.fn());

    expect(result).toEqual(VALUE);
    expect(redis.get).toHaveBeenCalledWith(KEY);
  });

  it("deve chamar fetchFn e salvar no cache se não existir", async () => {
    (redis.get as jest.Mock).mockResolvedValue(null);
    const fetchFn = jest.fn().mockResolvedValue(VALUE);

    const result = await cacheGetOrSet(KEY, fetchFn, 120);

    expect(fetchFn).toHaveBeenCalled();
    expect(redis.set).toHaveBeenCalledWith(
      KEY,
      JSON.stringify(VALUE),
      "EX",
      120
    );
    expect(result).toEqual(VALUE);
  });

  it("deve deletar cache corrompido e continuar", async () => {
    (redis.get as jest.Mock).mockResolvedValue("invalid json");
    const fetchFn = jest.fn().mockResolvedValue(VALUE);

    const result = await cacheGetOrSet(KEY, fetchFn);

    expect(redis.del).toHaveBeenCalledWith(KEY);
    expect(redis.set).toHaveBeenCalledWith(
      KEY,
      JSON.stringify(VALUE),
      "EX",
      60
    );
    expect(result).toEqual(VALUE);
  });
});

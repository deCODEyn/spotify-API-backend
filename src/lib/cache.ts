import { redis } from "./redis.ts";

export async function cacheGetOrSet<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl = 60 // 60 segundos
): Promise<T> {
  const cached = await redis.get(key);

  if (cached) {
    try {
      return JSON.parse(cached) as T;
    } catch {
      // se o cache estiver corrompido, apaga e continua
      await redis.del(key);
    }
  }

  // Se não encontrou, busca e salva
  const freshData = await fetchFn();
  await redis.set(key, JSON.stringify(freshData), "EX", ttl);

  return freshData;
}

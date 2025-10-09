import { z } from "zod";
import { env } from "../env.ts";
import { redis } from "../lib/redis.ts";

const tokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
});

export async function exchangeCodeForToken(code: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: env.SPOTIFY_REDIRECT_URI,
    client_id: env.SPOTIFY_CLIENT_ID,
    client_secret: env.SPOTIFY_CLIENT_SECRET,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error("Failed to exchange code for token");
  }

  const data = await response.json();
  const { access_token, refresh_token, expires_in } = tokenSchema.parse(data);

  await redis.set(
    `spotify:token:${access_token}`,
    JSON.stringify({ access_token, refresh_token }),
    "EX",
    expires_in
  );

  return { access_token, refresh_token, expires_in };
}

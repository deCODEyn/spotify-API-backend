import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { env } from "../../env.ts";

export function authRoute(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/auth/login",
    {
      schema: {
        summary: "Redirecionamento para autenticação no Spotify.",
        tags: ["Auth"],
        respose: { 200: z.object({ spotifyUrl: z.url() }) },
      },
    },
    (_request, reply) => {
      const clientId = env.SPOTIFY_CLIENT_ID;
      const redirectUri = env.SPOTIFY_REDIRECT_URI;
      const scopes = [
        "user-read-private",
        "user-read-email",
        "user-top-read",
        "playlist-read-private",
        "playlist-modify-public",
        "playlist-modify-private",
      ].join(" ");

      const params = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        redirect_uri: redirectUri,
        scope: scopes,
      });

      const spotifyAuthUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;

      return reply.status(200).send({ spotifyUrl: spotifyAuthUrl });
    }
  );
}

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { SpotifyFetchError } from "../../errors/spotify-fetch-error.ts";
import { getUserId } from "../../middleware/get-user-id.ts";
import {
  createPlaylistBodySchema,
  simplifiedPlaylistSchema,
} from "../../schemas/playlist-schemas.ts";
import { createPlaylist } from "../../service/playlist-service.ts";

export function createPlaylistRoute(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(getUserId)
    .post(
      "/playlists",
      {
        schema: {
          summary: "Usuário pode criar uma nova playlist.",
          tags: ["Playlists"],
          security: [{ bearerAuth: [] }],
          body: createPlaylistBodySchema,
          response: {
            200: simplifiedPlaylistSchema,
            401: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        try {
          const userId = request.userId;
          const playlist = await createPlaylist(userId, request.body);

          return reply.status(200).send(playlist);
        } catch (error) {
          app.log.error({ err: error }, "Falha ao criar playlist do usuário.");
          throw new SpotifyFetchError("Falha ao criar playlist do usuário.");
        }
      }
    );
}

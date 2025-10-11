import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { SpotifyFetchError } from "../../errors/spotify-fetch-error.ts";
import { getUserId } from "../../middleware/get-user-id.ts";
import { getUserPlaylists } from "../../service/playlist-service.ts";

export function getUserPlaylistsRoute(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(getUserId)
    .get(
      "/playlists",
      {
        schema: {
          summary: "Retorna as playlists do usuário autenticado.",
          tags: ["Playlists"],
          security: [{ bearerAuth: [] }],
          response: {
            200: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                description: z.string().nullable(),
                imageUrl: z.string().nullable(),
                totalTracks: z.number(),
              })
            ),
            401: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        try {
          const userId = request.userId;
          const playlists = await getUserPlaylists(userId);

          return reply.status(200).send(playlists);
        } catch (error) {
          app.log.error(
            { err: error },
            "Falha ao buscar playlists do usuário."
          );
          throw new SpotifyFetchError("Falha ao buscar playlists do usuário.");
        }
      }
    );
}

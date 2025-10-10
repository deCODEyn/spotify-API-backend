import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { SpotifyFetchError } from "../../errors/spotify-fetch-error.ts";
import { getUserId } from "../../middleware/get-user-id.ts";
import { getArtistAlbums } from "../../service/albums-service.ts";

export function getArtistAlbumsRoute(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(getUserId)
    .get(
      "/artists/:artistId/albums",
      {
        schema: {
          summary: "Retorna os álbuns de um artista (paginação).",
          tags: ["Artists"],
          security: [{ bearerAuth: [] }],
          querystring: z.object({
            limit: z.string().optional(),
            offset: z.string().optional(),
          }),
          params: z.object({ artistId: z.string() }),
          response: {
            200: z.object({
              albums: z.array(
                z.object({
                  id: z.string(),
                  name: z.string(),
                  releaseDate: z.string(),
                  totalTracks: z.number(),
                  imageUrl: z.string().nullable(),
                })
              ),
              total: z.number(),
              limit: z.number(),
              offset: z.number(),
            }),
            401: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        try {
          const userId = request.userId;
          const artistId = request.params.artistId;
          const limit = Number(request.query.limit) || 20;
          const offset = Number(request.query.offset) || 0;

          const data = await getArtistAlbums(userId, artistId, limit, offset);
          return reply.status(200).send(data);
        } catch (error) {
          app.log.error({ err: error }, "Falha ao buscar álbuns do artista.");
          throw new SpotifyFetchError("Falha ao buscar álbuns do artista.");
        }
      }
    );
}

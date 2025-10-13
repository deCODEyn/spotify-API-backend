import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { SpotifyFetchError } from "../../errors/spotify-fetch-error.ts";
import { getUserId } from "../../middleware/get-user-id.ts";
import { simplifiedArtistSchema } from "../../schemas/artists-schemas.ts";
import { getTopArtists } from "../../service/artists-service.ts";

export function getTopArtistsRoute(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(getUserId)
    .get(
      "/artists",
      {
        schema: {
          summary: "Retorna o top artistas do usuário autenticado.",
          tags: ["Artists"],
          security: [{ bearerAuth: [] }],
          response: {
            200: z.array(simplifiedArtistSchema),
            502: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        try {
          const userId = request.userId;
          const artists = await getTopArtists(userId);

          return reply.status(200).send(artists);
        } catch (error) {
          app.log.error(
            { err: error },
            "Falha ao fazer o refresh_token do usuário."
          );
          throw new SpotifyFetchError("Falha ao buscar os top artistas.");
        }
      }
    );
}

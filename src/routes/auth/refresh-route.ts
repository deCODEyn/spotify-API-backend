import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { UnauthorizedError } from "../../errors/unauthorized-error.ts";
import { getUserId } from "../../middleware/get-user-id.ts";
import { refreshSpotifyToken } from "../../service/auth-service.ts";

export function refreshRoute(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(getUserId)
    .post(
      "/auth/refresh",
      {
        schema: {
          summary: "Atualiza token de acesso Spotify",
          tags: ["Auth"],
          security: [{ bearerAuth: [] }],
          response: {
            200: z.object({ jwtToken: z.string() }),
            401: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        try {
          const userId = request.userId;
          await refreshSpotifyToken(userId);

          const jwtToken = await reply.jwtSign(
            { sub: userId },
            { sign: { expiresIn: "1d" } }
          );

          return reply.status(200).send({ jwtToken });
        } catch (error) {
          app.log.error(
            { err: error },
            "Falha ao fazer o refresh_token do usuário."
          );
          throw new UnauthorizedError("Falha ao atualizar o token.");
        }
      }
    );
}

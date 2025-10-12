import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { UnauthorizedError } from "../../errors/unauthorized-error.ts";
import { getUserId } from "../../middleware/get-user-id.ts";
import { userSchema } from "../../schemas/auth-schemas.ts";
import { getUserFromRedis } from "../../service/auth-service.ts";

export function getMeRoute(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(getUserId)
    .get(
      "/auth/me",
      {
        schema: {
          summary: "Retorna dados de usuário",
          tags: ["Auth"],
          security: [{ bearerAuth: [] }],
          response: {
            200: userSchema,
            401: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        try {
          const userId = request.userId;
          const user = await getUserFromRedis(userId);

          return reply.status(200).send(user);
        } catch (error) {
          app.log.error(
            { err: error },
            "Falha ao buscar dados do usuário no Redis."
          );
          throw new UnauthorizedError("Usuário não autenticado.");
        }
      }
    );
}

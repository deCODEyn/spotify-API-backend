import type { FastifyInstance } from "fastify";
import fastifyPlugin from "fastify-plugin";
import { UnauthorizedError } from "../errors/unauthorized-error.ts";

export const getUserId = fastifyPlugin((app: FastifyInstance) => {
  app.addHook("preHandler", async (request, _reply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      request.userId = payload.sub;
    } catch (error) {
      app.log.error({ err: error }, "Falha no middleware getUserId");
      throw new UnauthorizedError("Token de autenticação inválido ou expirado");
    }
  });
});

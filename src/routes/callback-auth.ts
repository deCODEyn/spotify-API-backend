import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { exchangeCodeForToken } from "../service/auth-service.ts";

export function callbackAuth(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/auth/callback",
    {
      schema: {
        summary: "Recebe código spotify e converte em token de autenticação.",
        tags: ["Auth"],
        querystring: z.object({ code: z.string() }),
        response: { 201: z.object({ token: z.string() }) },
      },
    },
    async (request, reply) => {
      const { code } = request.query;
      if (!code) {
        throw new Error("Validação do spotify não localizada");
      }

      try {
        await exchangeCodeForToken(code);
        const token = await reply.jwtSign(
          { sub: code },
          { sign: { expiresIn: "8h" } }
        );
        return reply.status(201).send({ token });
      } catch {
        throw new Error("Falha na autenticação com Spotify");
      }
    }
  );
}

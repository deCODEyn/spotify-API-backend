import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

export function healthCheck(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/health",
    {
      schema: {
        summary: "Rota para verificação de status da API.",
        tags: ["Healh Check"],
        response: { 200: z.string() },
      },
    },
    async () => "Health check OK"
  );
}

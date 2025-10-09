import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

export async function helthCheck(app: FastifyInstance) {
	app.withTypeProvider<ZodTypeProvider>().get(
		"/api/health",
		{
			schema: {
				summary: "Health check",
				tags: ["Healh Check"],
				response: {
					200: z.string(),
				},
			},
		},
		async () => {
			return "Health check OK";
		},
	);
}

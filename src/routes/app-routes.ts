import type { FastifyInstance } from "fastify";
import { authRoute } from "./auth-route.ts";
import { healthCheck } from "./health.ts";

export function appRoutes(app: FastifyInstance) {
	app.register(
		(routes) => {
			routes.register(healthCheck);
			routes.register(authRoute);
		},
		{ prefix: "/api" },
	);
}

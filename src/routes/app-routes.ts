import type { FastifyInstance } from "fastify";
import { authRoute } from "./auth/auth-route.ts";
import { callbackRoute } from "./auth/callback-route.ts";
import { getMeRoute } from "./auth/get-me-route.ts";
import { refreshRoute } from "./auth/refresh-route.ts";
import { healthCheck } from "./health.ts";

export function appRoutes(app: FastifyInstance) {
  app.register(
    (routes) => {
      routes.register(healthCheck);
      routes.register(authRoute);
      routes.register(callbackRoute);
      routes.register(getMeRoute);
      routes.register(refreshRoute);
    },
    { prefix: "/api" }
  );
}

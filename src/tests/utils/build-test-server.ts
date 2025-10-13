import fastifyJwt from "@fastify/jwt";
import fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { env } from "../../env.ts";
import { errorHandler } from "../../errors/_error-handler.ts";
import { getArtistAlbumsRoute } from "../../routes/artists/get-artist-albums-route.ts";
import { getTopArtistsRoute } from "../../routes/artists/get-top-artists-route.ts";
import { authRoute } from "../../routes/auth/auth-route.ts";
import { callbackRoute } from "../../routes/auth/callback-route.ts";
import { getMeRoute } from "../../routes/auth/get-me-route.ts";
import { refreshRoute } from "../../routes/auth/refresh-route.ts";
import { createPlaylistRoute } from "../../routes/playlists/create-playlist-route.ts";
import { getUserPlaylistsRoute } from "../../routes/playlists/get-user-playlists-route.ts";

export async function buildTestServer() {
  const app = fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

  app.register(fastifyJwt, { secret: env.JWT_SECRET });

  app.setSerializerCompiler(serializerCompiler);
  app.setValidatorCompiler(validatorCompiler);
  app.setErrorHandler(errorHandler);

  app.register(
    (routes) => {
      routes.register(authRoute);
      routes.register(callbackRoute);
      routes.register(getMeRoute);
      routes.register(refreshRoute);

      routes.register(getTopArtistsRoute);
      routes.register(getArtistAlbumsRoute);

      routes.register(createPlaylistRoute);
      routes.register(getUserPlaylistsRoute);
    },
    { prefix: "/api" }
  );

  await app.ready();

  return app;
}

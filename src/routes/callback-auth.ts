import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { BadRequestError } from "../errors/bad-request-error.ts";
import { UnauthorizedError } from "../errors/unauthorized-error.ts";
import {
  exchangeCodeForToken,
  getSpotifyUser,
  saveTokensAndUser,
} from "../service/auth-service.ts";

export function callbackAuth(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/auth/callback",
    {
      schema: {
        summary: "Recebe code spotify e converte em token de autenticação.",
        tags: ["Auth"],
        querystring: z.object({ code: z.string() }),
        response: {
          201: z.object({ jwtToken: z.string() }),
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { code } = request.query;
      if (!code) {
        throw new BadRequestError("Validação do spotify não localizada");
      }

      try {
        const spotifyTokens = await exchangeCodeForToken(code);
        const spotifyUser = await getSpotifyUser(spotifyTokens.access_token);
        await saveTokensAndUser(spotifyUser, spotifyTokens);

        const jwtToken = await reply.jwtSign(
          { sub: spotifyUser.userId },
          { sign: { expiresIn: "1d" } }
        );

        return reply.status(201).send({ jwtToken });
      } catch (error) {
        app.log.error(error);
        throw new UnauthorizedError("Falha na autenticação com Spotify");
      }
    }
  );
}

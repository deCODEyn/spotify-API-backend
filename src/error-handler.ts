import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { BadRequestError } from "./errors/bad-request-error.ts";
import { NotFoundError } from "./errors/not-found-error.ts";
import { UnauthorizedError } from "./errors/unauthorized-error.ts";

type fastifyErrorHandler = FastifyInstance["errorHandler"];

export const errorHandler: fastifyErrorHandler = (error, _request, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: "Validation error",
      errors: error.flatten((err) => err.message).fieldErrors,
    });
  }

  if (error instanceof BadRequestError) {
    return reply.status(400).send({ message: error.message });
  }

  if (error instanceof UnauthorizedError) {
    return reply.status(401).send({ message: error.message });
  }

  if (error instanceof NotFoundError) {
    return reply.status(404).send({ message: error.message });
  }

  return reply.status(500).send({ message: "Internal server error." });
};

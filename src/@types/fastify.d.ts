/** biome-ignore-all lint/nursery/useConsistentTypeDefinitions: <Extends interface fastify> */
import "fastify";

declare module "fastify" {
  export interface FastifyRequest {
    userId: string;
  }
}

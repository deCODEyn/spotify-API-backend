import fastifyCors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastify from "fastify";
import {
	jsonSchemaTransform,
	serializerCompiler,
	validatorCompiler,
	type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { env } from "./env.ts";
import { helthCheck } from "./routes/health.ts";

const port = env.PORT;
const app = fastify().withTypeProvider<ZodTypeProvider>();

app.register(fastifyCors, {
	origin: ["https://localhost:5173", "https://127.0.0.1:5173"],
});

app.setSerializerCompiler(serializerCompiler);
app.setValidatorCompiler(validatorCompiler);

app.register(fastifySwagger, {
	openapi: {
		info: {
			title: "Spotify API",
			description:
				"App para conexão a API do spotify com controle de artistas e playlists.",
			version: "1.0.0",
		},
		servers: [],
		components: {
			securitySchemes: {
				bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
			},
		},
	},
	transform: jsonSchemaTransform,
});
app.register(fastifySwaggerUi, { routePrefix: "/api/docs" });

app.register(helthCheck);

app.listen({ port, host: "0.0.0.0" });
console.log("Server listen in port:", port);

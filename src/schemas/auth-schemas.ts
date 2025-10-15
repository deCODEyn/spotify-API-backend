import { z } from "zod";

export const tokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
});
export type TokenSchema = z.infer<typeof tokenSchema>;

export const userSchemaSpotifyResponse = z.object({
  id: z.string(),
  display_name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  images: z
    .array(z.object({ url: z.string() }))
    .nullable()
    .transform((val) => val ?? []),
});

export const userSchema = z.object({
  id: z.string(),
  display_name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  imageUrl: z.string().nullable(),
});
export type UserSchema = z.infer<typeof userSchema>;

export const redisStoredSchema = z.object({
  ...userSchema.shape,
  ...tokenSchema.shape,
  expires_at: z.number(),
});
export type RedisStored = z.infer<typeof redisStoredSchema>;

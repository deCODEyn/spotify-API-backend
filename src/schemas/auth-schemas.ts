import { z } from "zod";

export const tokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
});
export type TokenSchema = z.infer<typeof tokenSchema>;

export const userSchema = z.object({
  userId: z.string(),
  display_name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});
export type UserSchema = z.infer<typeof userSchema>;

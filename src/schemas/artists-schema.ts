import { z } from "zod";

const spotifyArtistSchema = z.object({
  id: z.string(),
  name: z.string(),
  genres: z.array(z.string()).default([]),
  images: z.array(z.object({ url: z.string() })).default([]),
  followers: z.object({ total: z.number() }),
});

export const spotifyTopArtistsResponseSchema = z.object({
  items: z.array(spotifyArtistSchema),
});

export const simplifiedArtistSchema = z.object({
  id: z.string(),
  name: z.string(),
  genres: z.array(z.string()),
  imageUrl: z.string().nullable(),
  followers: z.number(),
});

export type SimplifiedArtist = z.infer<typeof simplifiedArtistSchema>;

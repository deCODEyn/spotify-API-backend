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

export const spotifyAlbumsResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      images: z.array(z.object({ url: z.string() })).default([]),
      total_tracks: z.number(),
      release_date: z.string(),
    })
  ),
  total: z.number(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  href: z.string().optional(),
  next: z.string().nullable().optional(),
  previous: z.string().nullable().optional(),
});

export const simplifiedAlbumSchema = z.object({
  id: z.string(),
  name: z.string(),
  imageUrl: z.string().nullable(),
  totalTracks: z.number(),
  releaseDate: z.string(),
});

export type SimplifiedAlbum = z.infer<typeof simplifiedAlbumSchema>;

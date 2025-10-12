import { z } from "zod";

export const spotifyPlaylistsResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      images: z
        .array(z.object({ url: z.string() }))
        .nullable()
        .transform((val) => val ?? []),
      tracks: z
        .object({ total: z.number() })
        .nullable()
        .optional()
        .transform((val) => ({ total: val?.total ?? 0 })),
    })
  ),
});

export const simplifiedPlaylistSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  tracks: z.number(),
});

export type SimplifiedPlaylist = z.infer<typeof simplifiedPlaylistSchema>;

export const createPlaylistBodySchema = z.object({
  name: z.string().min(1, "Name não pode ser vazio"),
  description: z.string().optional(),
  public: z.boolean().optional(),
});

export type CreatePlaylistBody = z.infer<typeof createPlaylistBodySchema>;

import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// One review per markdown file: frontmatter carries the attribution and
// rating, the body is the quote. The Reviews section shows its placeholder
// bubble while this folder is empty and renders these once it isn't.
const reviews = defineCollection({
    loader: glob({ pattern: "*.md", base: "./src/content/reviews" }),
    schema: z.object({
        name: z.string(),
        credential: z.string(),
        stars: z.number().int().min(1).max(5),
        date: z.coerce.date(),
    }),
});

export const collections = { reviews };

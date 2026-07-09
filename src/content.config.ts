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

// One research article per markdown file: frontmatter carries the listing
// metadata, the body is the article. Rendered at /research/<filename>.
const articles = defineCollection({
    loader: glob({ pattern: "*.md", base: "./src/content/articles" }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        date: z.coerce.date(),
        author: z.string().optional(),
    }),
});

export const collections = { reviews, articles };

import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export const GET: APIRoute = async (context) => {
    const articles = (await getCollection("articles")).sort(
        (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
    );

    return rss({
        title: "Consultologist Research",
        description:
            "Evidence and analysis on AI-assisted clinical documentation: scribe accuracy, specialist workflows, and what the published evaluations actually show.",
        site: context.site!,
        items: articles.map((article) => ({
            title: article.data.title,
            description: article.data.description,
            pubDate: article.data.date,
            link: `/research/${article.id}`,
        })),
    });
};

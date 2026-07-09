// Corpus-wide JSON-LD graph of the research articles, so agents can read the
// site's structured data in one request instead of crawling every page.
// Listed in /schemamap.xml.

import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { articleNode, graph, organizationNode, webSiteNode } from "../../lib/schema";

export const GET: APIRoute = async () => {
    const articles = (await getCollection("articles")).sort(
        (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
    );

    const body = graph(organizationNode(), webSiteNode(), ...articles.map(articleNode));

    return new Response(JSON.stringify(body, null, 2), {
        headers: { "Content-Type": "application/ld+json" },
    });
};

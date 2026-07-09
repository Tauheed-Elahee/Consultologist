// Sitemap-style discovery point for the site's JSON-LD endpoints, following
// the seo-graph convention (sitemap namespace, structuredData content type).
// Referenced from robots.txt via the Schemamap: line.

import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { SITE } from "../lib/schema";

export const GET: APIRoute = async () => {
    const articles = await getCollection("articles");
    const lastmod = articles.length
        ? new Date(Math.max(...articles.map((a) => a.data.date.valueOf())))
        : new Date();

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url contentType="structuredData/schema.org">
    <loc>${SITE}/schema/articles.json</loc>
    <lastmod>${lastmod.toISOString().split("T")[0]}</lastmod>
  </url>
</urlset>`;

    return new Response(xml, {
        headers: { "Content-Type": "application/xml" },
    });
};

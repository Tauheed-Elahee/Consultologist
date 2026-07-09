// Schema.org JSON-LD node builders. Every page carries Organization + WebSite
// (assembled in Layout.astro); pages add their own nodes on top, and the
// aggregated /schema/articles.json endpoint reuses the same article builder.

import type { CollectionEntry } from "astro:content";

export const SITE = "https://consultologist.ai";

type Node = Record<string, unknown>;

const ORG_ID = `${SITE}/#organization`;
const WEBSITE_ID = `${SITE}/#website`;

export function organizationNode(): Node {
    return {
        "@type": "Organization",
        "@id": ORG_ID,
        name: "Consultologist",
        url: `${SITE}/`,
        logo: {
            "@type": "ImageObject",
            url: `${SITE}/icon.png`,
        },
        // No email property: a plain address here is scraper bait, and an
        // obfuscated one breaks the field for legitimate agents. Contact is
        // discoverable via the site's /contact page.
        founder: [
            {
                "@type": "Person",
                name: "Tamjeed Elahee",
                honorificSuffix: "M.D.",
                jobTitle: "Physician",
                sameAs: ["https://www.linkedin.com/in/tamjeed-elahee-856169198/"],
            },
            {
                "@type": "Person",
                name: "Tauheed Elahee",
                honorificSuffix: "B.Eng.",
                jobTitle: "Software Developer",
                sameAs: [
                    "https://tauheed-elahee.com",
                    "https://www.linkedin.com/in/tauheed-elahee",
                    "https://github.com/Tauheed-Elahee",
                ],
            },
        ],
    };
}

export function webSiteNode(): Node {
    return {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: "Consultologist",
        url: `${SITE}/`,
        description:
            "AI-assisted consult drafts with an auditable chain of thinking, built for specialist physicians.",
        publisher: { "@id": ORG_ID },
        inLanguage: "en",
    };
}

export function softwareApplicationNode(): Node {
    return {
        "@type": "SoftwareApplication",
        "@id": "https://app.consultologist.ai/#software",
        name: "Consultologist",
        url: "https://app.consultologist.ai",
        applicationCategory: "MedicalApplication",
        operatingSystem: "Web",
        description:
            "Turns a referral package into a structured consult note draft, section by section, against the specialist's own writing standards — with the reasoning in view for physician review and sign-off.",
        publisher: { "@id": ORG_ID },
    };
}

export function articleNode(article: CollectionEntry<"articles">): Node {
    const url = `${SITE}/research/${article.id}`;
    const date = article.data.date.toISOString().split("T")[0];
    return {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: article.data.title,
        description: article.data.description,
        url,
        mainEntityOfPage: url,
        datePublished: date,
        dateModified: date,
        author: article.data.author
            ? { "@type": "Person", name: article.data.author }
            : { "@id": ORG_ID },
        publisher: { "@id": ORG_ID },
        isPartOf: { "@id": WEBSITE_ID },
        inLanguage: "en",
    };
}

/** Wrap nodes in a JSON-LD @graph document. */
export function graph(...nodes: Node[]): Node {
    return { "@context": "https://schema.org", "@graph": nodes };
}

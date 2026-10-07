import type { CollectionEntry } from 'astro:content';
import { site } from '../data/site';

export type JsonLd = Record<string, unknown>;

// Default social preview image. Regenerate with `npm run og`.
export const defaultImage = {
  path: '/og-default.png',
  width: 1200,
  height: 630,
  alt: `${site.name}. ${site.description.split(/\.\s/)[0]}. ${new URL(site.url).host}`,
};

const personId = (origin: URL) => new URL('/#person', origin).href;

// Full Person record. Emitted once, on the home page.
export function personSchema(origin: URL): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': personId(origin),
    name: site.name,
    url: new URL('/', origin).href,
    email: `mailto:${site.email}`,
    sameAs: Object.values(site.links),
    alumniOf: 'Minerva University',
  };
}

// Short reference to the Person above, for use inside other records.
function personRef(origin: URL): JsonLd {
  return {
    '@type': 'Person',
    '@id': personId(origin),
    name: site.name,
    url: new URL('/', origin).href,
  };
}

export function blogPostingSchema(post: CollectionEntry<'blog'>, origin: URL): JsonLd {
  const url = new URL(`/blog/${post.id}/`, origin).href;
  const { title, description, date, tags } = post.data;
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    datePublished: date.toISOString(),
    url,
    mainEntityOfPage: url,
    image: new URL(defaultImage.path, origin).href,
    author: personRef(origin),
    ...(tags.length > 0 && { keywords: tags.join(', ') }),
  };
}

// Projects with a public repository are described as source code, the rest as
// a generic creative work. Several projects were team efforts, so the site
// owner is listed as a contributor and not as the sole author.
export function projectSchema(project: CollectionEntry<'projects'>, origin: URL): JsonLd {
  const url = new URL(`/projects/${project.id}/`, origin).href;
  const { title, summary, stack, repo } = project.data;
  return {
    '@context': 'https://schema.org',
    '@type': repo ? 'SoftwareSourceCode' : 'CreativeWork',
    name: title,
    description: summary,
    url,
    mainEntityOfPage: url,
    ...(repo && { codeRepository: repo }),
    keywords: stack.join(', '),
    contributor: personRef(origin),
  };
}

// Serialise for a <script type="application/ld+json"> element. Escaping "<"
// keeps content such as "</script>" from closing the element early.
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

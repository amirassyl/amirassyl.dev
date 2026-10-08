import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { site } from '../data/site';
import { getPosts } from '../lib/content';

export async function GET(context: APIContext) {
  const posts = await getPosts();
  return rss({
    title: `${site.shortName} — Writing`,
    description: 'Notes on what I am building and learning.',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/blog/${post.id}/`,
    })),
  });
}

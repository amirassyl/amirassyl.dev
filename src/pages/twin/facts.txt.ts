// Everything Pixel Amir is allowed to know, as plain text. Built from the same
// data as the rest of the site, so he never knows more (or less) than the pages
// say. The Worker reads this file and puts it in his system prompt.
import { site, experience, education, skills } from '../../data/site';
import { getProjects } from '../../lib/content';

export async function GET() {
  const projects = await getProjects();
  const lines = [
    `Name: ${site.name} (goes by Amir; the site uses just "${site.shortName}").`,
    `About: ${site.description}`,
    `Where: ${site.location}. Minerva students move to a different country every year; this year it's Japan.`,
    `From: Kazakhstan (the site doesn't say which city).`,
    `Looking for: ${site.status}. Anywhere in the US works.`,
    `Contact: email ${site.email}, LinkedIn ${site.links.linkedin}, GitHub ${site.links.github}.`,
    '',
    '## Experience',
    ...experience.map((role) => `- ${role.role}, ${role.org} (${role.period}): ${role.points.join(' ')}`),
    '',
    '## Education',
    ...education.map((item) => `- ${item.org}, ${item.detail} (${item.period}). ${item.points.join(' ')}`),
    '',
    '## Skills',
    ...skills.map((group) => `- ${group.group}: ${group.items.join(', ')}`),
    '',
    '## Projects',
    ...projects.flatMap((project) => [
      `### ${project.data.title} (${project.data.context}, ${project.data.period})`,
      `${project.data.summary} Stack: ${project.data.stack.join(', ')}.${project.data.repo ? ` Code: ${project.data.repo}` : ''}`,
      project.body?.trim() ?? '',
      '',
    ]),
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

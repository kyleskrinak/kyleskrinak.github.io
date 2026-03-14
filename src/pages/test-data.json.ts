import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const posts = await getCollection('blog');
  const postWithImage = posts.find(p => p.id.includes('first-lchf'));

  return new Response(
    JSON.stringify({
      id: postWithImage?.id,
      data: postWithImage?.data,
    }, null, 2),
    {
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
};

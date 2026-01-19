import { getCollection } from 'astro:content';

export async function get() {
  const posts = await getCollection('blog');
  const postWithImage = posts.find(p => p.id.includes('first-lchf'));
  
  return {
    body: JSON.stringify({
      id: postWithImage?.id,
      data: postWithImage?.data,
    }, null, 2)
  };
}

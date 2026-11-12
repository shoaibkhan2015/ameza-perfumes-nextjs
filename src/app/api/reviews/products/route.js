import { catalog } from '@/server/lib/catalog.js';

export async function GET() {
  try {
    const { products } = await catalog();
    return Response.json({ products: products.map(({ id, title }) => ({ id, title })) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Perfumes could not be loaded.' }, { status: 503 });
  }
}

import { store } from '../store/index.js';

// ---- tiny cache so we don't hit the database on every page view -----------
let cache = null, cacheAt = 0;
const TTL = Number(process.env.CATALOG_CACHE_SECONDS ?? 20) * 1000;

export async function catalog() {
  if (cache && Date.now() - cacheAt < TTL) return cache;
  const raw = await store.loadCatalog();
  const byProduct = new Map();
  for (const c of raw.collections) for (const h of c.productHandles) {
    if (!byProduct.has(h)) byProduct.set(h, []);
    byProduct.get(h).push(c.handle);
  }
  const products = raw.products.filter(p => p.variants.length).map(p => serialize(p, byProduct.get(p.handle) || []));
  cache = { products, byHandle: new Map(products.map(p => [p.handle, p])), collections: raw.collections };
  cacheAt = Date.now();
  return cache;
}
export const clearCatalogCache = () => { cache = null; };

export function serialize(p, collections) {
  const variants = p.variants.map(v => ({ ...v, available: v.inventory > 0 }));
  const avail = variants.filter(v => v.available);
  const sel = avail[0] || variants[0];
  const min = variants.reduce((m, v) => (v.price < m.price ? v : m), variants[0]);
  return {
    id: p.id, handle: p.handle, title: p.title, descriptionHtml: p.descriptionHtml, vendor: p.vendor,
    productType: p.productType, tags: p.tags, images: p.images, fragrance: p.fragrance || {}, featuredImage: p.images[0] || null,
    createdAt: p.createdAt, sortOrder: p.sortOrder, bestSelling: p.bestSelling,
    variants, hasOnlyDefaultVariant: variants.length === 1 && variants[0].title === 'Default Title',
    optionName: variants[0].optionName,
    available: avail.length > 0, price: min.price, compareAtPrice: min.compareAtPrice,
    selectedVariantId: sel.id, inventory: sel.inventory, collections,
  };
}

export const SORTS = [
  ['manual', 'Featured'], ['best-selling', 'Best selling'], ['title-ascending', 'Alphabetically, A-Z'],
  ['title-descending', 'Alphabetically, Z-A'], ['price-ascending', 'Price, low to high'],
  ['price-descending', 'Price, high to low'], ['created-ascending', 'Date, old to new'], ['created-descending', 'Date, new to old'],
];

export function sortProducts(list, sortBy) {
  const l = [...list];
  const by = {
    'best-selling': (a, b) => b.bestSelling - a.bestSelling,
    'title-ascending': (a, b) => a.title.localeCompare(b.title),
    'title-descending': (a, b) => b.title.localeCompare(a.title),
    'price-ascending': (a, b) => a.price - b.price,
    'price-descending': (a, b) => b.price - a.price,
    'created-ascending': (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    'created-descending': (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  }[sortBy];
  return by ? l.sort(by) : l; // 'manual' keeps the collection's own order
}

export function searchProducts(list, q) {
  const terms = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return list.filter(p => {
    const hay = [p.title, p.vendor, p.productType, p.tags.join(' '), p.descriptionHtml.replace(/<[^>]+>/g, ' ')].join(' ').toLowerCase();
    return terms.every(t => hay.includes(t));
  });
}

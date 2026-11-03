// Local (no-database) store — used automatically when SUPABASE_URL is not set.
// Catalogue comes from data/seed.json, orders are saved to data/orders.local.json.
// Perfect for trying the site on your computer. Use Supabase for the real thing.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Next.js bundles this file, so resolve data/ from the project root rather than from import.meta.url
const dir = path.join(process.cwd(), 'data');
const seedFile = path.join(dir, 'seed.json');
const dbFile = path.join(dir, 'local-db.json');

const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } };
const db = readJson(dbFile, { orders: [], subscribers: [], messages: [], addresses: [] });
const save = () => fs.writeFileSync(dbFile, JSON.stringify(db, null, 1));

export const name = 'local (data/seed.json)';

export async function loadCatalog() {
  const seed = readJson(seedFile, { products: [], collections: [] });
  const now = Date.now();
  const products = seed.products.map((p, i) => ({
    id: `p_${p.handle}`, handle: p.handle, title: p.title, descriptionHtml: p.description_html || '',
    vendor: p.vendor || '', productType: p.product_type || '', tags: p.tags || [], images: p.images || [],
    fragrance: p.fragrance || p.fragrance_details || {}, published: p.published !== false, sortOrder: p.sort_order ?? i, bestSelling: p.best_selling ?? 0,
    createdAt: new Date(now - (seed.products.length - i) * 86400000).toISOString(),
    variants: (p.variants || []).map((v, k) => ({
      id: `v_${p.handle}_${k + 1}`, title: v.title, optionName: v.option_name || 'Title', price: Number(v.price),
      compareAtPrice: v.compare_at_price == null ? null : Number(v.compare_at_price),
      sku: v.sku || '', inventory: Number(v.inventory_quantity ?? 0), position: v.position ?? k + 1,
    })),
  })).filter(p => p.published);
  const collections = seed.collections.map(c => ({
    handle: c.handle, title: c.title, description: c.description || '', image: c.image || null,
    sortOrder: c.sort_order ?? 0,
    productHandles: c.auto === 'all' ? products.map(p => p.handle) : (c.products || []),
  }));
  return { products, collections };
}

export async function getPage(handle) {
  const seed = readJson(seedFile, {});
  const p = (seed.pages || []).find(x => x.handle === handle);
  return p ? { handle: p.handle, title: p.title, contentHtml: p.content_html } : null;
}
export async function getBlog(handle) {
  const seed = readJson(seedFile, {});
  const b = (seed.blogs || []).find(x => x.handle === handle);
  if (!b) return null;
  return { handle: b.handle, title: b.title, articles: (b.articles || []).map(a => ({
    handle: a.handle, title: a.title, author: a.author || '', image: a.image || null, excerpt: a.excerpt || '',
    contentHtml: a.content_html || '', publishedAt: a.published_at || new Date().toISOString() })) };
}
export async function getDiscount(code) {
  const seed = readJson(seedFile, {});
  const d = (seed.discount_codes || []).find(x => x.code.toUpperCase() === String(code).toUpperCase());
  return d ? { code: d.code, percent: Number(d.percent), minSubtotal: Number(d.min_subtotal || 0), active: d.active !== false, expiresAt: d.expires_at } : null;
}

export async function createOrder(o) {
  const order = { id: crypto.randomUUID(), orderNumber: 1001 + db.orders.length, createdAt: new Date().toISOString(),
    paymentStatus: 'pending', confirmationStatus: 'pending', fulfillmentStatus: 'unfulfilled', ...o };
  db.orders.push(order); save(); return order;
}
export async function getOrder(id) { return db.orders.find(o => o.id === id) || null; }
export async function listOrders(userId) { return db.orders.filter(o => o.userId === userId).reverse(); }

export async function listAddresses(userId) { return db.addresses.filter(a => a.userId === userId); }
export async function addAddress(userId, a) { const row = { id: crypto.randomUUID(), userId, ...a }; db.addresses.push(row); save(); return row; }
export async function deleteAddress(userId, id) { db.addresses = db.addresses.filter(a => !(a.userId === userId && a.id === id)); save(); }

export async function addSubscriber(email) { if (!db.subscribers.includes(email)) { db.subscribers.push(email); save(); } }
export async function addMessage(m) { db.messages.push({ ...m, createdAt: new Date().toISOString() }); save(); }

// no login system in local mode
export async function verifyUser() { return null; }

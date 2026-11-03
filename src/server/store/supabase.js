// Supabase / PostgreSQL store. Uses the SERVICE ROLE key — keep it on the server only.
import { createClient } from '@supabase/supabase-js';

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const isServerKey = key => {
  if (key.startsWith('sb_secret_')) return true;
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
    return payload.role === 'service_role';
  } catch {
    return false;
  }
};
const hasServerKey = isServerKey(serviceRoleKey);

const sb = createClient(process.env.SUPABASE_URL, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
export const name = 'Supabase';

const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

export async function loadCatalog() {
  const [prods, colls, links] = await Promise.all([
    sb.from('products').select('*, product_variants(*)').eq('published', true).then(must),
    sb.from('collections').select('*').order('sort_order').then(must),
    sb.from('collection_products').select('collection_id, product_id, position').order('position').then(must),
  ]);
  const handleById = new Map(prods.map(p => [p.id, p.handle]));
  const products = prods.map(p => ({
    id: p.id, handle: p.handle, title: p.title, descriptionHtml: p.description_html || '', vendor: p.vendor || '',
    productType: p.product_type || '', tags: p.tags || [], images: p.images || [], fragrance: p.fragrance || {}, published: p.published,
    sortOrder: p.sort_order, bestSelling: p.best_selling, createdAt: p.created_at,
    variants: (p.product_variants || []).sort((a, b) => a.position - b.position).map(v => ({
      id: v.id, title: v.title, optionName: v.option_name, price: Number(v.price),
      compareAtPrice: v.compare_at_price == null ? null : Number(v.compare_at_price),
      sku: v.sku || '', inventory: v.inventory_quantity, position: v.position,
    })),
  }));
  const collections = colls.map(c => ({
    handle: c.handle, title: c.title, description: c.description || '', image: c.image, sortOrder: c.sort_order,
    // a collection with the handle "all" automatically contains every product
    productHandles: c.handle === 'all' ? products.map(p => p.handle)
      : links.filter(l => l.collection_id === c.id).map(l => handleById.get(l.product_id)).filter(Boolean),
  }));
  return { products, collections };
}

export async function getPage(handle) {
  const { data } = await sb.from('pages').select('*').eq('handle', handle).eq('published', true).maybeSingle();
  return data ? { handle: data.handle, title: data.title, contentHtml: data.content_html } : null;
}
export async function getBlog(handle) {
  const { data: b } = await sb.from('blogs').select('*').eq('handle', handle).maybeSingle();
  if (!b) return null;
  const arts = must(await sb.from('articles').select('*').eq('blog_id', b.id).eq('published', true).order('published_at', { ascending: false }));
  return { handle: b.handle, title: b.title, articles: arts.map(a => ({
    handle: a.handle, title: a.title, author: a.author || '', image: a.image, excerpt: a.excerpt || '',
    contentHtml: a.content_html, publishedAt: a.published_at })) };
}
export async function getDiscount(code) {
  const { data } = await sb.from('discount_codes').select('*').ilike('code', String(code)).maybeSingle();
  return data ? { code: data.code, percent: Number(data.percent), minSubtotal: Number(data.min_subtotal), active: data.active, expiresAt: data.expires_at } : null;
}

const mapOrder = (o, items) => ({
  id: o.id, orderNumber: o.order_number, userId: o.user_id, email: o.email, phone: o.phone,
  shippingAddress: o.shipping_address, subtotal: Number(o.subtotal), shipping: Number(o.shipping),
  discount: Number(o.discount), discountCode: o.discount_code, total: Number(o.total),
  paymentMethod: o.payment_method, paymentReference: o.payment_reference || '', paymentStatus: o.payment_status, confirmationStatus: o.confirmation_status,
  fulfillmentStatus: o.fulfillment_status,
  note: o.note, createdAt: o.created_at,
  items: (items || []).map(i => ({ productId: i.product_id, variantId: i.variant_id, handle: i.handle, title: i.title,
    variantTitle: i.variant_title, price: Number(i.price), quantity: i.quantity, image: i.image })),
});

export async function createOrder(o) {
  if (!hasServerKey) {
    throw new Error('Order creation requires a Supabase server-side secret/service_role key. The configured key is a public publishable/anon key and is blocked by row-level security.');
  }
  const orderValues = {
    user_id: o.userId || null, email: o.email, phone: o.phone, shipping_address: o.shippingAddress,
    subtotal: o.subtotal, shipping: o.shipping, discount: o.discount, discount_code: o.discountCode || null,
    total: o.total, payment_method: o.paymentMethod, note: o.note || null,
  };
  if (o.paymentReference) orderValues.payment_reference = o.paymentReference;
  const row = must(await sb.from('orders').insert(orderValues).select().single());
  const items = must(await sb.from('order_items').insert(o.items.map(i => ({
    order_id: row.id, product_id: i.productId, variant_id: i.variantId, handle: i.handle, title: i.title,
    variant_title: i.variantTitle, price: i.price, quantity: i.quantity, image: i.image || null,
  }))).select());
  // reduce stock (simple version — see README for the race-free SQL version)
  for (const i of o.items) {
    const { data: v } = await sb.from('product_variants').select('inventory_quantity').eq('id', i.variantId).single();
    if (v) await sb.from('product_variants').update({ inventory_quantity: Math.max(0, v.inventory_quantity - i.quantity) }).eq('id', i.variantId);
  }
  return mapOrder(row, items);
}
export async function getOrder(id) {
  const { data: o } = await sb.from('orders').select('*, order_items(*)').eq('id', id).maybeSingle();
  return o ? mapOrder(o, o.order_items) : null;
}
export async function listOrders(userId) {
  const rows = must(await sb.from('orders').select('*, order_items(*)').eq('user_id', userId).order('created_at', { ascending: false }));
  return rows.map(o => mapOrder(o, o.order_items));
}

export async function listAddresses(userId) {
  return must(await sb.from('addresses').select('*').eq('user_id', userId).order('created_at'));
}
export async function addAddress(userId, a) {
  return must(await sb.from('addresses').insert({ user_id: userId, ...a }).select().single());
}
export async function deleteAddress(userId, id) {
  must(await sb.from('addresses').delete().eq('id', id).eq('user_id', userId));
}

export async function addSubscriber(email) {
  must(await sb.from('newsletter_subscribers').upsert({ email }, { onConflict: 'email' }));
}
export async function addMessage(m) { must(await sb.from('contact_messages').insert(m)); }

export async function verifyUser(token) {
  if (!token) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return null;
  const u = data.user;
  return { id: u.id, email: u.email, firstName: u.user_metadata?.first_name || '' };
}

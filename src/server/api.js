// All API handlers (formerly the Express router). Each app/api/**/route.js re-exports the ones it serves.
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { store, storeName } from './store/index.js';
import { catalog, SORTS, sortProducts, searchProducts } from './lib/catalog.js';
import { sendNewOrderNotification } from './lib/order-notification.js';
import { isPaymentMethodAvailable, paymentMethods } from './lib/payment-methods.js';
import { FREE_SHIPPING_OVER, SHIPPING_FEE, isEmail, clean, rateLimited } from './lib/util.js';

const json = (data, status = 200) => NextResponse.json(data, { status });
const tooMany = () => json({ error: 'Too many requests, please try again in a minute.' }, 429);
const query = req => new URL(req.url).searchParams;
const readBody = req => req.json().catch(() => ({}));
const wrap = (fn, { checkoutDiagnostics = false } = {}) => async (req, ctx) => {
  try { return await fn(req, ctx); } catch (err) {
    if (checkoutDiagnostics) {
      const reference = randomUUID();
      console.error(`[checkout:${reference}]`, err);
      return json({ error: `We couldn't place your order. Please try again or contact us with reference ${reference}.` }, 500);
    }
    console.error(err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};
async function currentUser(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.get('authorization') || '');
  return m ? await store.verifyUser(m[1]).catch(() => null) : null;
}
const needUser = fn => wrap(async (req, ctx) => {
  const user = await currentUser(req);
  return user ? fn(req, ctx, user) : json({ error: 'Please log in.' }, 401);
});

const storedCollectionHandle = handle => handle === 'unisex' ? 'gift-sets' : handle;
const publicCollectionHandle = handle => handle === 'gift-sets' ? 'unisex' : handle;
const publicCollectionTitle = collection => collection.handle === 'gift-sets' ? 'Unisex' : collection.title;

// ---------------------------------------------------------------- health / config
export const health = () => json({ ok: true, store: storeName });
export const getConfig = () => json({
  freeShippingOver: FREE_SHIPPING_OVER,
  shippingFee: SHIPPING_FEE,
  currency: 'PKR',
  paymentMethods: paymentMethods(),
});
export const getStatus = () => json({ store: storeName });

// ---------------------------------------------------------------- products
export const listProducts = wrap(async req => {
  const q = query(req);
  const { products, collections } = await catalog();
  const c = collections.find(x => x.handle === storedCollectionHandle(q.get('collection') || 'all'));
  const list = c ? c.productHandles.map(h => products.find(p => p.handle === h)).filter(Boolean) : [];
  const limit = Math.min(Number(q.get('limit')) || 50, 100);
  return json({ products: list.slice(0, limit) });
});

export const getProduct = wrap(async (_req, { params }) => {
  const { handle } = await params;
  const { byHandle } = await catalog();
  const p = byHandle.get(handle);
  return p ? json({ product: p }) : json({ error: 'Product not found' }, 404);
});

// ---------------------------------------------------------------- collections
export const listCollections = wrap(async () => {
  const { collections } = await catalog();
  return json({ collections: collections.map(c => ({ handle: publicCollectionHandle(c.handle), title: publicCollectionTitle(c), description: c.description, image: c.image, productsCount: c.productHandles.length })) });
});

export const getCollection = wrap(async (req, { params }) => {
  const { handle } = await params;
  const { products, collections } = await catalog();
  const c = collections.find(x => x.handle === storedCollectionHandle(handle));
  if (!c) return json({ error: 'Collection not found' }, 404);

  const q = query(req);
  const sortBy = SORTS.some(s => s[0] === q.get('sort_by')) ? q.get('sort_by') : 'manual';
  const perPage = Math.min(Math.max(Number(q.get('per_page')) || 12, 4), 48);
  const page = Math.max(Number(q.get('page')) || 1, 1);
  const base = c.productHandles.map(h => products.find(p => p.handle === h)).filter(Boolean);

  const gte = q.get('filter.v.price.gte') ? Number(q.get('filter.v.price.gte')) : null;
  const lte = q.get('filter.v.price.lte') ? Number(q.get('filter.v.price.lte')) : null;
  const avail = q.getAll('filter.v.availability');

  const byPrice = base.filter(p => (gte == null || p.price >= gte) && (lte == null || p.price <= lte));
  const filtered = byPrice.filter(p => !avail.length || avail.includes(p.available ? '1' : '0'));
  const sorted = sortProducts(filtered, sortBy);
  const pages = Math.max(1, Math.ceil(sorted.length / perPage));

  return json({
    collection: { handle: publicCollectionHandle(c.handle), title: publicCollectionTitle(c), description: c.description, image: c.image, productsCount: sorted.length },
    products: sorted.slice((page - 1) * perPage, page * perPage),
    total: sorted.length, page, pages, perPage, sortBy,
    sortOptions: SORTS.map(([value, name]) => ({ value, name })),
    filters: {
      availability: { in: byPrice.filter(p => p.available).length, out: byPrice.filter(p => !p.available).length },
      priceMax: base.reduce((m, p) => Math.max(m, p.price), 0),
    },
  });
});

// ---------------------------------------------------------------- search
export const search = wrap(async req => {
  const { products } = await catalog();
  const sp = query(req);
  const q = clean(sp.get('q'), 100);
  const found = searchProducts(products, q);
  const perPage = 12, page = Math.max(Number(sp.get('page')) || 1, 1);
  return json({ q, performed: !!q, total: found.length, page, pages: Math.max(1, Math.ceil(found.length / perPage)),
    products: found.slice((page - 1) * perPage, page * perPage) });
});

// ---------------------------------------------------------------- content
export const getPage = wrap(async (_req, { params }) => {
  const p = await store.getPage((await params).handle);
  return p ? json({ page: p }) : json({ error: 'Page not found' }, 404);
});
export const getBlog = wrap(async (_req, { params }) => {
  const b = await store.getBlog((await params).handle);
  return b ? json({ blog: b }) : json({ error: 'Blog not found' }, 404);
});

// ---------------------------------------------------------------- cart helpers
// Re-price whatever is in the browser's cart using the real database prices.
async function priceLines(lines) {
  const { products } = await catalog({ fresh: true });
  const out = [];
  for (const l of lines.slice(0, 50)) {
    const qty = Math.floor(Number(l.quantity));
    if (!l.variantId || !(qty > 0)) continue;
    for (const p of products) {
      const v = p.variants.find(x => x.id === l.variantId);
      if (v) { out.push({ product: p, variant: v, quantity: Math.min(qty, 99) }); break; }
    }
  }
  return out;
}
const shape = ({ product: p, variant: v, quantity }) => ({
  variantId: v.id, productId: p.id, handle: p.handle, title: p.title, variantTitle: v.title,
  hasOnlyDefaultVariant: p.hasOnlyDefaultVariant, price: v.price, compareAtPrice: v.compareAtPrice,
  discountPercent: v.discountPercent || 0,
  image: p.featuredImage, quantity, available: v.available, inventory: v.inventory,
});

export const validateCart = wrap(async req => {
  const b = await readBody(req);
  const lines = await priceLines(Array.isArray(b.lines) ? b.lines : []);
  return json({ lines: lines.map(shape) });
});

export const checkDiscount = wrap(async req => {
  if (rateLimited(req, 30)) return tooMany();
  const b = await readBody(req);
  const d = await store.getDiscount(clean(b.code, 40));
  const subtotal = Number(b.subtotal) || 0;
  const bad = !d || !d.active || (d.expiresAt && new Date(d.expiresAt) < new Date()) || subtotal < d.minSubtotal;
  if (bad) return json({ error: d && subtotal < d.minSubtotal ? `Spend Rs ${d.minSubtotal} to use this code.` : 'This code is not valid.' }, 400);
  return json({ code: d.code, percent: d.percent });
});

// ---------------------------------------------------------------- checkout
export const createOrder = wrap(async req => {
  if (rateLimited(req, 10)) return tooMany();
  const b = await readBody(req);
  const paymentMethod = clean(b.paymentMethod || 'cod', 20).toLowerCase();
  if (!['cod', 'jazzcash', 'easypaisa'].includes(paymentMethod)) {
    return json({ error: 'Please select a supported payment method.' }, 400);
  }
  if (!isPaymentMethodAvailable(paymentMethod)) {
    return json({ error: 'This payment method is not configured yet. Please choose another method.' }, 400);
  }
  const paymentReference = paymentMethod === 'cod' ? null : clean(b.paymentReference, 100);
  if (paymentMethod !== 'cod' && !paymentReference) {
    return json({ error: 'Enter the transaction reference for your wallet transfer.' }, 400);
  }
  if (!Array.isArray(b.lines) || b.lines.length === 0) return json({ error: 'Your cart is empty.' }, 400);
  const lines = await priceLines(b.lines);
  if (!lines.length) return json({ error: 'Your cart is empty.' }, 400);

  const a = b.address || {};
  const address = {
    firstName: clean(a.firstName, 60), lastName: clean(a.lastName, 60), address1: clean(a.address1, 200),
    city: clean(a.city, 80), country: clean(a.country || 'Pakistan', 60), zip: clean(a.zip, 20),
  };
  const email = clean(b.email, 120).toLowerCase();
  const phone = clean(b.phone, 30);
  if (!isEmail(email)) return json({ error: 'Please enter a valid email address.' }, 400);
  if (!address.firstName || !address.address1 || !address.city)
    return json({ error: 'Please fill in your first name, address and city.' }, 400);
  if (phone.replace(/\D/g, '').length < 10)
    return json({ error: 'Please enter a valid phone number with at least 10 digits.' }, 400);

  for (const l of lines) {
    if (!l.variant.available) return json({ error: `${l.product.title} is sold out.` }, 409);
    if (l.quantity > l.variant.inventory) return json({ error: `Only ${l.variant.inventory} of ${l.product.title} left.` }, 409);
  }

  const subtotal = lines.reduce((s, l) => s + l.variant.price * l.quantity, 0);
  let discount = 0, discountCode = null;
  if (b.code) {
    const d = await store.getDiscount(clean(b.code, 40));
    const ok = d && d.active && !(d.expiresAt && new Date(d.expiresAt) < new Date()) && subtotal >= d.minSubtotal;
    if (!ok) return json({ error: 'That discount code is not valid.' }, 400);
    discount = Math.round((subtotal * d.percent) / 100); discountCode = d.code;
  }
  const shipping = subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FEE;
  const total = subtotal - discount + shipping;
  const user = await currentUser(req);

  const order = await store.createOrder({
    userId: user?.id || null, email, phone, shippingAddress: address, subtotal, shipping, discount, discountCode,
    total, paymentMethod, paymentReference, note: clean(b.note, 500),
    items: lines.map(l => ({ productId: l.product.id, variantId: l.variant.id, handle: l.product.handle, title: l.product.title,
      variantTitle: l.variant.title, price: l.variant.price, quantity: l.quantity, image: l.product.featuredImage })),
  });
  try {
    await sendNewOrderNotification(order);
  } catch (notificationError) {
    console.error(`[order-email] Failed to notify admin for order ${order.id}:`, notificationError);
  }
  return json({ order }, 201);
}, { checkoutDiagnostics: true });

// guest "thank you" page: the order id is an unguessable UUID
export const getOrder = wrap(async (_req, { params }) => {
  const o = await store.getOrder((await params).id);
  return o ? json({ order: o }) : json({ error: 'Order not found' }, 404);
});
export const listMyOrders = needUser(async (_req, _ctx, user) => json({ orders: await store.listOrders(user.id) }));

// ---------------------------------------------------------------- addresses
export const listAddresses = needUser(async (_req, _ctx, user) => json({ addresses: await store.listAddresses(user.id) }));
export const addAddress = needUser(async (req, _ctx, user) => {
  const a = await readBody(req);
  if (!clean(a.first_name) || !clean(a.address1) || !clean(a.city)) return json({ error: 'First name, address and city are required.' }, 400);
  const row = await store.addAddress(user.id, { first_name: clean(a.first_name, 60), last_name: clean(a.last_name, 60), address1: clean(a.address1),
    city: clean(a.city, 80), country: clean(a.country || 'Pakistan', 60), zip: clean(a.zip, 20), phone: clean(a.phone, 30) });
  return json({ address: row }, 201);
});
export const deleteAddress = needUser(async (_req, { params }, user) => {
  await store.deleteAddress(user.id, (await params).id);
  return json({ ok: true });
});

// ---------------------------------------------------------------- forms
export const subscribe = wrap(async req => {
  if (rateLimited(req, 10)) return tooMany();
  const email = clean((await readBody(req)).email, 120).toLowerCase();
  if (!isEmail(email)) return json({ error: 'Please enter a valid email address.' }, 400);
  await store.addSubscriber(email);
  return json({ ok: true });
});
export const contact = wrap(async req => {
  if (rateLimited(req, 5)) return tooMany();
  const b = await readBody(req);
  if (!isEmail(b.email) || !clean(b.body)) return json({ error: 'Please add your email and a message.' }, 400);
  await store.addMessage({ name: clean(b.name, 80), email: clean(b.email, 120), phone: clean(b.phone, 30), body: clean(b.body, 2000) });
  return json({ ok: true });
});

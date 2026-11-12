import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { emptyReviews, isProductId, validateReview } from '../lib/reviews.js';
import { rateLimited } from './lib/util.js';

const client = () => process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function getReviews(req) {
  const db = client();
  if (!db) return json(emptyReviews());
  const params = new URL(req.url).searchParams;
  const productId = params.get('productId');
  if (productId && !isProductId(productId)) return json({ error: 'Invalid product.' }, 400);
  const page = Number(params.get('page') || 1);
  if (!Number.isInteger(page) || page < 1 || page > 10000) return json({ error: 'Invalid page.' }, 400);
  const { data, error } = await db.rpc('public_customer_reviews', { p_product_id: productId || null, p_page: page });
  if (error) { console.error('Review read failed:', error.code); return json({ error: 'Reviews are temporarily unavailable.' }, 503); }
  return json(data);
}

async function readBody(req) {
  const reader = req.body?.getReader();
  if (!reader) throw new Error('Enter a valid review.');
  let length = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 16384) { await reader.cancel(); throw new Error('Your review is too large.'); }
    chunks.push(Buffer.from(value));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('Enter a valid review.'); }
}

async function submitReview(req) {
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) return json({ error: 'Invalid request origin.' }, 403);
  if (!req.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Send JSON review data.' }, 415);
  if (rateLimited(req, 6, 60000)) return json({ error: 'Too many attempts. Please try again later.' }, 429);
  let review;
  try { review = validateReview(await readBody(req)); } catch (err) { return json({ error: err.message }, 400); }
  const db = client();
  if (!db) return json({ error: 'Review submission is temporarily unavailable.' }, 503);
  const token = /^Bearer (.+)$/.exec(req.headers.get('authorization') || '')?.[1];
  let userId = null;
  if (token) {
    const { data } = await db.auth.getUser(token);
    userId = data?.user?.id || null;
  }
  const hash = value => createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY).update(value).digest('hex');
  const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
  const { error } = await db.rpc('submit_customer_review', {
    p_product_id: review.productId, p_name: review.name, p_city: review.city, p_rating: review.rating, p_feedback: review.feedback,
    p_duplicate_hash: hash(JSON.stringify([review.productId, review.name.toLowerCase(), review.feedback.toLowerCase()])),
    p_request_hash: hash(ip), p_user_id: userId,
  });
  if (error) {
    if (error.message.includes('REVIEW_DUPLICATE') || error.code === '23505') return json({ error: 'This review has already been submitted.' }, 409);
    if (error.message.includes('REVIEW_RATE_LIMIT')) return json({ error: 'You have submitted several reviews. Please try again in an hour.' }, 429);
    if (error.message.includes('REVIEW_PRODUCT_NOT_FOUND')) return json({ error: 'Choose an available perfume.' }, 400);
    console.error('Review submission failed:', error.code);
    return json({ error: 'Your review could not be saved. Please try again later.' }, 503);
  }
  return json({ message: 'Thank you! Your review will appear after approval.' }, 201);
}

const safe = handler => async req => {
  try { return await handler(req); } catch {
    console.error('Customer review service unavailable.');
    return json({ error: 'Reviews are temporarily unavailable. Please try again later.' }, 503);
  }
};
export const GET = safe(getReviews);
export const POST = safe(submitReview);

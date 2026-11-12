export const isProductId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const emptyReviews = () => ({ reviews: [], summary: { count: 0, average: null, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }, page: 1, hasMore: false });
export function reviewStars(rating) {
  const stars = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return '★'.repeat(stars) + '☆'.repeat(5 - stars);
}

export function validateReview(body, now = Date.now()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Enter a valid review.');
  const text = (value, min, max, label) => {
    if (typeof value !== 'string') throw new Error(`Enter ${label}.`);
    const cleaned = value.trim().replace(/\s+/g, ' ');
    if (cleaned.length < min || cleaned.length > max || /[<>\u0000-\u001f]/.test(cleaned)) throw new Error(`Enter ${label} (${min}–${max} characters, without HTML).`);
    return cleaned;
  };
  if (body.website || !Number.isFinite(body.startedAt) || now - body.startedAt < 2000 || now - body.startedAt > 86400000) throw new Error('Please wait a moment, then submit your review.');
  if (!isProductId(body.productId)) throw new Error('Choose a perfume.');
  if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) throw new Error('Choose a rating from 1 to 5.');
  const name = text(body.name, 2, 80, 'your name');
  const city = text(body.city ?? '', 0, 80, 'your city');
  const feedback = text(body.feedback, 10, 2000, 'your feedback');
  if (/(https?:\/\/|www\.)/i.test(feedback)) throw new Error('Please leave links out of your review.');
  return { productId: body.productId.toLowerCase(), name, city, rating: body.rating, feedback };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReview, reviewStars, emptyReviews } from '../src/lib/reviews.js';
import { GET, POST } from '../src/server/reviews.js';

const productId = '11111111-1111-4111-8111-111111111111';
const valid = () => ({ productId, name: 'Ayesha', city: 'Lahore', rating: 4, feedback: 'A pleasant fragrance that lasts all day.', startedAt: Date.now() - 5000, website: '' });
const request = (body, extra = {}) => new Request('https://ameza.example/api/reviews', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': crypto.randomUUID(), ...extra }, body: JSON.stringify(body) });

test('guest inputs are normalized and client-supplied approval or verification is discarded', () => {
  const result = validateReview({ ...valid(), name: '  Ayesha   Khan ', verified_purchase: true, status: 'approved' });
  assert.equal(result.name, 'Ayesha Khan');
  assert.equal(result.rating, 4);
  assert.equal('verified_purchase' in result, false);
  assert.equal('status' in result, false);
});

test('invalid ratings, IDs, spam links, honeypots, empty feedback and instant submissions are rejected', () => {
  for (const patch of [{ rating: 0 }, { rating: 6 }, { rating: 4.5 }, { rating: '5' }, { productId: 'drift' }, { name: 'X' }, { feedback: '<script>alert(1)</script>' }, { feedback: 'Visit https://spam.example now' }, { website: 'spam' }, { feedback: 'short' }, { startedAt: Date.now() }, { city: 'x'.repeat(81) }]) {
    assert.throws(() => validateReview({ ...valid(), ...patch }));
  }
});

test('empty review summaries exclude demos and have no invented rating', () => {
  const summary = emptyReviews().summary;
  assert.equal(summary.count, 0);
  assert.equal(summary.average, null);
  assert.equal(reviewStars(null), '☆☆☆☆☆');
  assert.equal(reviewStars(3), '★★★☆☆');
});

function setupDatabase(t, handler) {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const oldFetch = globalThis.fetch;
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-server-secret';
  globalThis.fetch = handler;
  t.after(() => {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  });
}

test('public API scopes paginated reads to the product UUID and uses database-wide statistics', async t => {
  setupDatabase(t, async (url, options) => {
    assert.match(String(url), /rpc\/public_customer_reviews$/);
    assert.deepEqual(JSON.parse(options.body), { p_product_id: productId, p_page: 2 });
    return Response.json({ ...emptyReviews(), summary: { count: 40, average: 4.3, distribution: {} }, page: 2, hasMore: true });
  });
  const response = await GET(new Request(`https://ameza.example/api/reviews?productId=${productId}&page=2`));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).summary.count, 40);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('guest submission uses the guarded RPC, private hashes, and no user verification claims', async t => {
  setupDatabase(t, async (url, options) => {
    assert.match(String(url), /rpc\/submit_customer_review$/);
    const payload = JSON.parse(options.body);
    assert.equal(payload.p_product_id, productId);
    assert.equal(payload.p_user_id, null);
    assert.equal(payload.verified_purchase, undefined);
    assert.equal(payload.status, undefined);
    assert.match(payload.p_duplicate_hash, /^[a-f0-9]{64}$/);
    assert.match(payload.p_request_hash, /^[a-f0-9]{64}$/);
    return Response.json('22222222-2222-4222-8222-222222222222');
  });
  const response = await POST(request({ ...valid(), verified_purchase: true, status: 'approved' }));
  assert.equal(response.status, 201);
  assert.match((await response.json()).message, /after approval/);
});

test('database duplicate, persistent rate-limit and product errors are mapped safely', async t => {
  let message = 'REVIEW_DUPLICATE';
  setupDatabase(t, async () => Response.json({ message, code: 'P0001' }, { status: 400 }));
  assert.equal((await POST(request(valid()))).status, 409);
  message = 'REVIEW_RATE_LIMIT';
  assert.equal((await POST(request(valid()))).status, 429);
  message = 'REVIEW_PRODUCT_NOT_FOUND';
  assert.equal((await POST(request(valid()))).status, 400);
});

test('purchase identity comes from a validated session, never a submitted user ID', async t => {
  const userId = '33333333-3333-4333-8333-333333333333';
  setupDatabase(t, async (url, options) => {
    if (String(url).includes('/auth/v1/user')) {
      assert.equal(new Headers(options.headers).get('authorization'), 'Bearer valid-session-token');
      return Response.json({ id: userId, aud: 'authenticated', role: 'authenticated' });
    }
    assert.equal(JSON.parse(options.body).p_user_id, userId);
    return Response.json('22222222-2222-4222-8222-222222222222');
  });
  const response = await POST(request({ ...valid(), userId: 'attacker-claimed-user' }, { authorization: 'Bearer valid-session-token' }));
  assert.equal(response.status, 201);
});

test('cross-origin submissions, invalid payloads and oversized bodies never reach storage', async t => {
  setupDatabase(t, async () => assert.fail('Invalid requests must not access the database'));
  assert.equal((await POST(request(valid(), { origin: 'https://spam.example' }))).status, 403);
  assert.equal((await POST(request({ ...valid(), rating: 6 }))).status, 400);
  assert.equal((await POST(request({ ...valid(), feedback: 'x'.repeat(17000) }))).status, 400);
});

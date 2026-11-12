# Customer reviews

## Setup

Run `supabase/reviews.sql` in the existing project's SQL Editor after `schema.sql`
and `admin.sql`. The API uses the existing server-only Supabase service role key.
Do not expose that key to the browser. No additional environment variables are needed.

## Behavior

- Visitors can submit a name, optional city, perfume, rating and feedback without an account.
- Submissions are pending until approved in Admin → Reviews. Admins can filter by
  perfume/status, approve, reject, or delete spam. Moderation never changes purchase verification.
- Public cards and aggregate statistics include only approved reviews of published products.
  Cards are paginated in groups of 12; statistics cover all matching approved reviews.
- Homepage and PDP lists refresh every 30 seconds while visible and on tab focus.
- Sample cards are explicitly labeled and never inserted into the database or used in statistics.
- A Verified Purchase badge requires an authenticated submitter with an order for that
  exact product marked confirmed, paid and delivered. Guest reviews remain unverified;
  matching a public name or city never proves a purchase.
- Review and moderation actions use the existing Supabase authentication and RLS.
  Only the service role can invoke the submission RPC. Public reads use a restricted RPC.
- Submission limits are atomic across server instances: at most three accepted reviews
  per hashed network address per hour. Identical normalized name/product/feedback submissions
  are rejected even after a spam review is deleted. The private ledger stores hashes,
  not IP addresses or review content. A shared network may share the submission limit.
- Browser checks add a honeypot, minimum form time, bounded JSON bodies, link/HTML
  rejection, and disabled submission buttons while saving. Approval remains the spam gate.

## Verification

Run `node --test tests/reviews.test.mjs` and `npm run build`.
The focused API tests mock Supabase; they do not replace database RLS tests.
After applying the migration, verify with the real project:

1. Submit a guest review for one perfume. It must be pending and absent from all public lists/statistics.
2. Repeat the submission: expect a duplicate error. Submit invalid ratings, markup, and a honeypot value: expect rejection.
3. Approve it in Admin → Reviews; within 30 seconds it should appear on the homepage and that perfume's PDP only.
4. Approve a different rating for a second perfume. Verify separate PDP counts, overall average, and distribution bars.
5. Reject or delete an approved review and verify both its card and its contribution to statistics disappear.
6. Submit while signed in to a customer with a confirmed, paid, delivered order for the chosen product.
   Only this case should receive the Verified Purchase badge. Guest, other-product and unpaid orders must not.
7. Confirm anon/authenticated non-admin clients cannot insert/update/delete rows directly or invoke the submission RPC.
8. Check carousel swiping, form labels, review pagination and layout at mobile widths.

Without Supabase, sample cards remain available but real review submissions are disabled.

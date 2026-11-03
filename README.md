# AMEZA-perfume — Améza Parfums

A single Next.js app (storefront + API, backed by Supabase) that deploys to Vercel with no extra configuration.

## Project layout
- `src/app/` — Next.js routes. `(store)/` holds the storefront pages (they share the header/footer layout), `admin/` the admin panel, `api/` the API route handlers, `health/` the health check.
- `src/views/`, `src/components/`, `src/lib/`, `src/styles/` — the React UI.
- `src/server/` — server-only code: `api.js` (all API handlers), `store/` (Supabase or local seed data), `lib/` (catalogue, order emails, helpers).
- `data/seed.json` — sample catalogue, used when Supabase is not configured and by `npm run seed`.
- `scripts/` — `seed.js` (push `data/seed.json` to Supabase) and `import-shopify-csv.js`.
- `supabase/` — database schema and admin SQL.

## Run locally
Use Node.js 20.9 or newer.
```sh
npm ci
cp .env.example .env   # then fill in your values
npm run dev            # http://localhost:3000
```
`SUPABASE_SERVICE_ROLE_KEY` must be a server-side Supabase secret key (`sb_secret_…`) or legacy `service_role` key. Do not copy the publishable/anon key into this variable: it cannot create orders because row-level security blocks it. Keep the server key private; the browser only receives `NEXT_PUBLIC_` variables. `.env` is excluded from Git.

If both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are unset, the API uses `data/seed.json` and saves test orders to `data/local-db.json`. If only one is set, the API reports a configuration error.

Other scripts: `npm run build` / `npm start` (production build), `npm run seed`, `npm run import:shopify -- path/to/products_export.csv`.

## Deploy to Vercel
1. Push to GitHub → Vercel → **Add New Project** → import the repo. Vercel detects Next.js; leave Root Directory empty and the build settings at their defaults.
2. In your Supabase project, run `supabase/schema.sql` and then `supabase/admin.sql` in the SQL Editor. On an existing setup, run the updated schema to add new columns, and re-run `admin.sql` to apply permission changes. Create the admin Auth user and add its UUID to `public.admin_users` using the example at the end of `admin.sql`.
3. Add the variables from `.env.example` in **Project → Settings → Environment Variables**:
   - `SUPABASE_URL` and the server-side `SUPABASE_SERVICE_ROLE_KEY` for the API. Get the secret/service-role key from Supabase Project Settings → API Keys; do not use the publishable/anon key. If the public key is used by mistake, Supabase row-level security rejects checkout order inserts. Without these variables the live site uses seed data and orders fail (Vercel's file system is read-only).
   - `NEXT_PUBLIC_SUPABASE_URL` (the same project URL) and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for customer accounts and the admin panel. These are baked in at build time, so redeploy after changing them. The older `VITE_` names also work.
   - `RESEND_API_KEY`, `ORDER_NOTIFICATION_EMAIL` and `EMAIL_FROM` for new-order emails (verify the sender domain in Resend). If they are missing, orders still complete and the server logs the issue.
   - To enable manual JazzCash/Easypaisa transfers, set the respective account name and account number. QR image URLs are optional. These are manual transfers, not live payment-gateway integrations; verify payment in the receiving account before marking an order paid in Admin.
4. Deploy. Admin panel: `/admin`. Use **Website content** to edit storefront copy, images, navigation, section visibility/order, and theme settings; use **Collections** to create and manage collections such as Attar. Image uploads use the existing `ameza-product-images` bucket. Website content is saved in Supabase and served to storefront visitors. Health check: `/health` should return `{"ok":true,"store":"Supabase"}`.

## Store features
`src/components/MoodPicker.jsx` + `src/styles/mood-picker.css`, shown on the home page under the category tiles.
Each mood loads the matching real product (name, price, bottle image, Add to cart) and plays its own animation.
To change which perfume belongs to a mood, edit `handle` in the `MOODS` list.

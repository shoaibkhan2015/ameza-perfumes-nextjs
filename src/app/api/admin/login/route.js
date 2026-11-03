import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { clean, rateLimited } from '@/server/lib/util.js';

const json = (body, status = 200) => NextResponse.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store' },
});

export async function POST(request) {
  if (rateLimited(request, 5, 60_000)) {
    return json({ error: 'Too many sign-in attempts. Please wait a minute and try again.' }, 429);
  }

  const body = await request.json().catch(() => ({}));
  const username = clean(body?.username, 100).toLowerCase();
  const password = String(body?.password || '');
  const expectedUsername = String(process.env.ADMIN_LOGIN_USERNAME || '').trim().toLowerCase();
  const email = String(process.env.ADMIN_LOGIN_EMAIL || '').trim();
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!expectedUsername || !email || !url || !key) {
    return json({ error: 'Admin username sign-in is not configured.' }, 503);
  }
  if (!username || username !== expectedUsername || !password) {
    return json({ error: 'Invalid username or password.' }, 401);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return json({ error: 'Invalid username or password.' }, 401);
  }

  return json({ session: data.session });
}

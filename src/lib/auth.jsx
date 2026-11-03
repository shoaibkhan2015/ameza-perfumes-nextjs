'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { api } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(!supabase);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const need = () => { if (!supabase) throw new Error('Customer accounts are not set up yet (add your Supabase keys).'); return supabase; };
  const value = {
    enabled: !!supabase, ready, recovery,
    user: session?.user || null, token: session?.access_token || null,
    signIn: async (email, password) => { const { error } = await need().auth.signInWithPassword({ email, password }); if (error) throw error; },
    signInAdmin: async (username, password) => {
      const { session: adminSession } = await api('/admin/login', { method: 'POST', body: { username, password } });
      const { error } = await need().auth.setSession(adminSession);
      if (error) throw error;
    },
    signUp: async ({ email, password, firstName, lastName }) => {
      const { data, error } = await need().auth.signUp({ email, password, options: { data: { first_name: firstName, last_name: lastName } } });
      if (error) throw error; return data;
    },
    signOut: async () => { await need().auth.signOut(); },
    sendReset: async email => { const { error } = await need().auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/account/reset' }); if (error) throw error; },
    setPassword: async password => { const { error } = await need().auth.updateUser({ password }); if (error) throw error; setRecovery(false); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

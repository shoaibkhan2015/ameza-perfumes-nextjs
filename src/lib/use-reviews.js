'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { emptyReviews } from './reviews.js';

export function useReviews(productId, enabled = true) {
  const [page, setPage] = useState(1);
  const scope = productId || 'all';
  const [state, setState] = useState({ key: '', data: emptyReviews(), loading: true, error: '' });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => { setPage(1); }, [scope]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let request = 0;
    const key = `${scope}:${page}`;
    async function load() {
      const current = ++request;
      try {
        const data = await api(`/reviews?page=${page}${productId ? `&productId=${encodeURIComponent(productId)}` : ''}`);
        if (active && current === request) setState({ key, data, loading: false, error: '' });
      } catch (err) {
        if (active && current === request) setState(previous => ({ key, data: previous.key === key ? previous.data : emptyReviews(), loading: false, error: err.message }));
      }
    }
    load();
    const refresh = () => { if (!document.hidden) load(); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [scope, productId, page, revision, enabled]);
  const current = state.key === `${scope}:${page}` ? state : { data: emptyReviews(), loading: true, error: '' };
  return { ...current, page, setPage, reload };
}

'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from './api.js';
import { FREE_DELIVERY_OVER } from '../data/siteContent.js';

const KEY = 'ameza-cart-v1';
const Ctx = createContext(null);
export const useCart = () => useContext(Ctx);

const EMPTY = { lines: [], note: '' };
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || EMPTY; } catch { return EMPTY; } };

export function CartProvider({ children }) {
  // null until the saved cart is read after hydration, so server and browser render the same empty cart first
  const [stored, setStored] = useState(null);
  const state = stored || EMPTY;
  const setState = useCallback(next => setStored(s => (typeof next === 'function' ? next(s || load()) : next)), []);
  const [freeOver, setFreeOver] = useState(FREE_DELIVERY_OVER);
  const [toast, setToast] = useState({ on: false, key: 0 });
  const [bar, setBar] = useState(0);
  const timer = useRef();

  useEffect(() => { setStored(s => s || load()); }, []);
  useEffect(() => { if (stored) try { localStorage.setItem(KEY, JSON.stringify(stored)); } catch { /* private mode */ } }, [stored]);
  useEffect(() => { api('/config').then(c => setFreeOver(c.freeShippingOver)).catch(() => {}); }, []);

  const lines = state.lines;
  const count = lines.reduce((s, l) => s + l.quantity, 0);
  const total = lines.reduce((s, l) => s + l.price * l.quantity, 0);

  const showToast = useCallback(() => {
    setToast(t => ({ on: true, key: t.key + 1 }));
    setBar(0);
    clearTimeout(timer.current);
    setTimeout(() => setBar(1), 60);
    timer.current = setTimeout(() => setToast(t => ({ ...t, on: false })), 5200);
  }, []);

  const add = useCallback((product, variant, quantity = 1, { silent = false } = {}) => {
    setState(s => {
      const i = s.lines.findIndex(l => l.variantId === variant.id);
      const line = { variantId: variant.id, productId: product.id, handle: product.handle, title: product.title,
        variantTitle: variant.title, hasOnlyDefaultVariant: product.hasOnlyDefaultVariant, price: variant.price,
        compareAtPrice: variant.compareAtPrice, discountPercent: variant.discountPercent || 0,
        image: product.featuredImage, quantity };
      const lines = [...s.lines];
      if (i >= 0) lines[i] = { ...lines[i], quantity: lines[i].quantity + quantity }; else lines.push(line);
      return { ...s, lines };
    });
    if (!silent) showToast();
  }, [showToast]);

  const setQty = useCallback((variantId, q) => setState(s => ({ ...s,
    lines: q <= 0 ? s.lines.filter(l => l.variantId !== variantId) : s.lines.map(l => (l.variantId === variantId ? { ...l, quantity: Math.min(99, q) } : l)) })), []);
  const remove = useCallback(variantId => setQty(variantId, 0), [setQty]);
  const setNote = useCallback(note => setState(s => ({ ...s, note })), []);
  const clear = useCallback(() => setState({ lines: [], note: '' }), []);

  // Re-check prices / stock against the database (called on the cart + checkout pages)
  const refresh = useCallback(async () => {
    if (!lines.length) return;
    try {
      const { lines: fresh } = await api('/cart/validate', { method: 'POST', body: { lines: lines.map(l => ({ variantId: l.variantId, quantity: l.quantity })) } });
      setState(s => ({ ...s, lines: fresh.map(f => ({ ...f, quantity: Math.min(f.quantity, Math.max(f.inventory, 1)) })) }));
    } catch { /* offline: keep what we have */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(lines.map(l => [l.variantId, l.quantity]))]);

  const value = useMemo(() => ({ lines, count, total, note: state.note, freeOver, add, setQty, remove, setNote, clear, refresh }),
    [lines, count, total, state.note, freeOver, add, setQty, remove, setNote, clear, refresh]);

  const rem = Math.max(0, freeOver - total), pct = Math.min(100, (total / freeOver) * 100);
  return (
    <Ctx.Provider value={value}>
      {children}
      {/* the "Added to cart" popup (was created by assets/ameza-store.js) */}
      <div className={'am-ct' + (toast.on ? ' on' : '')}>
        <b>✓ Added to cart</b> · <Link href="/cart">View cart</Link>
        <div style={{ marginTop: 6 }}>
          {rem ? <>Add <b>Rs {Math.round(rem).toLocaleString()}</b> more for <b>FREE delivery</b> 🚚</> : <>🎉 You unlocked <b>FREE delivery</b>!</>}
        </div>
        <div className="am-bar"><u style={{ width: bar ? pct + '%' : undefined }} /></div>
      </div>
    </Ctx.Provider>
  );
}

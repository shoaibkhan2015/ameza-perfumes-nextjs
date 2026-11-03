'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useCart } from '../lib/cart.jsx';
import { bottleUrl, money } from '../lib/format.js';
import { useTitle } from '../lib/hooks.js';

// Prices are re-calculated on the server; wallet transfers are verified manually.
export default function Checkout() {
  useTitle('Checkout');
  const c = useCart(), { user, token } = useAuth(), router = useRouter();
  const [cfg, setCfg] = useState({
    freeShippingOver: 5000,
    shippingFee: 250,
    paymentMethods: { cod: { enabled: true }, jazzcash: { enabled: false }, easypaisa: { enabled: false } },
  });
  const [configError, setConfigError] = useState('');
  const [code, setCode] = useState(''), [applied, setApplied] = useState(null), [codeErr, setCodeErr] = useState('');
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');

  useEffect(() => {
    let active = true;
    api('/config').then(value => {
      if (active) setCfg(current => ({ ...current, ...value }));
    }).catch(error => {
      if (active) setConfigError(error.message);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (c.count) c.refresh();
  // Refresh once after the cart has hydrated; the order endpoint revalidates it again.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.count > 0]);

  const subtotal = c.total;
  const discount = applied ? Math.round((subtotal * applied.percent) / 100) : 0;
  const shipping = subtotal >= cfg.freeShippingOver ? 0 : cfg.shippingFee;
  const total = subtotal - discount + shipping;

  const apply = async () => {
    setCodeErr('');
    try { setApplied(await api('/discounts/check', { method: 'POST', body: { code, subtotal } })); }
    catch (e) { setApplied(null); setCodeErr(e.message); }
  };
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('');
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const { order } = await api('/orders', { method: 'POST', token, body: {
        email: f.email, phone: f.phone, note: c.note, code: applied?.code,
        paymentMethod, paymentReference: f.paymentReference,
        address: { firstName: f.firstName, lastName: f.lastName, address1: f.address1, city: f.city, zip: f.zip, country: 'Pakistan' },
        lines: c.lines.map(l => ({ variantId: l.variantId, quantity: l.quantity })),
      } });
      c.clear(); router.replace(`/order/${order.id}`);
    } catch (er) { setErr(er.message); setBusy(false); }
  };

  if (!c.count) return (
    <section className="am-sec"><div className="am-wrap"><div className="cp__empty"><p>Your cart is empty.</p><Link className="am-btn" href="/collections/all">Start shopping</Link></div></div></section>
  );
  return (
    <section className="am-sec"><div className="am-wrap">
      <div className="am-head" data-reveal><div><p className="am-eb">Secure checkout</p><h1 className="am-h">Checkout</h1></div><Link className="am-link" href="/cart">Back to cart</Link></div>
      <div className="cp">
        <form className="co__form" id="co" onSubmit={submit}>
          {err && <p className="am-err">{err}</p>}
          {configError && <p className="am-err">Payment settings could not be loaded. Cash on delivery remains available. ({configError})</p>}
          <h3>Contact</h3>
          <label>Email<input type="email" name="email" required autoComplete="email" defaultValue={user?.email || ''} /></label>
          <label>Phone<input name="phone" required autoComplete="tel" placeholder="03XX XXXXXXX" /></label>
          <h3>Delivery address</h3>
          <div className="co__row2">
            <label>First name<input name="firstName" required autoComplete="given-name" defaultValue={user?.user_metadata?.first_name || ''} /></label>
            <label>Last name<input name="lastName" autoComplete="family-name" defaultValue={user?.user_metadata?.last_name || ''} /></label>
          </div>
          <label>Address<input name="address1" required autoComplete="street-address" /></label>
          <div className="co__row2">
            <label>City<input name="city" required autoComplete="address-level2" /></label>
            <label>Postal code (optional)<input name="zip" autoComplete="postal-code" /></label>
          </div>
          <h3>Payment</h3>
          <div className="co__payment-options">
            <label className={`co__payment-option${paymentMethod === 'cod' ? ' is-selected' : ''}`}>
              <input type="radio" name="paymentMethod" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
              <span className="co__payment-content">
                <i className="co__payment-icon co__payment-icon--cod" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7h11v11H3zM14 11h4l3 3v4h-7z" />
                    <circle cx="7.5" cy="18" r="1.5" />
                    <circle cx="17.5" cy="18" r="1.5" />
                    <path d="M6 10h5M6 13h3" />
                  </svg>
                </i>
                <span className="co__payment-copy"><b>Cash on delivery</b><small>Pay in cash when your parcel arrives.</small></span>
              </span>
            </label>
            {[
              ['jazzcash', 'JazzCash'],
              ['easypaisa', 'Easypaisa'],
            ].map(([method, label]) => {
              const details = cfg.paymentMethods?.[method];
              return (
                <label className={`co__payment-option${paymentMethod === method ? ' is-selected' : ''}`} key={method}>
                  <input type="radio" name="paymentMethod" value={method} checked={paymentMethod === method} disabled={!details?.enabled} onChange={() => setPaymentMethod(method)} />
                  <span className="co__payment-content">
                    <i className={`co__payment-icon co__payment-icon--${method}`} aria-hidden="true">
                      {method === 'jazzcash' ? (
                        <svg viewBox="0 0 48 36">
                          <path fill="#ed1c24" d="M22 2C29-1 39 0 46 4c2 1 2 3 0 4-9 4-15 10-15 17 0 6 5 11 15 15 2 1 2 3 0 4-8 4-18 3-25-1-6-4-9-10-9-18S15 6 22 2Z" />
                          <path fill="#ffc20e" d="M13 1C23 4 29 11 29 18S24 32 14 36C9 38 3 37 1 35c-2-1-1-3 1-4 7-3 10-7 10-12V5c0-3 0-5 1-4Z" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 48 48">
                          <path fill="#302b3b" fillRule="evenodd" d="M7 19C9 8 19 2 31 2c11 0 17 6 16 15-1 9-11 14-23 14-7 0-13-2-18-5l1-7Zm9-1c3 2 6 3 10 3 7 0 12-3 12-6 0-3-4-5-10-5s-10 2-12 8Z" />
                          <path fill="#28ad60" d="M6 24c5 7 13 11 22 11 8 0 14-3 18-9l2 5c-4 10-13 16-24 16C12 47 4 40 3 30l3-6Z" />
                        </svg>
                      )}
                    </i>
                    <span className="co__payment-copy">
                      <b>{label} {details?.enabled ? 'manual transfer' : '(setup required)'}</b>
                      <small>{details?.enabled ? 'Transfer before placing your order; payment will be verified by the store.' : 'Available after receiving account details are configured.'}</small>
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {paymentMethod !== 'cod' && (() => {
            const details = cfg.paymentMethods[paymentMethod];
            const label = paymentMethod === 'jazzcash' ? 'JazzCash' : 'Easypaisa';
            return (
              <div className="co__wallet-details">
                <b>{label} transfer details</b>
                <p>Account title: <strong>{details.accountName}</strong></p>
                <p>Account number: <strong>{details.accountNumber}</strong></p>
                <label>Transaction reference<input name="paymentReference" required maxLength="100" autoComplete="off" /></label>
              </div>
            );
          })()}
        </form>
        <aside className="cp__sum">
          <h3>Order summary</h3>
          <div className="co__lines">
            {c.lines.map(l => (
              <div className="cp__row" key={l.variantId}>
                <span className="cp__img">{l.image ? <img src={l.image} alt="" /> : <i style={{ '--bot': `url('${bottleUrl(l.handle)}')` }} />}</span>
                <div><span className="cp__t">{l.title}</span>{!l.hasOnlyDefaultVariant && <p className="cp__v">{l.variantTitle}</p>}<p className="cp__v">Qty {l.quantity}</p></div>
                <div className="cp__tot">{money(l.price * l.quantity)}</div>
              </div>
            ))}
          </div>
          <div className="co__code"><input placeholder="Discount code" value={code} onChange={e => setCode(e.target.value)} /><button type="button" onClick={apply}>Apply</button></div>
          {codeErr && <p className="am-msg err" style={{ marginTop: -6 }}>{codeErr}</p>}
          <div className="cp__line"><span>Subtotal</span><b>{money(subtotal)}</b></div>
          {applied && <div className="cp__line disc"><span>Discount ({applied.code})</span><b>−{money(discount)}</b></div>}
          <div className="cp__line"><span>Shipping</span><b>{shipping ? money(shipping) : 'Free'}</b></div>
          <div className="cp__line"><span><b>Total</b></span><b>{money(total)}</b></div>
          <button className="am-btn" type="submit" form="co" disabled={busy}>{busy ? 'Placing order…' : 'Place order'}</button>
          <div className="cp__trust"><span>{paymentMethod === 'cod' ? '💵 Pay on delivery' : '🔐 Wallet transfer verified manually'}</span><span>🔄 7-day easy returns</span><span>✅ 100% authentic</span></div>
        </aside>
      </div>
    </div></section>
  );
}

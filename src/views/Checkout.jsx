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
              <span><b>Cash on delivery</b><small>Pay in cash when your parcel arrives.</small></span>
            </label>
            {[
              ['jazzcash', 'JazzCash'],
              ['easypaisa', 'Easypaisa'],
            ].map(([method, label]) => {
              const details = cfg.paymentMethods?.[method];
              return (
                <label className={`co__payment-option${paymentMethod === method ? ' is-selected' : ''}`} key={method}>
                  <input type="radio" name="paymentMethod" value={method} checked={paymentMethod === method} disabled={!details?.enabled} onChange={() => setPaymentMethod(method)} />
                  <span><b>{label} {details?.enabled ? 'manual transfer' : '(setup required)'}</b>
                    <small>{details?.enabled ? 'Transfer before placing your order; payment will be verified by the store.' : 'Available after receiving account details are configured.'}</small>
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
                <p>Account name: <strong>{details.accountName}</strong></p>
                <p>Account number: <strong>{details.accountNumber}</strong></p>
                {details.qrImageUrl && <img src={details.qrImageUrl} alt={`${label} payment QR code`} loading="lazy" />}
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

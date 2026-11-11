import { useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api.js';
import { footer, footerMenu, mainMenu, newsletter, site } from '../data/siteContent.js';

const ICONS = {
  instagram: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" /></svg>,
  facebook: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z" /></svg>,
  tiktok: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 3a4.5 4.5 0 0 0 3.5 3.9v3a7.6 7.6 0 0 1-3.5-1v6.1a5.5 5.5 0 1 1-5.5-5.5c.3 0 .6 0 .9.1v3.1a2.5 2.5 0 1 0 1.6 2.3V3h3z" /></svg>,
  youtube: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z" /></svg>,
  whatsapp: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.1-1.3A10 10 0 1 0 12 2zm4.8 13.6c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2 1.1 1 2 1.3 2.3 1.4.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l2 .9c.3.1.5.2.5.3.1.2.1.8-.1 1.4z" /></svg>,
  x: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.8 3h3L14.2 10.6 22 21h-6.1l-4.8-6.3L5.6 21h-3l7-8.100L2 3h6.3l4.3 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z" /></svg>,
  pinterest: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.600 19.300c-.1-.8-.2-2 0-2.900l1.200-5s-.3-.6-.3-1.500c0-1.400.8-2.400 1.800-2.400.9 0 1.300.6 1.300 1.400 0 .9-.5 2.100-.8 3.300-.2 1 .5 1.800 1.500 1.800 1.800 0 3.200-1.900 3.200-4.600 0-2.400-1.700-4.100-4.200-4.100-2.900 0-4.600 2.200-4.600 4.400 0 .9.300 1.800.8 2.300.1.100.1.200.1.300l-.3 1.200c0 .2-.2.2-.4.100-1.300-.6-2.100-2.500-2.100-4 0-3.300 2.400-6.400 6.900-6.400 3.600 0 6.400 2.600 6.400 6 0 3.600-2.300 6.500-5.400 6.500-1.100 0-2.100-.6-2.400-1.200l-.7 2.500c-.2.900-.9 2.100-1.300 2.800A10 10 0 1 0 12 2z" /></svg>,
};

export function NewsletterForm({ id, button, tag }) {
  const [state, setState] = useState({ busy: false, ok: false, err: '' });
  const submit = async e => {
    e.preventDefault();
    const email = new FormData(e.currentTarget).get('email');
    setState({ busy: true, ok: false, err: '' });
    try { await api('/newsletter', { method: 'POST', body: { email } }); setState({ busy: false, ok: true, err: '' }); e.target.reset(); }
    catch (er) { setState({ busy: false, ok: false, err: er.message }); }
  };
  return (
    <>
      <form id={id} onSubmit={submit}>
        <input type="email" name="email" required placeholder="Email address" autoComplete="email" />
        <button className="am-btn" disabled={state.busy}>{button}</button>
      </form>
      {state.ok && <p className="am-msg ok">Thanks for subscribing ✓</p>}
      {state.err && <p className="am-msg err">{state.err}</p>}
    </>
  );
}

const Ext = ({ item }) => (item.url.startsWith('/') ? <Link href={item.url}>{item.title}</Link> : <a href={item.url}>{item.title}</a>);

export default function Footer() {
  return (
    <footer className="am-ft">
      <div className="am-ft__in">
        <div className="am-ft__brand">
          <Link href="/" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 0, opacity: 1 }}>
            <span className="am-emb"><img className="am-logo-image" src={site.logoImage || '/assets/ameza-emblem.png'} alt={site.logoImage ? `${site.brand} logo` : ''} /></span>
            <span className="am-wm"><b>{site.brand}</b><small>{site.tagline}</small></span>
          </Link>
          <p style={{ marginTop: 18, maxWidth: 340 }}>{footer.about}</p>
          <div className="am-soc">
            {footer.social.filter(s => s.url).map(s => (
              <a key={s.platform} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.platform}>{ICONS[s.platform]}</a>
            ))}
          </div>
        </div>
        <div><h4>{footer.title1}</h4>{mainMenu.map(l => <Ext key={l.url} item={l} />)}</div>
        <div><h4>{footer.title2}</h4>{footerMenu.map(l => <Ext key={l.url} item={l} />)}</div>
        <div className="am-ft__nl">
          <h4>{footer.newsletterHeading}</h4>
          <p>{footer.nlText}</p>
          <NewsletterForm id="am-ft-nl" button={newsletter.button} />
          {site.phone && <p style={{ marginTop: 16 }}>📞 {site.phone}</p>}
          {site.email && <p>✉️ {site.email}</p>}
          {site.address && <p>📍 {site.address}</p>}
        </div>
      </div>
      <div className="am-ft__bar">
        <span>© {new Date().getFullYear()} {site.brand}. All rights reserved.</span>
        <span />
      </div>
    </footer>
  );
}

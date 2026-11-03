import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Countdown from './Countdown.jsx';
import { useCart } from '../lib/cart.jsx';
import { announcement, mainMenu, site } from '../data/siteContent.js';

export function Announcement() {
  if (!announcement.visible) return null;
  return (
    <div className="am-ann">
      <span>{announcement.text}</span>
      <Countdown end={announcement.end} />
      <span>{announcement.endText}</span>
    </div>
  );
}

const Svg = ({ children, fill }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin={fill || undefined}>{children}</svg>
);

export default function Header() {
  const { count } = useCart();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // close drawer on navigation / Escape, lock page scroll while open
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => { document.body.classList.toggle('am-lock', open); return () => document.body.classList.remove('am-lock'); }, [open]);
  useEffect(() => {
    const k = e => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, []);

  return (
    <header className="am-hd">
      <div className="am-hd__in">
        <div className="am-hd__l">
          <button className="am-hd__burger" type="button" aria-label="Menu" onClick={() => setOpen(true)}>☰</button>
          <nav className="am-hd__nav" aria-label="Main">
            {mainMenu.map(link => (
              <div key={link.url} className={'am-hd__i' + (link.children ? ' has-sub' : '')}>
                <Link href={link.url} aria-current={pathname === link.url ? 'page' : undefined}>{link.title}</Link>
                {link.children && <div className="am-hd__sub">{link.children.map(c => <Link key={c.url} href={c.url}>{c.title}</Link>)}</div>}
              </div>
            ))}
          </nav>
        </div>
        <Link className="am-hd__logo" href="/">
          <span className="am-emb">{site.logoImage ? <img className="am-hd__img" src={site.logoImage} alt={`${site.brand} logo`} /> : <img src="/assets/ameza-emblem.png" alt="" />}</span>
          <span className="am-wm"><b>{site.brand}</b><small>{site.tagline}</small></span>
        </Link>
        <div className="am-hd__r">
          <Link href="/search" aria-label="Search"><Svg><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Svg></Link>
          <Link href="/account" aria-label="Account"><Svg><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></Svg></Link>
          <Link className="am-hd__cart" href="/cart" aria-label="Cart">
            <Svg fill="round"><path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></Svg>
            <b style={{ display: count > 0 ? 'grid' : 'none' }}>{count}</b>
          </Link>
        </div>
      </div>
      <div className="am-drawer" hidden={!open} onClick={e => e.target === e.currentTarget && setOpen(false)}>
        <div className="am-drawer__p">
          <button className="am-drawer__x" type="button" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
          {mainMenu.map(link => (
            <span key={link.url} style={{ display: 'contents' }}>
              <Link href={link.url}>{link.title}</Link>
              {link.children && <div className="sub">{link.children.map(c => <Link key={c.url} href={c.url}>{c.title}</Link>)}</div>}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}

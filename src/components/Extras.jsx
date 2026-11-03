import Link from 'next/link';
import { extras, layoutSettings, site } from '../data/siteContent.js';

// WhatsApp floating button, social-proof data (read by lib/effects.js) and optional sticky buy bar
export default function Extras() {
  const msg = encodeURIComponent('Hi Améza, mujhe perfume ke baare mein poochna hai');
  return (
    <>
      <div data-am-proof data-free="5000" data-list={extras.proofList} hidden />
      {layoutSettings.whatsappVisible && site.whatsapp && <a className="am-wa" href={`https://wa.me/${site.whatsapp}?text=${msg}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.1-1.3A10 10 0 1 0 12 2zm5.2 14c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2 1.1 1 2 1.3 2.3 1.4.3.1.4 0 .6-.1l.8-1c.2-.3.4-.2.6-.1l2 .9c.3.1.5.2.5.3.1.2.1.8-.1 1.4z" /></svg>
      </a>}
      {extras.sticky && (
        <div className="am-sticky"><div>{extras.stickyText}</div><Link className="am-btn" href={extras.stickyLink}>{extras.stickyButton}</Link></div>
      )}
    </>
  );
}

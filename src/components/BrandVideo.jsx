'use client';
import { useState } from 'react';
import { brandVideoSource, DEFAULT_BRAND_VIDEO } from '../lib/brand-video.js';

export default function BrandVideo({ source, poster, caption }) {
  const [failedSource, setFailedSource] = useState(null);
  const [muted, setMuted] = useState(true);
  const requestedSource = brandVideoSource(source);
  const activeSource = failedSource === requestedSource ? DEFAULT_BRAND_VIDEO : requestedSource;
  return (
    <>
      <video key={activeSource} src={activeSource} poster={poster || undefined}
        autoPlay muted={muted} loop playsInline preload="metadata" aria-label={caption || 'Améza brand film'}
        style={{ objectFit: 'contain' }}
        onError={() => { if (activeSource !== DEFAULT_BRAND_VIDEO) setFailedSource(requestedSource); }}>
        Your browser does not support HTML5 video.
      </video>
      <button type="button" className="vd-snd" aria-pressed={!muted} onClick={() => setMuted(value => !value)}>
        {muted ? 'Sound on' : 'Mute'}
      </button>
    </>
  );
}

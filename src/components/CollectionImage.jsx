'use client';
import { useState } from 'react';

export default function CollectionImage({ src, alt = '', fallbackBottle, ...props }) {
  const [failedSource, setFailedSource] = useState(null);
  if (!src || failedSource === src) {
    return fallbackBottle ? <div className="am-demo" style={{ '--bot': `url('${fallbackBottle}')` }} /> : null;
  }
  return <img {...props} src={src} alt={alt} decoding="async" onError={() => setFailedSource(src)} />;
}

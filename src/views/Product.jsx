'use client';
import { Fragment } from 'react';
import { useParams } from 'next/navigation';
import { PdpMain, PdpReviews, PdpStory } from '../components/Pdp.jsx';
import { ProductRail, Video } from '../components/sections.jsx';
import NotFound from './NotFound.jsx';
import { useApi, useTitle } from '../lib/hooks.js';
import { pageSections } from '../data/siteContent.js';

// templates/product.json
export default function Product() {
  const { handle } = useParams();
  const { data, error, loading } = useApi(`/products/${handle}`);
  const p = data?.product;
  useTitle(p?.title, p?.descriptionHtml?.replace(/<[^>]+>/g, ' ').trim().slice(0, 160));
  if (error?.status === 404) return <NotFound />;
  if (loading || !p) return <section className="am-sec" style={{ minHeight: '70vh' }} />;
  const sections = {
    main: <PdpMain key={p.id} product={p} />,
    story: <PdpStory product={p} />,
    video: <Video />,
    reviews: <PdpReviews />,
    recommendations: <ProductRail eyebrow="Complete the collection" heading="You may also like" />,
  };
  return (
    <>
      {pageSections.productOrder.map(name => pageSections.productVisibility[name] !== false && sections[name]
        ? <Fragment key={name}>{sections[name]}</Fragment>
        : null)}
    </>
  );
}

'use client';
import { Fragment } from 'react';
import PerfumeScroll from '../components/PerfumeScroll.jsx';
import MoodPicker from '../components/MoodPicker.jsx';
import { Faq, Newsletter, Offer, ProductRail, Reviews, Tiles, Trust, Video } from '../components/sections.jsx';
import { useTitle } from '../lib/hooks.js';
import { SHOP_NAME } from '../lib/format.js';
import { home } from '../data/siteContent.js';

// templates/index.json
export default function Home() {
  useTitle(SHOP_NAME);
  const sections = {
    hero: <PerfumeScroll />,
    trust: <Trust />,
    tiles: <Tiles />,
    moods: <MoodPicker />,
    bestsellers: <ProductRail {...home.bestsellers} />,
    offer: <Offer />,
    video: <Video />,
    newArrivals: <ProductRail {...home.newArrivals} />,
    reviews: <Reviews />,
    faq: <Faq />,
    newsletter: <Newsletter />,
  };
  return (
    <>
      {home.sectionOrder.map(name => home.sectionVisibility[name] !== false && sections[name]
        ? <Fragment key={name}>{sections[name]}</Fragment>
        : null)}
    </>
  );
}

'use client';
import { Fragment } from 'react';
import { useParams } from 'next/navigation';
import { AboutHero, Contact, Faq, Newsletter, Reviews, Values, Video } from '../components/sections.jsx';
import NotFound from './NotFound.jsx';
import { useApi, useTitle } from '../lib/hooks.js';
import { SHOP_NAME } from '../lib/format.js';
import { pageSections } from '../data/siteContent.js';

// templates/page.about.json
const About = () => {
  useTitle('About');
  const sections = { about: <AboutHero />, values: <Values />, video: <Video />, reviews: <Reviews />, newsletter: <Newsletter /> };
  return <>{pageSections.aboutOrder.map(name => pageSections.aboutVisibility[name] !== false && sections[name] ? <Fragment key={name}>{sections[name]}</Fragment> : null)}</>;
};
// templates/page.contact.json
const ContactPage = () => {
  useTitle('Contact');
  const sections = { contact: <Contact />, faq: <Faq /> };
  return <>{pageSections.contactOrder.map(name => pageSections.contactVisibility[name] !== false && sections[name] ? <Fragment key={name}>{sections[name]}</Fragment> : null)}</>;
};

// templates/page.json + sections/am-page.liquid — any other page stored in the database
function Generic({ handle }) {
  const { data, error } = useApi(`/pages/${handle}`, [handle]);
  useTitle(data?.page.title);
  if (error?.status === 404) return <NotFound />;
  if (!data) return <section className="am-sec" style={{ minHeight: '60vh' }} />;
  return (
    <section className="am-sec"><div className="am-wrap art">
      <p className="am-eb">{SHOP_NAME}</p><h1 className="am-h">{data.page.title}</h1>
      <div className="art__c" style={{ marginTop: 22 }} dangerouslySetInnerHTML={{ __html: data.page.contentHtml }} />
    </div></section>
  );
}

export default function PageRoute() {
  const { handle } = useParams();
  if (handle === 'about') return <About />;
  if (handle === 'contact') return <ContactPage />;
  return <Generic handle={handle} />;
}

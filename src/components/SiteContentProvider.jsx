'use client';
import { Fragment, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { applySiteAppearance, getSiteContentSnapshot, setSiteContentOverrides } from '../data/siteContent.js';

export default function SiteContentProvider({ children }) {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;

    async function loadContent() {
      const { data, error } = await supabase
        .from('site_content')
        .select('content')
        .eq('id', 'default')
        .maybeSingle();
      if (error) throw error;
      if (!active) return;
      const content = data?.content ?? null;
      setSiteContentOverrides(content);
      applySiteAppearance(getSiteContentSnapshot(content).appearance);
      setRevision(value => value + 1);
    }

    loadContent().catch(error => {
      console.error('Could not load website content from Supabase:', error);
    });

    return () => { active = false; };
  }, []);

  return <Fragment key={revision}>{children}</Fragment>;
}

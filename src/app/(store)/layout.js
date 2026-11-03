import Layout from '@/components/Layout.jsx';
import SiteContentProvider from '@/components/SiteContentProvider.jsx';

// Header, footer and site effects for every storefront page (everything except /admin)
export default function StoreLayout({ children }) {
  return <SiteContentProvider><Layout>{children}</Layout></SiteContentProvider>;
}

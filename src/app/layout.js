import { AuthProvider } from '@/lib/auth.jsx';
import { CartProvider } from '@/lib/cart.jsx';
import '@/styles/ameza-store.css';
import '@/styles/additions.css';

export const metadata = {
  title: 'Améza Parfums',
  icons: { icon: '/assets/ameza-logo-black.jpeg' },
};
export const viewport = { themeColor: '#0b1530', viewportFit: 'cover' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap" rel="stylesheet" />
      </head>
      <body className="am-body">
        <AuthProvider>
          <CartProvider>{children}</CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

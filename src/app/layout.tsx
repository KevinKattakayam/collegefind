import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import DemoDataBanner from '@/components/DemoDataBanner';
import AuthProvider from '@/context/AuthProvider';
import { CompareProvider } from '@/context/CompareContext';
import { Toaster } from 'react-hot-toast';
import { SITE_URL } from '@/lib/site';

const description =
  'Search Indian colleges, compare them side by side, and estimate admission chances from official JoSAA and MCC cutoff data. Free, with no sponsored listings.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'CollegeFind — Compare colleges and check admission chances', template: '%s · CollegeFind' },
  description,
  openGraph: { type: 'website', locale: 'en_IN', siteName: 'CollegeFind', title: 'CollegeFind', description },
  twitter: { card: 'summary', title: 'CollegeFind', description },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: '#4F46E5' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className="bg-[#FAFBFD] min-h-screen flex flex-col antialiased">
        <a href="#main" className="skip-link">Skip to main content</a>
        <AuthProvider>
          <CompareProvider>
            <DemoDataBanner />
            <Navbar />
            <main id="main" className="flex-1">{children}</main>
            <Footer />
            <Toaster
              position="bottom-right"
              toastOptions={{
                duration: 4000,
                style: { background: '#1E293B', color: '#fff', fontSize: '14px', borderRadius: '12px', padding: '12px 16px' },
                success: { style: { background: '#047857' } },
                error: { style: { background: '#B91C1C' } },
              }}
            />
          </CompareProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { Montserrat, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Reignova Secure Checkout',
  description: 'Fast, secure mobile money payments powered by Reignova Technologies',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${montserrat.variable} ${ibmPlexMono.variable}`}>
      <body className="min-h-screen bg-brand-navy-950 font-sans text-brand-cream-100 antialiased selection:bg-brand-accent selection:text-brand-navy-950">
        <div className="relative min-h-screen flex flex-col circuit-pattern">
          {children}
        </div>
      </body>
    </html>
  );
}

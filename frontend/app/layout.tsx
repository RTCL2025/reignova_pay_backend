import type { Metadata } from 'next';
import { Montserrat, IBM_Plex_Mono, Inter } from 'next/font/google';
import './globals.css';
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

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
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico' },
      { url: '/icon.png', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn(montserrat.variable, ibmPlexMono.variable, inter.variable)}>
      <body className="min-h-screen bg-canvas-bg font-sans text-slate-900 antialiased selection:bg-brand-gold selection:text-brand-navy-900">
        <TooltipProvider>
          <div className="relative min-h-screen flex flex-col">
            {children}
          </div>
        </TooltipProvider>
      </body>
    </html>
  );
}

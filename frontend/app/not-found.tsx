import Link from 'next/link';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md reignova-card rounded-2xl p-8 border border-white/10 shadow-2xl">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400">
          <AlertCircle className="h-7 w-7" />
        </div>

        <h1 className="text-xl font-bold text-white mb-2">Checkout Link Not Found</h1>
        <p className="text-sm text-brand-slate-400 mb-6">
          This payment session could not be found or has expired. Please return to the merchant site to start a new checkout.
        </p>

        <a
          href="https://reignovatechnologies.com"
          className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-brand-navy-800 hover:bg-brand-navy-700 text-brand-cream-100 text-sm font-medium transition-colors border border-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Go to Reignova Technologies</span>
        </a>
      </div>
    </main>
  );
}

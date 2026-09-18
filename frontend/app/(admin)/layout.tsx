import React from 'react';
import { AdminAuthProvider } from '@/context/AdminAuthContext';

export const metadata = {
  title: {
    template: '%s | Reignova Payment Service Admin',
    default: 'Reignova Payment Service Admin Portal',
  },
  description: 'Enterprise administration and operations portal for Reignova Payment Service',
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans">
        {children}
      </div>
    </AdminAuthProvider>
  );
}

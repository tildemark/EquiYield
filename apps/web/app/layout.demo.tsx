import './globals.css';
import React from 'react';
import DemoBanner from '@/components/DemoBanner';

export const metadata = {
  title: 'EquiYield',
  description: 'Cooperative management system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/equiyield-logo.webp" type="image/webp" />
      </head>
      <body>
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}

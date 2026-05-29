import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Analytics } from "@vercel/analytics/next"
import '../src/styles.css';

export const metadata: Metadata = {
  title: 'Micrographic Creator',
  description: 'A React and Base UI tool for generating dense micrographic layouts.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
      <Analytics />
    </html>
  );
}

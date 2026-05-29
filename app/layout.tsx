import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Analytics } from "@vercel/analytics/next"
import '../src/styles.css';

export const metadata: Metadata = {
  title: 'Micrographic Creator',
  description:
    'Create dense technical graphics, launch visuals, README headers, wallpapers, and social assets as SVG or PNG.',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
      <Analytics />
    </html>
  );
}

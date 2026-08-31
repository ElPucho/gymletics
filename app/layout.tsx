import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Gymletics — Tu progreso, serie a serie',
  description: 'Planes, entrenamientos y progreso del gimnasio en una sola aplicación.',
  applicationName: 'Gymletics',
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    title: 'Gymletics — Tu progreso, serie a serie',
    description: 'Planes, entrenamientos y progreso del gimnasio en una sola aplicación.',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Gymletics — Tu progreso, serie a serie',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gymletics — Tu progreso, serie a serie',
    description: 'Planes, entrenamientos y progreso del gimnasio en una sola aplicación.',
    images: ['/og.png'],
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Gymletics',
  },
};

export const viewport: Viewport = {
  themeColor: '#080808',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';

import './globals.css';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const siteOrigin =
  process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'https://gymletics-daniel.daniel-ml.chatgpt.site';
const publicAsset = (path: string) => `${basePath}${path}`;
const siteUrl = new URL(`${basePath}/`, siteOrigin);
const socialImage = new URL(publicAsset('/og.png'), siteOrigin);

export const metadata: Metadata = {
  title: 'Gymletics — Tu progreso, serie a serie',
  description: 'Planes, entrenamientos y progreso del gimnasio en una sola aplicación.',
  applicationName: 'Gymletics',
  metadataBase: new URL(siteOrigin),
  alternates: {
    canonical: siteUrl,
  },
  manifest: publicAsset('/manifest.webmanifest'),
  openGraph: {
    type: 'website',
    url: siteUrl,
    title: 'Gymletics — Tu progreso, serie a serie',
    description: 'Planes, entrenamientos y progreso del gimnasio en una sola aplicación.',
    images: [
      {
        url: socialImage,
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
    images: [socialImage.toString()],
  },
  icons: {
    icon: [
      { url: publicAsset('/favicon-32.png'), sizes: '32x32', type: 'image/png' },
      { url: publicAsset('/icon-192.png'), sizes: '192x192', type: 'image/png' },
    ],
    apple: publicAsset('/apple-touch-icon.png'),
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

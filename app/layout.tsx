import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from './providers'
import AppShell from '@/components/AppShell'
import { UIProvider } from '@/components/ui'
import { basePath } from '@/lib/basePath'

export const metadata: Metadata = {
  title: 'Bar do Lenilto — Gestão de Mesas',
  description: 'Gestão de mesas e pedidos do Bar do Lenilto',
  manifest: `${basePath}/manifest.json`,
  icons: {
    icon: [
      { url: `${basePath}/icons/icon-32.png`, sizes: '32x32', type: 'image/png' },
      { url: `${basePath}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
    ],
    apple: `${basePath}/icons/icon-180.png`,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Bar do Lenilto',
  },
}

export const viewport = {
  themeColor: '#0d0a0a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Fontes aqui (e não via @import no CSS, que o navegador ignora fora do topo do arquivo) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <AppShell>
          <AuthProvider>
            <UIProvider>{children}</UIProvider>
          </AuthProvider>
        </AppShell>
      </body>
    </html>
  )
}

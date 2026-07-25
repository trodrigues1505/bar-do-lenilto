import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from './providers'
import AppShell from '@/components/AppShell'
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
  themeColor: '#c81d25',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AppShell>
          <AuthProvider>{children}</AuthProvider>
        </AppShell>
      </body>
    </html>
  )
}

import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from './providers'
import AppShell from '@/components/AppShell'

export const metadata: Metadata = {
  title: 'Bar do Lenilto — Gestão de Mesas',
  description: 'Gestão de mesas e pedidos do Bar do Lenilto',
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

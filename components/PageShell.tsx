'use client'

import type { ReactNode } from 'react'
import Topbar from '@/components/Topbar'
import { PageHeader } from '@/components/ui'

/**
 * Estrutura padrão de toda tela logada:
 * navegação + título + conteúdo. O espaço extra embaixo no celular
 * evita que a barra de navegação cubra o fim da página.
 */
export default function PageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh">
      <Topbar />
      <main className="mx-auto w-full max-w-6xl px-4 pb-32 pt-6 sm:px-5 md:pb-14 md:pt-8">
        {title && <PageHeader title={title} subtitle={subtitle} actions={actions} />}
        {children}
      </main>
    </div>
  )
}

export function FullScreenLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-sm text-mute" role="status">
      Carregando…
    </div>
  )
}

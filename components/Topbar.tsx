'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/providers'
import { withBasePath } from '@/lib/basePath'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { useState } from 'react'

export default function Topbar() {
  const { profile, isStaff, isAdmin } = useAuth()
  const rawPathname = usePathname()
  const pathname = rawPathname?.endsWith('/') ? rawPathname : `${rawPathname}/`
  const router = useRouter()
  const supabase = createClient()
  const { canInstall, showIOSHint, promptInstall } = useInstallPrompt()
  const [showIOSModal, setShowIOSModal] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login/')
  }

  const tabs = [
    { href: '/mesas/', label: 'Mesas', show: true },
    { href: '/produtos/', label: 'Produtos', show: isStaff },
    { href: '/usuarios/', label: 'Usuários', show: isAdmin },
  ]

  return (
    <>
      <div className="flex items-center justify-between pb-5 mb-6 border-b-[3px] border-red">
        <div className="flex items-center gap-3">
          <img
            src={withBasePath('/logo.jpg')}
            alt="Bar do Lenilto"
            className="w-11 h-11 rounded-full object-cover shadow-xl"
            style={{ boxShadow: '0 0 14px rgba(200,29,37,.4)' }}
          />
          <div>
            <h1 className="text-2xl leading-none m-0">Bar do Lenilto</h1>
            <div className="text-[11px] text-muted tracking-widest mt-0.5">GESTÃO DE MESAS</div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {(canInstall || showIOSHint) && (
            <button
              onClick={() => (canInstall ? promptInstall() : setShowIOSModal(true))}
              className="flex items-center gap-1.5 bg-red hover:bg-red-bright text-paper text-xs font-display tracking-wide uppercase px-3 py-2 rounded-full shadow-lg"
            >
              📲 Instalar app
            </button>
          )}
          <div className="flex items-center gap-2.5 bg-bgElevated border border-line rounded-full px-3.5 py-2 text-sm">
            <span>{profile?.full_name || profile?.email}</span>
            <span className="bg-red text-paper text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
              {profile?.role}
            </span>
            <button onClick={handleLogout} className="border border-line rounded-md px-2.5 py-1 text-xs text-paperDim hover:border-red hover:text-paper">
              Sair
            </button>
          </div>
        </div>
      </div>

      {showIOSModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-5"
          onClick={(e) => e.target === e.currentTarget && setShowIOSModal(false)}
        >
          <div className="bg-bgElevated border border-line rounded-2xl p-6 max-w-xs w-full text-center shadow-2xl">
            <h3 className="text-lg mb-3">Instalar no iPhone/iPad</h3>
            <p className="text-sm text-paperDim leading-relaxed mb-4">
              Toca no ícone de compartilhar <span className="text-paper">(□ com uma seta pra cima)</span> na
              barra do Safari, depois em <b>"Adicionar à Tela de Início"</b>.
            </p>
            <button
              onClick={() => setShowIOSModal(false)}
              className="bg-red hover:bg-red-bright text-paper font-display tracking-wide uppercase text-sm px-4 py-2 rounded-lg"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.filter(t => t.show).map(t => (
          <Link
            key={t.href}
            href={t.href}
            className={`font-display text-sm tracking-wide uppercase px-4.5 py-2.5 rounded-lg border ${
              pathname === t.href
                ? 'bg-red text-paper border-red shadow-xl'
                : 'bg-bgElevated text-paperDim border-line hover:border-red hover:text-paper'
            }`}
          >
            {t.label}
          </Link>
        ))}
        {isAdmin && (
          <span className="font-display text-sm tracking-wide uppercase px-4.5 py-2.5 rounded-lg border border-line bg-bgElevated text-muted">
            Estoque <span className="text-[10px] align-middle ml-1 bg-bgCard border border-line px-2 py-0.5 rounded-full">Em breve</span>
          </span>
        )}
      </div>
    </>
  )
}

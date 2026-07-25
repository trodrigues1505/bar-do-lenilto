'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/providers'

export default function Topbar() {
  const { profile, isStaff, isAdmin } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const tabs = [
    { href: '/mesas', label: 'Mesas', show: true },
    { href: '/produtos', label: 'Produtos', show: isStaff },
  ]

  return (
    <>
      <div className="flex items-center justify-between pb-5 mb-6 border-b-[3px] border-red">
        <div className="flex items-center gap-3">
          <img
            src="/logo.jpg"
            alt="Bar do Lenilto"
            className="w-11 h-11 rounded-full object-cover shadow-xl"
            style={{ boxShadow: '0 0 14px rgba(200,29,37,.4)' }}
          />
          <div>
            <h1 className="text-2xl leading-none m-0">Bar do Lenilto</h1>
            <div className="text-[11px] text-muted tracking-widest mt-0.5">GESTÃO DE MESAS</div>
          </div>
        </div>
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

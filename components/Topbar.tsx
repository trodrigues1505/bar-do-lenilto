'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  BarChart3,
  Download,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  ShieldCheck,
  Trophy,
  Users,
  Wine,
  Share,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/providers'
import { withBasePath } from '@/lib/basePath'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { Avatar, Badge, Button, Modal, cn } from '@/components/ui'

type Tab = { href: string; label: string; icon: LucideIcon; show: boolean; pin: boolean }

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  funcionario: 'Funcionário',
  cliente: 'Cliente',
}

export default function Topbar() {
  const { profile, isStaff, isAdmin } = useAuth()
  const rawPathname = usePathname()
  const pathname = rawPathname?.endsWith('/') ? rawPathname : `${rawPathname}/`
  const router = useRouter()
  const supabase = createClient()
  const { canInstall, showIOSHint, promptInstall } = useInstallPrompt()

  const [showIOSModal, setShowIOSModal] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const displayName = profile?.full_name || profile?.email || ''
  const canShowInstall = canInstall || showIOSHint

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login/')
  }

  const handleInstall = () => {
    setMenuOpen(false)
    if (canInstall) promptInstall()
    else setShowIOSModal(true)
  }

  // Fecha o menu da conta ao clicar fora ou apertar Esc
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const tabs: Tab[] = [
    { href: '/mesas/', label: 'Mesas', icon: LayoutGrid, show: true, pin: true },
    { href: '/produtos/', label: 'Produtos', icon: Wine, show: isStaff, pin: true },
    { href: '/clientes/', label: isStaff ? 'Clientes' : 'Top clientes', icon: Users, show: true, pin: true },
    { href: '/trofeus/', label: isAdmin ? 'Troféus' : 'Meus troféus', icon: Trophy, show: isAdmin || !isStaff, pin: !isStaff },
    { href: '/estoque/', label: 'Estoque', icon: Package, show: isStaff, pin: true },
    { href: '/dashboard/', label: 'Dashboard', icon: BarChart3, show: isAdmin, pin: false },
    { href: '/usuarios/', label: 'Usuários', icon: ShieldCheck, show: isAdmin, pin: false },
  ]
  const visible = tabs.filter(t => t.show)
  const pinned = visible.filter(t => t.pin)
  const overflow = visible.filter(t => !t.pin)
  const overflowActive = overflow.some(t => t.href === pathname)
  // Com muitas abas (admin), no desktop estreito só o ícone aparece; o rótulo volta em telas largas
  const compact = visible.length > 5

  return (
    <>
      {/* ---------- Cabeçalho (desktop e celular) ---------- */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-5 md:h-16 md:gap-6">
          <Link href="/mesas/" className="flex min-w-0 shrink-0 items-center gap-3" aria-label="Bar do Lenilto — início">
            <img
              src={withBasePath('/logo.jpg')}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-red/50"
            />
            <span className="truncate font-display text-lg uppercase leading-none tracking-wide text-ink md:text-xl">
              Bar do Lenilto
            </span>
          </Link>

          {/* Navegação principal (só desktop) */}
          <nav className="no-scrollbar ml-2 hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex" aria-label="Principal">
            {visible.map(t => {
              const active = t.href === pathname
              const Icon = t.icon
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  title={t.label}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-9 shrink-0 items-center gap-2 rounded-lg text-sm font-medium transition-colors duration-150',
                    compact ? 'px-2.5 min-[1140px]:px-3' : 'px-3',
                    active ? 'bg-raised text-ink' : 'text-ink2 hover:bg-surface hover:text-ink',
                  )}
                >
                  <Icon className={cn('h-4 w-4', active ? 'text-red-bright' : 'text-mute')} aria-hidden />
                  <span className={cn(compact && !active && 'hidden min-[1140px]:inline')}>{t.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {canShowInstall && (
              <Button variant="secondary" size="sm" icon={Download} onClick={handleInstall} className="hidden sm:inline-flex">
                Instalar app
              </Button>
            )}

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen(v => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Menu da conta"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface transition-colors hover:border-lineStrong"
              >
                <Avatar name={displayName} className="border-0" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-12 z-40 w-64 animate-pop-in rounded-2xl border border-lineStrong bg-raised p-2 shadow-2xl"
                >
                  <div className="px-3 pb-3 pt-2">
                    <p className="truncate text-sm font-medium text-ink">{profile?.full_name || 'Minha conta'}</p>
                    {profile?.email && <p className="truncate text-xs text-mute">{profile.email}</p>}
                    {profile?.role && (
                      <Badge tone="red" className="mt-2">
                        {ROLE_LABEL[profile.role] || profile.role}
                      </Badge>
                    )}
                  </div>
                  <div className="border-t border-line pt-1">
                    {canShowInstall && (
                      <button
                        role="menuitem"
                        onClick={handleInstall}
                        className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-ink2 transition-colors hover:bg-hover hover:text-ink sm:hidden"
                      >
                        <Download className="h-4 w-4" aria-hidden /> Instalar app
                      </button>
                    )}
                    <button
                      role="menuitem"
                      onClick={handleLogout}
                      className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-ink2 transition-colors hover:bg-hover hover:text-ink"
                    >
                      <LogOut className="h-4 w-4" aria-hidden /> Sair da conta
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="stripe h-[3px] opacity-90" aria-hidden />
      </header>

      {/* ---------- Barra inferior (só celular) ---------- */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1">
          {pinned.map(t => {
            const active = t.href === pathname
            const Icon = t.icon
            return (
              <li key={t.href} className="min-w-0 flex-1">
                <Link
                  href={t.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                    active ? 'text-ink' : 'text-mute active:text-ink',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                      active && 'bg-red/20',
                    )}
                  >
                    <Icon className={cn('h-[18px] w-[18px]', active && 'text-red-bright')} aria-hidden />
                  </span>
                  <span className="max-w-full truncate px-1">{t.label}</span>
                </Link>
              </li>
            )
          })}
          {overflow.length > 0 && (
            <li className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className={cn(
                  'flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  overflowActive ? 'text-ink' : 'text-mute active:text-ink',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                    overflowActive && 'bg-red/20',
                  )}
                >
                  <Menu className={cn('h-[18px] w-[18px]', overflowActive && 'text-red-bright')} aria-hidden />
                </span>
                Mais
              </button>
            </li>
          )}
        </ul>
      </nav>

      {moreOpen && (
        <Modal onClose={() => setMoreOpen(false)} title="Mais opções" size="sm">
          <ul className="-my-1 space-y-1">
            {overflow.map(t => {
              const Icon = t.icon
              const active = t.href === pathname
              return (
                <li key={t.href}>
                  <Link
                    href={t.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      'flex h-12 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors',
                      active ? 'bg-raised text-ink' : 'text-ink2 hover:bg-raised hover:text-ink',
                    )}
                  >
                    <Icon className={cn('h-5 w-5', active ? 'text-red-bright' : 'text-mute')} aria-hidden />
                    {t.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </Modal>
      )}

      {showIOSModal && (
        <Modal
          onClose={() => setShowIOSModal(false)}
          title="Instalar no iPhone ou iPad"
          size="sm"
          footer={
            <Button variant="primary" full onClick={() => setShowIOSModal(false)}>
              Entendi
            </Button>
          }
        >
          <p className="flex flex-wrap items-center gap-x-1.5 text-sm leading-relaxed text-ink2">
            Toque no botão de compartilhar
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-line bg-raised text-ink">
              <Share className="h-3.5 w-3.5" aria-hidden />
            </span>
            na barra do Safari e escolha <b className="text-ink">Adicionar à Tela de Início</b>.
          </p>
        </Modal>
      )}
    </>
  )
}

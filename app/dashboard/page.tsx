'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Receipt, Users, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/providers'
import PageShell, { FullScreenLoading } from '@/components/PageShell'
import { Card, EmptyState, Field, LoadingBlock, ProgressBar, Select, cn, fmtMoney as fmt } from '@/components/ui'

type ItemRow = { product_name: string; qty: number; unit_price: number; customer_id: string | null; order_id: string; created_at: string }
type OrderRow = { id: string; status: string; total: number; opened_at: string; closed_at: string | null }
type ClientProfile = { id: string; full_name: string | null; email: string | null }

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function Kpi({ icon: Icon, label, value, big }: { icon: LucideIcon; label: string; value: string; big?: boolean }) {
  return (
    <div className="min-w-0 p-4 sm:p-5">
      <p className="flex items-center gap-2 text-xs text-ink2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-mute" aria-hidden />
        <span className="truncate">{label}</span>
      </p>
      <p className={cn('mt-2 truncate font-semibold text-ink tnum', big ? 'text-3xl text-red-bright' : 'text-2xl')}>{value}</p>
    </div>
  )
}

export default function DashboardPage() {
  const { user, isAdmin, isStaff, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [items, setItems] = useState<ItemRow[]>([])
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login/')
  }, [authLoading, user, router])
  useEffect(() => {
    if (!authLoading && user && isStaff && !isAdmin) router.replace('/mesas/')
  }, [authLoading, user, isStaff, isAdmin, router])

  useEffect(() => {
    if (!isAdmin) return
    const load = async () => {
      setLoadingData(true)
      const [{ data: itemRows }, { data: orderRows }, { data: clientRows }] = await Promise.all([
        supabase.from('order_items').select('product_name, qty, unit_price, customer_id, order_id, created_at').order('created_at', { ascending: false }).limit(3000),
        supabase.from('orders').select('id, status, total, opened_at, closed_at').order('opened_at', { ascending: false }).limit(1500),
        supabase.from('profiles').select('id, full_name, email').eq('role', 'cliente').order('full_name'),
      ])
      setItems(itemRows || [])
      setOrders(orderRows || [])
      setClients(clientRows || [])
      setLoadingData(false)
    }
    load()
  }, [isAdmin])

  const topProducts = useMemo(() => {
    const map: Record<string, number> = {}
    items.forEach(it => { map[it.product_name] = (map[it.product_name] || 0) + it.qty })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [items])

  const byHour = useMemo(() => {
    const map: Record<number, number> = {}
    items.forEach(it => {
      const h = new Date(it.created_at).getHours()
      map[h] = (map[h] || 0) + it.qty
    })
    return Array.from({ length: 24 }, (_, h) => ({ h, count: map[h] || 0 }))
  }, [items])

  const byWeekday = useMemo(() => {
    const map: Record<number, number> = {}
    orders.forEach(o => {
      const d = new Date(o.opened_at).getDay()
      map[d] = (map[d] || 0) + 1
    })
    return WEEKDAYS.map((label, i) => ({ label, count: map[i] || 0 }))
  }, [orders])

  const closedOrders = orders.filter(o => o.status === 'fechado')
  const ticketMedio = closedOrders.length > 0 ? closedOrders.reduce((s, o) => s + (o.total || 0), 0) / closedOrders.length : 0
  const faturamentoTotal = closedOrders.reduce((s, o) => s + (o.total || 0), 0)
  const maxHourCount = Math.max(1, ...byHour.map(h => h.count))
  const maxWeekdayCount = Math.max(1, ...byWeekday.map(w => w.count))
  const maxProductCount = Math.max(1, ...topProducts.map(p => p[1]))
  const peakHour = byHour.reduce((best, h) => (h.count > best.count ? h : best), byHour[0])
  const peakWeekday = byWeekday.reduce((best, w) => (w.count > best.count ? w : best), byWeekday[0])

  const clientStats = useMemo(() => {
    if (!selectedClient) return null
    const mine = items.filter(it => it.customer_id === selectedClient)
    if (mine.length === 0) return { favProduct: null, total: 0, visits: 0, favHour: null }
    const prodMap: Record<string, number> = {}
    mine.forEach(it => { prodMap[it.product_name] = (prodMap[it.product_name] || 0) + it.qty })
    const favProduct = Object.entries(prodMap).sort((a, b) => b[1] - a[1])[0]
    const total = mine.reduce((s, it) => s + it.unit_price * it.qty, 0)
    const visits = new Set(mine.map(it => it.order_id)).size
    const hourMap: Record<number, number> = {}
    mine.forEach(it => { const h = new Date(it.created_at).getHours(); hourMap[h] = (hourMap[h] || 0) + 1 })
    const favHour = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0]
    return { favProduct, total, visits, favHour }
  }, [items, selectedClient])

  if (authLoading) return <FullScreenLoading />
  if (!user || !isAdmin) return null

  return (
    <PageShell
      title="Dashboard"
      subtitle="Baseado no histórico de pedidos, até os últimos 3.000 itens lançados."
    >
      {loadingData ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-5">
          <Card className="grid grid-cols-2 divide-x divide-y divide-line overflow-hidden lg:grid-cols-4 lg:divide-y-0">
            <Kpi icon={Wallet} label="Faturamento (fechados)" value={fmt(faturamentoTotal)} big />
            <Kpi icon={Receipt} label="Ticket médio" value={fmt(ticketMedio)} />
            <Kpi icon={CheckCircle2} label="Pedidos fechados" value={String(closedOrders.length)} />
            <Kpi icon={Users} label="Clientes cadastrados" value={String(clients.length)} />
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-4 text-sm font-semibold text-ink">Produtos mais pedidos</h2>
              {topProducts.length === 0 ? (
                <p className="text-sm text-mute">Sem dados ainda.</p>
              ) : (
                <ul className="space-y-3.5">
                  {topProducts.map(([name, count]) => (
                    <li key={name}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-ink">{name}</span>
                        <span className="shrink-0 text-xs text-mute tnum">{count}×</span>
                      </div>
                      <ProgressBar value={(count / maxProductCount) * 100} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold text-ink">Movimento por dia da semana</h2>
                {peakWeekday.count > 0 && <span className="shrink-0 text-xs text-mute">Pico: {peakWeekday.label}</span>}
              </div>
              <ul className="space-y-3.5">
                {byWeekday.map(w => (
                  <li key={w.label}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-ink">{w.label}</span>
                      <span className="text-xs text-mute tnum">{w.count} pedido{w.count === 1 ? '' : 's'}</span>
                    </div>
                    <ProgressBar value={(w.count / maxWeekdayCount) * 100} tone={w.label === peakWeekday.label && w.count > 0 ? 'red' : 'soft'} />
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="p-5">
            <div className="mb-5 flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold text-ink">Horário de pico</h2>
              {peakHour.count > 0 && <span className="shrink-0 text-xs text-mute">Mais movimento às {peakHour.h}h</span>}
            </div>
            <div className="flex h-32 items-end gap-1" role="img" aria-label="Itens lançados por hora do dia">
              {byHour.map(h => (
                <div key={h.h} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${h.h}h: ${h.count} itens`}>
                  <div
                    className={cn('w-full rounded-t transition-[height] duration-500', h.h === peakHour.h && h.count > 0 ? 'bg-red' : 'bg-red/40')}
                    style={{ height: `${(h.count / maxHourCount) * 100}%`, minHeight: h.count > 0 ? '3px' : '0' }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-1" aria-hidden>
              {byHour.map(h => (
                <span key={h.h} className="min-w-0 flex-1 text-center text-[10px] text-mute">
                  {h.h % 6 === 0 ? `${h.h}h` : ''}
                </span>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-ink">Preferências por cliente</h2>
            <div className="max-w-sm">
              <Field label="Cliente">
                <Select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}>
                  <option value="">Escolha um cliente…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}
                </Select>
              </Field>
            </div>

            {selectedClient && clientStats && (
              clientStats.favProduct ? (
                <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    { l: 'Produto favorito', v: `${clientStats.favProduct[0]} (${clientStats.favProduct[1]}×)`, accent: true },
                    { l: 'Total consumido', v: fmt(clientStats.total) },
                    { l: 'Visitas (mesas distintas)', v: String(clientStats.visits) },
                    ...(clientStats.favHour ? [{ l: 'Horário preferido', v: `${clientStats.favHour[0]}h` }] : []),
                  ].map(s => (
                    <div key={s.l} className="min-w-0 rounded-xl border border-line bg-bg p-3.5">
                      <dt className="text-xs text-mute">{s.l}</dt>
                      <dd className={cn('mt-1.5 break-words font-semibold tnum', s.accent ? 'text-red-bright' : 'text-ink')}>{s.v}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-5 text-sm text-mute">Esse cliente ainda não tem itens atribuídos a ele.</p>
              )
            )}

            <p className="mt-5 max-w-2xl text-xs leading-relaxed text-mute">
              Os dados por cliente só existem quando o item é atribuído a alguém na hora de lançar (campo &ldquo;Para quem é&rdquo; na mesa).
              Itens marcados como &ldquo;Compartilhado&rdquo; não entram nessa conta.
            </p>
          </Card>
        </div>
      )}
    </PageShell>
  )
}

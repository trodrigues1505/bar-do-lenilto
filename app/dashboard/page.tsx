'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/providers'
import Topbar from '@/components/Topbar'

type ItemRow = { product_name: string; qty: number; unit_price: number; customer_id: string | null; order_id: string; created_at: string }
type OrderRow = { id: string; status: string; total: number; opened_at: string; closed_at: string | null }
type ClientProfile = { id: string; full_name: string | null; email: string | null }

const fmt = (n: number) => 'R$ ' + n.toFixed(2).replace('.', ',')
const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

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

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted text-sm">Carregando...</div>
  }
  if (!user || !isAdmin) return null

  return (
    <div className="max-w-6xl mx-auto px-5 pt-5 pb-20">
      <Topbar />
      <h2 className="text-xl mb-1">Dashboard 📊</h2>
      <p className="text-muted text-sm mb-6">
        Dados de apoio pra decisão — baseado no histórico de pedidos (até os últimos 3000 itens).
      </p>

      {loadingData ? (
        <div className="text-center text-muted py-8 text-sm">Carregando...</div>
      ) : (
        <>
          <div className="grid gap-3.5 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div className="card p-4">
              <div className="text-[11px] uppercase tracking-wide text-muted mb-1">Faturamento (fechados)</div>
              <div className="font-display text-2xl text-red-bright">{fmt(faturamentoTotal)}</div>
            </div>
            <div className="card p-4">
              <div className="text-[11px] uppercase tracking-wide text-muted mb-1">Ticket médio</div>
              <div className="font-display text-2xl">{fmt(ticketMedio)}</div>
            </div>
            <div className="card p-4">
              <div className="text-[11px] uppercase tracking-wide text-muted mb-1">Pedidos fechados</div>
              <div className="font-display text-2xl">{closedOrders.length}</div>
            </div>
            <div className="card p-4">
              <div className="text-[11px] uppercase tracking-wide text-muted mb-1">Clientes cadastrados</div>
              <div className="font-display text-2xl">{clients.length}</div>
            </div>
          </div>

          <div className="grid gap-5 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
            <div className="card p-4">
              <div className="text-sm font-display mb-3">Produtos mais pedidos</div>
              {topProducts.length === 0 ? <div className="text-muted text-sm">Sem dados ainda.</div> : (
                <div className="space-y-2">
                  {topProducts.map(([name, count]) => (
                    <div key={name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span>{name}</span><span className="text-muted">{count}x</span>
                      </div>
                      <div className="w-full h-2 bg-bgElevated rounded-full overflow-hidden">
                        <div className="h-full bg-red transition-all duration-500" style={{ width: `${(count / maxProductCount) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card p-4">
              <div className="text-sm font-display mb-3">Dia da semana mais movimentado</div>
              <div className="space-y-2">
                {byWeekday.map(w => (
                  <div key={w.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{w.label}</span><span className="text-muted">{w.count} pedidos</span>
                    </div>
                    <div className="w-full h-2 bg-bgElevated rounded-full overflow-hidden">
                      <div className="h-full bg-red transition-all duration-500" style={{ width: `${(w.count / maxWeekdayCount) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card p-4 mb-6">
            <div className="text-sm font-display mb-3">Horário de pico (itens lançados por hora)</div>
            <div className="flex items-end gap-1 h-28">
              {byHour.map(h => (
                <div key={h.h} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div className="w-full bg-red rounded-t transition-all duration-500" style={{ height: `${(h.count / maxHourCount) * 100}%`, minHeight: h.count > 0 ? '3px' : '0' }} />
                  {h.h % 3 === 0 && <span className="text-[9px] text-muted mt-1">{h.h}h</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="text-sm font-display mb-3">Preferências por cliente</div>
            <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="field-input w-full max-w-sm mb-4">
              <option value="">Escolha um cliente...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}
            </select>

            {selectedClient && clientStats && (
              clientStats.favProduct ? (
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                  <div className="bg-bgElevated rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted mb-1">Produto favorito</div>
                    <div className="font-display text-red-bright">{clientStats.favProduct[0]} ({clientStats.favProduct[1]}x)</div>
                  </div>
                  <div className="bg-bgElevated rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted mb-1">Total consumido</div>
                    <div className="font-display">{fmt(clientStats.total)}</div>
                  </div>
                  <div className="bg-bgElevated rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted mb-1">Visitas (mesas distintas)</div>
                    <div className="font-display">{clientStats.visits}</div>
                  </div>
                  {clientStats.favHour && (
                    <div className="bg-bgElevated rounded-lg p-3">
                      <div className="text-[10px] uppercase tracking-wide text-muted mb-1">Horário preferido</div>
                      <div className="font-display">{clientStats.favHour[0]}h</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-muted text-sm">Esse cliente ainda não tem itens atribuídos a ele.</div>
              )
            )}
          </div>

          <p className="text-muted text-xs mt-4">
            Nota: os dados por cliente só existem quando o item é atribuído a alguém na hora de lançar
            (seletor "pra quem é" na mesa) — itens marcados como "Compartilhado" não entram nessa contagem.
          </p>
        </>
      )}
    </div>
  )
}

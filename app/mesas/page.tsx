'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/providers'
import Topbar from '@/components/Topbar'
import OrderPanel from '@/components/OrderPanel'
import FloorMap from '@/components/FloorMap'

type TableStatus = 'livre' | 'ocupada' | 'reservada'
type TableRow = { id: string; number: number; status: TableStatus; pos_x: number | null; pos_y: number | null }
type Product = { id: string; name: string; price: number; category: string }
type MyTable = { table_id: string; table_number: number; total: number; pending: number; items_summary: string | null }
type OpenOrderInfo = { table_id: string; opened_at: string; bill_requested: boolean; total: number }

const fmtMoney = (n: number) => 'R$ ' + n.toFixed(2).replace('.', ',')
const HIGH_VALUE_THRESHOLD = 300
const LONG_TIME_MINUTES = 45

function elapsedLabel(openedAt: string) {
  const mins = Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h${m > 0 ? ` ${m}min` : ''}`
}

export default function MesasPage() {
  const { user, isStaff, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const [tables, setTables] = useState<TableRow[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [totals, setTotals] = useState<Record<string, number>>({})
  const [openOrders, setOpenOrders] = useState<Record<string, OpenOrderInfo>>({})
  const [openTable, setOpenTable] = useState<TableRow | null>(null)
  const [view, setView] = useState<'mapa' | 'grade'>('mapa')
  const [myTables, setMyTables] = useState<MyTable[]>([])
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login/')
  }, [authLoading, user, router])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  const load = async () => {
    const { data: tableRows } = await supabase.from('bar_tables').select('*').order('number')
    setTables(tableRows || [])

    const { data: productRows } = await supabase.from('products').select('*').order('name')
    setProducts(productRows || [])

    if (isStaff) {
      const { data: rows } = await supabase
        .from('orders')
        .select('table_id, opened_at, bill_requested, order_items(unit_price, qty)')
        .eq('status', 'aberto')
      const t: Record<string, number> = {}
      const o: Record<string, OpenOrderInfo> = {}
      ;(rows || []).forEach((row: any) => {
        const total = (row.order_items || []).reduce((sum: number, it: any) => sum + it.unit_price * it.qty, 0)
        t[row.table_id] = total
        o[row.table_id] = { table_id: row.table_id, opened_at: row.opened_at, bill_requested: row.bill_requested, total }
      })
      setTotals(t)
      setOpenOrders(o)
    } else {
      const { data: mine } = await supabase.rpc('get_my_tables')
      setMyTables(mine || [])
    }
  }

  useEffect(() => {
    if (!authLoading) load()
  }, [authLoading, isStaff])

  const addTable = async () => {
    const maxNum = tables.reduce((m, t) => Math.max(m, t.number), 0)
    const count = tables.length
    const posX = Math.min(90, Math.max(10, 14 + (count % 5) * 17))
    const posY = Math.min(92, Math.max(10, 80 + Math.floor(count / 5) * 10))
    await supabase.from('bar_tables').insert({ number: maxNum + 1, pos_x: posX, pos_y: posY })
    await load()
  }

  const updateTablePosition = async (tableId: string, x: number, y: number) => {
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, pos_x: x, pos_y: y } : t))
    await supabase.from('bar_tables').update({ pos_x: x, pos_y: y }).eq('id', tableId)
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted text-sm">Carregando...</div>
  }
  if (!user) return null

  // -------- Visão do cliente (sem indicadores operacionais) --------
  if (!isStaff) {
    return (
      <div className="max-w-6xl mx-auto px-5 pt-5 pb-20">
        <Topbar />
        <h2 className="text-xl mb-1">Minhas Mesas</h2>
        <p className="text-muted text-sm mb-5">Aqui aparecem as mesas em que um atendente te vinculou.</p>
        {myTables.length === 0 ? (
          <div className="text-center text-muted py-10 text-sm">
            Você ainda não está em nenhuma mesa. Peça pro atendente te vincular quando chegar.
          </div>
        ) : (
          <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {myTables.map(t => (
              <div key={t.table_id} className="card card-hover p-5">
                <div className="font-display text-3xl leading-none mb-3">Mesa {t.table_number}</div>
                <div className="text-[11px] tracking-wide uppercase text-muted mb-1.5">Seus pedidos</div>
                <p className="text-sm text-paperDim">{t.items_summary || 'Nada lançado ainda.'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // -------- Indicadores operacionais (derivados, não é dado novo) --------
  const livres = tables.filter(t => t.status === 'livre').length
  const ocupadas = tables.filter(t => t.status === 'ocupada').length
  const reservadas = tables.filter(t => t.status === 'reservada').length
  const consumoAberto = Object.values(totals).reduce((s, v) => s + v, 0)
  const comandasAbertas = Object.keys(openOrders).length

  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase().replace('.', '')

  type AttentionItem = { key: string; emoji: string; tableNumber: number; text: string; tableId: string }
  const attentionItems: AttentionItem[] = []
  Object.values(openOrders).forEach(o => {
    const table = tables.find(t => t.id === o.table_id)
    if (!table) return
    if (o.bill_requested) {
      attentionItems.push({ key: `bill-${o.table_id}`, emoji: '🔴', tableNumber: table.number, text: 'Conta solicitada', tableId: table.id })
    }
    const mins = Math.floor((now - new Date(o.opened_at).getTime()) / 60000)
    if (mins >= LONG_TIME_MINUTES) {
      attentionItems.push({ key: `time-${o.table_id}`, emoji: '🟡', tableNumber: table.number, text: `Ocupada há ${elapsedLabel(o.opened_at)}`, tableId: table.id })
    }
    if (o.total >= HIGH_VALUE_THRESHOLD) {
      attentionItems.push({ key: `value-${o.table_id}`, emoji: '🟡', tableNumber: table.number, text: `${fmtMoney(o.total)} em consumo`, tableId: table.id })
    }
  })
  tables.filter(t => t.status === 'reservada').forEach(t => {
    attentionItems.push({ key: `res-${t.id}`, emoji: '🔵', tableNumber: t.number, text: 'Reservada', tableId: t.id })
  })

  return (
    <div className="max-w-6xl mx-auto px-5 pt-5 pb-20">
      <Topbar />

      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl m-0 leading-none">MESAS</h2>
          <p className="text-muted text-sm mt-1">Visão geral do salão</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted text-xs tracking-wide">Hoje • {hoje}</span>
          <div className="flex gap-1.5 bg-bgElevated border border-line rounded-lg p-1">
            <button onClick={() => setView('mapa')} className={`btn btn-sm ${view === 'mapa' ? 'btn-solid' : 'btn-ghost'}`}>Mapa</button>
            <button onClick={() => setView('grade')} className={`btn btn-sm ${view === 'grade' ? 'btn-solid' : 'btn-ghost'}`}>Grade</button>
          </div>
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        <div className="card p-3.5 text-center">
          <div className="font-display text-2xl text-green-400">{String(livres).padStart(2, '0')}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted mt-0.5">Livres</div>
        </div>
        <div className="card p-3.5 text-center">
          <div className="font-display text-2xl text-red-bright">{String(ocupadas).padStart(2, '0')}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted mt-0.5">Ocupadas</div>
        </div>
        <div className="card p-3.5 text-center">
          <div className="font-display text-2xl text-amber-400">{String(reservadas).padStart(2, '0')}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted mt-0.5">Reservadas</div>
        </div>
        <div className="card p-3.5 text-center">
          <div className="font-display text-xl text-paper">{fmtMoney(consumoAberto)}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted mt-0.5">Consumo Aberto</div>
        </div>
        <div className="card p-3.5 text-center">
          <div className="font-display text-2xl text-paper">{String(comandasAbertas).padStart(2, '0')}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted mt-0.5">Comandas Abertas</div>
        </div>
      </div>

      {/* Mapa/Grade + Atenção lado a lado */}
      <div className="grid gap-5" style={{ gridTemplateColumns: 'minmax(0, 1fr) 280px' }}>
        <div>
          {view === 'mapa' ? (
            <>
              <FloorMap
                tables={tables}
                totals={totals}
                billRequested={Object.fromEntries(Object.entries(openOrders).map(([k, v]) => [k, v.bill_requested]))}
                canDrag={isStaff}
                onOpenTable={setOpenTable}
                onPositionChange={updateTablePosition}
              />
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3 text-xs text-muted">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" /> Livre</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-bright inline-block" /> Ocupada</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Reservada</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" /> Atenção</span>
              </div>
              <p className="text-muted text-xs mt-3">
                Segura e arrasta uma mesa pra reposicionar ela no croqui. Um toque rápido abre o pedido.
              </p>
              <button onClick={addTable} className="btn btn-outline btn-sm mt-3">+ Adicionar mesa</button>
            </>
          ) : (
            <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
              {tables.map(t => {
                const attention = t.status === 'ocupada' && openOrders[t.id]?.bill_requested
                const statusColor = attention ? 'border-blue-400' : t.status === 'ocupada' ? 'border-red-dark' : t.status === 'reservada' ? 'border-amber-500' : 'border-line hover:border-red'
                return (
                  <div key={t.id} onClick={() => setOpenTable(t)}
                    className={`card card-hover p-4 cursor-pointer min-h-[110px] flex flex-col justify-between ${statusColor}`}>
                    <div>
                      <div className="font-display text-2xl leading-none">Mesa {t.number}</div>
                      <div className={`text-[10px] tracking-wide uppercase font-bold mt-1.5 ${attention ? 'text-blue-300' : t.status === 'livre' ? 'text-green-400' : t.status === 'reservada' ? 'text-amber-400' : 'text-red-bright'}`}>
                        ● {attention ? 'Atenção' : t.status === 'livre' ? 'Livre' : t.status === 'reservada' ? 'Reservada' : 'Ocupada'}
                      </div>
                    </div>
                    {t.status === 'ocupada' && <div className="font-display text-sm mt-2">{fmtMoney(totals[t.id] || 0)}</div>}
                  </div>
                )
              })}
              <div onClick={addTable} className="border border-dashed border-line rounded-xl min-h-[110px] flex items-center justify-center cursor-pointer text-muted text-3xl hover:border-red hover:text-red transition-colors">+</div>
            </div>
          )}
        </div>

        {/* Painel de Atenção */}
        <aside className="card p-4 h-fit">
          <div className="font-display text-sm tracking-wide uppercase mb-3 text-paper">⚠ Atenção</div>
          {attentionItems.length === 0 ? (
            <p className="text-muted text-xs">Nada precisando de atenção agora.</p>
          ) : (
            <div className="space-y-2.5">
              {attentionItems.map(a => (
                <button
                  key={a.key}
                  onClick={() => { const t = tables.find(x => x.id === a.tableId); if (t) setOpenTable(t) }}
                  className="block w-full text-left bg-bgElevated hover:bg-bgCard border border-line rounded-lg px-3 py-2 transition-colors"
                >
                  <div className="text-sm">{a.emoji} Mesa {a.tableNumber}</div>
                  <div className="text-muted text-xs mt-0.5">{a.text}</div>
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>

      {openTable && (
        <OrderPanel
          table={openTable}
          products={products}
          onClose={() => setOpenTable(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}

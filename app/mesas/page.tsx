'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/providers'
import PageShell, { FullScreenLoading } from '@/components/PageShell'
import OrderPanel from '@/components/OrderPanel'
import FloorMap from '@/components/FloorMap'
import {
  BellRing,
  CalendarClock,
  Clock,
  LayoutGrid,
  Map as MapIcon,
  Plus,
  Armchair,
  Hand,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react'
import { Badge, Button, Card, EmptyState, Segmented, cn, fmtMoney, useUI } from '@/components/ui'

type TableStatus = 'livre' | 'ocupada' | 'reservada'
type TableRow = { id: string; number: number; status: TableStatus; pos_x: number | null; pos_y: number | null }
type Product = { id: string; name: string; price: number; category: string }
type MyTable = { table_id: string; table_number: number; total: number; pending: number; items_summary: string | null }
type OpenOrderInfo = { table_id: string; opened_at: string; bill_requested: boolean; total: number }

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
  const { toast } = useUI()
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
    const { error } = await supabase.from('bar_tables').insert({ number: maxNum + 1, pos_x: posX, pos_y: posY })
    if (error) { toast.error('Não foi possível adicionar a mesa: ' + error.message); return }
    toast.success(`Mesa ${maxNum + 1} adicionada.`)
    await load()
  }

  const updateTablePosition = async (tableId: string, x: number, y: number) => {
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, pos_x: x, pos_y: y } : t))
    const { error } = await supabase.from('bar_tables').update({ pos_x: x, pos_y: y }).eq('id', tableId)
    if (error) toast.error('A nova posição não foi salva: ' + error.message)
  }

  if (authLoading) return <FullScreenLoading />
  if (!user) return null

  // -------- Visão do cliente (sem indicadores operacionais) --------
  if (!isStaff) {
    return (
      <PageShell title="Minhas mesas" subtitle="As mesas em que um atendente te vinculou aparecem aqui.">
        {myTables.length === 0 ? (
          <Card>
            <EmptyState
              icon={Armchair}
              title="Você ainda não está em nenhuma mesa"
              description="Quando chegar, peça para o atendente te vincular à sua mesa."
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myTables.map(t => (
              <Card key={t.table_id} className="p-5">
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red/15 text-lg font-semibold text-red-bright">
                    {t.table_number}
                  </span>
                  <h2 className="text-lg font-semibold">Mesa {t.table_number}</h2>
                </div>
                <p className="mb-1 text-xs font-medium text-mute">Seus pedidos</p>
                <p className="text-sm text-ink2">{t.items_summary || 'Nada lançado ainda.'}</p>
              </Card>
            ))}
          </div>
        )}
      </PageShell>
    )
  }

  // -------- Indicadores operacionais (derivados, não é dado novo) --------
  const livres = tables.filter(t => t.status === 'livre').length
  const ocupadas = tables.filter(t => t.status === 'ocupada').length
  const reservadas = tables.filter(t => t.status === 'reservada').length
  const consumoAberto = Object.values(totals).reduce((s, v) => s + v, 0)
  const comandasAbertas = Object.keys(openOrders).length

  const hojeRaw = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const hoje = hojeRaw.charAt(0).toUpperCase() + hojeRaw.slice(1)

  type AttentionKind = 'bill' | 'time' | 'value' | 'reserved'
  type AttentionItem = { key: string; kind: AttentionKind; tableNumber: number; text: string; tableId: string }
  const attentionItems: AttentionItem[] = []
  Object.values(openOrders).forEach(o => {
    const table = tables.find(t => t.id === o.table_id)
    if (!table) return
    if (o.bill_requested) {
      attentionItems.push({ key: `bill-${o.table_id}`, kind: 'bill', tableNumber: table.number, text: 'Pediu a conta', tableId: table.id })
    }
    const mins = Math.floor((now - new Date(o.opened_at).getTime()) / 60000)
    if (mins >= LONG_TIME_MINUTES) {
      attentionItems.push({ key: `time-${o.table_id}`, kind: 'time', tableNumber: table.number, text: `Ocupada há ${elapsedLabel(o.opened_at)}`, tableId: table.id })
    }
    if (o.total >= HIGH_VALUE_THRESHOLD) {
      attentionItems.push({ key: `value-${o.table_id}`, kind: 'value', tableNumber: table.number, text: `${fmtMoney(o.total)} em consumo`, tableId: table.id })
    }
  })
  tables.filter(t => t.status === 'reservada').forEach(t => {
    attentionItems.push({ key: `res-${t.id}`, kind: 'reserved', tableNumber: t.number, text: 'Reservada', tableId: t.id })
  })
  // Conta pedida primeiro: é o que o cliente está esperando
  const kindOrder: Record<AttentionKind, number> = { bill: 0, time: 1, value: 2, reserved: 3 }
  attentionItems.sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind])

  const kindStyle: Record<AttentionKind, { icon: typeof BellRing; cls: string }> = {
    bill: { icon: BellRing, cls: 'bg-info/15 text-info' },
    time: { icon: Clock, cls: 'bg-warn/15 text-warn' },
    value: { icon: TrendingUp, cls: 'bg-warn/15 text-warn' },
    reserved: { icon: CalendarClock, cls: 'bg-warn/15 text-warn' },
  }

  return (
    <PageShell
      title="Mesas"
      subtitle={hoje}
      actions={
        <>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'mapa', label: 'Mapa', icon: MapIcon },
              { value: 'grade', label: 'Grade', icon: LayoutGrid },
            ]}
          />
          <Button variant="primary" icon={Plus} onClick={addTable}>
            Nova mesa
          </Button>
        </>
      }
    >
      {/* Resumo do salão */}
      <Card className="mb-6 grid gap-x-8 gap-y-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div>
          <p className="text-xs font-medium text-mute">Consumo em aberto</p>
          <p className="mt-1 text-3xl font-semibold leading-none text-ink tnum sm:text-4xl">{fmtMoney(consumoAberto)}</p>
          <p className="mt-2 text-sm text-ink2">
            {comandasAbertas === 0 ? 'Nenhuma comanda aberta' : `${comandasAbertas} comanda${comandasAbertas > 1 ? 's' : ''} aberta${comandasAbertas > 1 ? 's' : ''}`}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-3 sm:justify-self-end sm:border-l sm:border-line sm:pl-8">
          {[
            { label: 'Livres', value: livres, dot: 'bg-ok' },
            { label: 'Ocupadas', value: ocupadas, dot: 'bg-red-bright' },
            { label: 'Reservadas', value: reservadas, dot: 'bg-warn' },
          ].map(i => (
            <div key={i.label} className="min-w-0 sm:min-w-[84px]">
              <dd className="text-2xl font-semibold leading-none text-ink tnum">{i.value}</dd>
              <dt className="mt-2 flex items-center gap-1.5 text-xs text-ink2">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', i.dot)} aria-hidden />
                <span className="truncate">{i.label}</span>
              </dt>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
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
              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-ink2">
                <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {[
                    { l: 'Livre', c: 'bg-ok' },
                    { l: 'Ocupada', c: 'bg-red-bright' },
                    { l: 'Reservada', c: 'bg-warn' },
                    { l: 'Pediu a conta', c: 'bg-info' },
                  ].map(i => (
                    <li key={i.l} className="flex items-center gap-1.5">
                      <span className={cn('h-2.5 w-2.5 rounded-full', i.c)} aria-hidden /> {i.l}
                    </li>
                  ))}
                </ul>
                <p className="flex items-center gap-1.5 text-mute">
                  <Hand className="h-3.5 w-3.5" aria-hidden />
                  Toque para abrir. Segure e arraste para mover.
                </p>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {tables.map(t => {
                const attention = t.status === 'ocupada' && openOrders[t.id]?.bill_requested
                const open = openOrders[t.id]
                const ring = attention
                  ? 'border-info/50'
                  : t.status === 'ocupada'
                  ? 'border-red/40'
                  : t.status === 'reservada'
                  ? 'border-warn/40'
                  : 'border-line hover:border-lineStrong'
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setOpenTable(t)}
                    className={cn(
                      'flex min-h-[116px] flex-col justify-between rounded-2xl border bg-surface p-4 text-left transition-colors hover:bg-raised',
                      ring,
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-2xl font-semibold leading-none text-ink tnum">{t.number}</span>
                      {attention ? (
                        <Badge tone="blue" icon={BellRing}>Conta</Badge>
                      ) : t.status === 'ocupada' ? (
                        <Badge tone="red">Ocupada</Badge>
                      ) : t.status === 'reservada' ? (
                        <Badge tone="amber">Reservada</Badge>
                      ) : (
                        <Badge tone="green">Livre</Badge>
                      )}
                    </div>
                    {t.status === 'ocupada' ? (
                      <div>
                        <p className="text-lg font-semibold text-ink tnum">{fmtMoney(totals[t.id] || 0)}</p>
                        {open && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-mute">
                            <Clock className="h-3 w-3" aria-hidden /> {elapsedLabel(open.opened_at)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-mute">Mesa {t.number}</p>
                    )}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={addTable}
                className="flex min-h-[116px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-lineStrong text-sm text-mute transition-colors hover:border-red/60 hover:text-ink"
              >
                <Plus className="h-5 w-5" aria-hidden />
                Nova mesa
              </button>
            </div>
          )}
        </div>

        {/* Precisa de atenção */}
        <aside aria-label="Precisa de atenção" className="h-fit">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">Precisa de atenção</h2>
              {attentionItems.length > 0 && <Badge tone="red">{attentionItems.length}</Badge>}
            </div>
            {attentionItems.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-xl bg-raised px-3 py-3 text-sm text-ink2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" aria-hidden />
                Tudo tranquilo no salão.
              </div>
            ) : (
              <ul className="space-y-2">
                {attentionItems.map(a => {
                  const k = kindStyle[a.kind]
                  const Icon = k.icon
                  return (
                    <li key={a.key}>
                      <button
                        type="button"
                        onClick={() => { const t = tables.find(x => x.id === a.tableId); if (t) setOpenTable(t) }}
                        className="flex w-full items-center gap-3 rounded-xl border border-line bg-bg px-3 py-2.5 text-left transition-colors hover:border-lineStrong hover:bg-raised"
                      >
                        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', k.cls)}>
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink">Mesa {a.tableNumber}</span>
                          <span className="block truncate text-xs text-mute">{a.text}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
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
    </PageShell>
  )
}

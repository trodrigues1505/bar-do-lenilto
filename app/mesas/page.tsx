'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/providers'
import Topbar from '@/components/Topbar'
import OrderPanel from '@/components/OrderPanel'
import FloorMap from '@/components/FloorMap'

type TableRow = { id: string; number: number; status: 'livre' | 'ocupada'; pos_x: number | null; pos_y: number | null }
type Product = { id: string; name: string; price: number; category: string }
type MyTable = { table_id: string; table_number: number; total: number; pending: number; items_summary: string | null }

export default function MesasPage() {
  const { user, isStaff, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const [tables, setTables] = useState<TableRow[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [totals, setTotals] = useState<Record<string, number>>({})
  const [openTable, setOpenTable] = useState<TableRow | null>(null)
  const [view, setView] = useState<'mapa' | 'grade'>('mapa')
  const [myTables, setMyTables] = useState<MyTable[]>([])

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login/')
  }, [authLoading, user, router])

  const load = async () => {
    const { data: tableRows } = await supabase.from('bar_tables').select('*').order('number')
    setTables(tableRows || [])

    const { data: productRows } = await supabase.from('products').select('*').order('name')
    setProducts(productRows || [])

    if (isStaff) {
      const { data: openOrders } = await supabase
        .from('orders')
        .select('id, table_id, order_items(unit_price, qty)')
        .eq('status', 'aberto')
      const t: Record<string, number> = {}
      ;(openOrders || []).forEach((o: any) => {
        t[o.table_id] = (o.order_items || []).reduce(
          (sum: number, it: any) => sum + it.unit_price * it.qty, 0
        )
      })
      setTotals(t)
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
    return (
      <div className="min-h-screen flex items-center justify-center text-muted text-sm">
        Carregando...
      </div>
    )
  }
  if (!user) return null

  return (
    <div className="max-w-6xl mx-auto px-5 pt-5 pb-20">
      <Topbar />

      {!isStaff ? (
        <>
          <h2 className="text-xl mb-1">Minhas Mesas</h2>
          <p className="text-muted text-sm mb-5">
            Aqui aparecem as mesas em que um atendente te vinculou.
          </p>
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
                  <p className="text-sm text-paperDim">
                    {t.items_summary || 'Nada lançado ainda.'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl m-0">Mesas ({tables.length})</h2>
        <div className="flex gap-1.5 bg-bgElevated border border-line rounded-lg p-1">
          <button
            onClick={() => setView('mapa')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-display tracking-wide uppercase transition ${view === 'mapa' ? 'bg-red text-paper' : 'text-paperDim hover:text-paper'}`}
          >
            Mapa
          </button>
          <button
            onClick={() => setView('grade')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-display tracking-wide uppercase transition ${view === 'grade' ? 'bg-red text-paper' : 'text-paperDim hover:text-paper'}`}
          >
            Grade
          </button>
        </div>
      </div>

      {view === 'mapa' ? (
        <>
          <FloorMap
            tables={tables}
            totals={totals}
            canDrag={isStaff}
            onOpenTable={setOpenTable}
            onPositionChange={updateTablePosition}
          />
          {isStaff && (
            <p className="text-muted text-xs mt-3">
              Segura e arrasta uma mesa pra reposicionar ela no croqui. Um toque rápido abre o pedido.
            </p>
          )}
          {isStaff && (
            <button
              onClick={addTable}
              className="mt-4 bg-bgElevated border border-dashed border-line rounded-lg px-4 py-2 text-sm text-muted hover:border-red hover:text-red"
            >
              + Adicionar mesa
            </button>
          )}
        </>
      ) : (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
          {tables.map(t => (
            <div
              key={t.id}
              onClick={() => setOpenTable(t)}
              className={`bg-bgCard border rounded-xl p-4 cursor-pointer min-h-[120px] flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-xl transition ${
                t.status === 'ocupada' ? 'border-red-dark bg-gradient-to-br from-red/10 to-bgCard' : 'border-line hover:border-red'
              }`}
            >
              <div>
                <div className="font-display text-3xl leading-none">Mesa {t.number}</div>
                <div className={`text-[10px] tracking-wide uppercase font-bold mt-1.5 ${t.status === 'livre' ? 'text-green-400' : 'text-red-bright'}`}>
                  ● {t.status === 'livre' ? 'Livre' : 'Ocupada'}
                </div>
              </div>
              {t.status === 'ocupada' && (
                <div className="font-display text-base mt-2.5">
                  R$ {(totals[t.id] || 0).toFixed(2).replace('.', ',')}
                </div>
              )}
            </div>
          ))}
          {isStaff && (
            <div
              onClick={addTable}
              className="bg-bgElevated border border-dashed border-line rounded-xl min-h-[120px] flex items-center justify-center cursor-pointer text-muted text-3xl hover:border-red hover:text-red"
            >
              +
            </div>
          )}
        </div>
      )}

      {openTable && (
        <OrderPanel
          table={openTable}
          products={products}
          onClose={() => setOpenTable(null)}
          onChanged={load}
        />
      )}
      </>
      )}
    </div>
  )
}   

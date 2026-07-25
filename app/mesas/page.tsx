'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/providers'
import Topbar from '@/components/Topbar'
import OrderPanel from '@/components/OrderPanel'

type TableRow = { id: string; number: number; status: 'livre' | 'ocupada' }
type Product = { id: string; name: string; price: number; category: string }

export default function MesasPage() {
  const { user, isStaff, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login/')
  }, [authLoading, user, router])
  const [tables, setTables] = useState<TableRow[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [totals, setTotals] = useState<Record<string, number>>({})
  const [openTable, setOpenTable] = useState<TableRow | null>(null)

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
    }
  }

  useEffect(() => {
    if (!authLoading) load()
  }, [authLoading, isStaff])

  const addTable = async () => {
    const maxNum = tables.reduce((m, t) => Math.max(m, t.number), 0)
    await supabase.from('bar_tables').insert({ number: maxNum + 1 })
    await load()
  }

  if (authLoading || !user) return null

  return (
    <div className="max-w-6xl mx-auto px-5 pt-5 pb-20">
      <Topbar />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl m-0">Mesas ({tables.length})</h2>
      </div>

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

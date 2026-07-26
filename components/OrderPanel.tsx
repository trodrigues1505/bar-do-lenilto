'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/providers'
import { adjustStockForProduct } from '@/lib/stock'

type Product = { id: string; name: string; price: number; category: string }
type Item = {
  id: string
  product_id: string
  product_name: string
  unit_price: number
  qty: number
  paid_qty: number
}
type TableRow = { id: string; number: number; status: 'livre' | 'ocupada' }
type Customer = { id: string; full_name: string | null; email: string | null }

const fmt = (n: number) => 'R$ ' + n.toFixed(2).replace('.', ',')

export default function OrderPanel({
  table,
  products,
  onClose,
  onChanged,
}: {
  table: TableRow
  products: Product[]
  onClose: () => void
  onChanged: () => void
}) {
  const { isStaff, isAdmin, user } = useAuth()
  const supabase = createClient()
  const [orderId, setOrderId] = useState<string | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [selectedProduct, setSelectedProduct] = useState(products[0]?.id || '')
  const [qty, setQty] = useState(1)
  const [loading, setLoading] = useState(true)
  const [settlingItem, setSettlingItem] = useState<string | null>(null)
  const [settleQty, setSettleQty] = useState(1)

  const [customerId, setCustomerId] = useState<string | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)

  const total = items.reduce((sum, it) => sum + it.unit_price * it.qty, 0)
  const totalPago = items.reduce((sum, it) => sum + it.unit_price * it.paid_qty, 0)
  const totalPendente = total - totalPago

  const loadOrder = async () => {
    setLoading(true)
    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('table_id', table.id)
      .eq('status', 'aberto')
      .maybeSingle()

    if (order) {
      setOrderId(order.id)
      setCustomerId(order.customer_id || null)
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id)
      setItems(orderItems || [])
    } else {
      setOrderId(null)
      setCustomerId(null)
      setItems([])
    }
    setLoading(false)
  }

  useEffect(() => { loadOrder() }, [table.id])

  useEffect(() => {
    if (!isStaff) return
    supabase.from('profiles').select('id, full_name, email').eq('role', 'cliente').order('full_name')
      .then(({ data }) => setCustomers(data || []))
  }, [isStaff])

  const ensureOrder = async () => {
    if (orderId) return orderId
    const { data: newOrder, error } = await supabase
      .from('orders')
      .insert({ table_id: table.id, opened_by: user?.id })
      .select()
      .single()
    if (error || !newOrder) return null
    await supabase.from('bar_tables').update({ status: 'ocupada' }).eq('id', table.id)
    setOrderId(newOrder.id)
    return newOrder.id as string
  }

  const attachCustomer = async (id: string | null) => {
    const oid = await ensureOrder()
    if (!oid) return
    await supabase.from('orders').update({ customer_id: id }).eq('id', oid)
    setCustomerId(id)
    setShowCustomerPicker(false)
  }

  const addItem = async () => {
    const product = products.find(p => p.id === selectedProduct)
    if (!product) return
    const oid = await ensureOrder()
    if (!oid) return

    const existing = items.find(it => it.product_id === product.id)
    if (existing) {
      await supabase.from('order_items').update({ qty: existing.qty + qty }).eq('id', existing.id)
    } else {
      await supabase.from('order_items').insert({
        order_id: oid,
        product_id: product.id,
        product_name: product.name,
        unit_price: product.price,
        qty,
      })
    }
    await adjustStockForProduct(product.id, qty)
    await loadOrder()
    onChanged()
  }

  const changeQty = async (item: Item, delta: number) => {
    const newQty = Math.max(item.paid_qty, item.qty + delta)
    if (newQty < 1 || newQty === item.qty) return
    await supabase.from('order_items').update({ qty: newQty }).eq('id', item.id)
    await adjustStockForProduct(item.product_id, newQty - item.qty)
    await loadOrder()
  }

  const removeItem = async (item: Item) => {
    if (item.paid_qty > 0) {
      alert('Esse item já tem baixa parcial paga — não dá pra remover, só ajustar a quantidade.')
      return
    }
    await supabase.from('order_items').delete().eq('id', item.id)
    await adjustStockForProduct(item.product_id, -item.qty)
    const remaining = items.filter(it => it.id !== item.id)
    if (remaining.length === 0 && orderId) {
      await supabase.from('bar_tables').update({ status: 'livre' }).eq('id', table.id)
    }
    await loadOrder()
    onChanged()
  }

  const openSettle = (item: Item) => {
    setSettlingItem(item.id)
    setSettleQty(item.qty - item.paid_qty)
  }

  const confirmSettle = async (item: Item) => {
    const remaining = item.qty - item.paid_qty
    const qtyToSettle = Math.min(Math.max(1, settleQty), remaining)
    if (qtyToSettle <= 0) return

    await supabase.from('order_item_payments').insert({
      order_item_id: item.id,
      qty: qtyToSettle,
      amount: qtyToSettle * item.unit_price,
      settled_by: user?.id,
    })
    await supabase.from('order_items').update({ paid_qty: item.paid_qty + qtyToSettle }).eq('id', item.id)
    setSettlingItem(null)
    await loadOrder()
    onChanged()
  }

  const closeOrder = async () => {
    if (!orderId || items.length === 0) return
    const msg = totalPendente > 0
      ? `Ainda falta ${fmt(totalPendente)} pra quitar nessa mesa. Mesmo assim fechar o pedido (total: ${fmt(total)})?`
      : `Fechar o pedido da Mesa ${table.number} no valor de ${fmt(total)}?`
    if (!confirm(msg)) return

    await supabase.from('orders').update({
      status: 'fechado',
      closed_at: new Date().toISOString(),
      total,
    }).eq('id', orderId)
    await supabase.from('bar_tables').update({ status: 'livre' }).eq('id', table.id)

    if (customerId) {
      const { data: settings } = await supabase.from('app_settings').select('points_per_real').eq('id', 1).single()
      const ratio = settings?.points_per_real ?? 1
      const points = Math.round(total * ratio)
      if (points > 0) {
        await supabase.from('loyalty_transactions').insert({
          customer_id: customerId,
          points,
          reason: `Compra na Mesa ${table.number}`,
          order_id: orderId,
          created_by: user?.id,
        })
      }
    }

    onChanged()
    onClose()
  }

  const deleteTable = async () => {
    const warn = items.length > 0
      ? `A Mesa ${table.number} tem um pedido em aberto. Excluir mesmo assim? Isso apaga a mesa e todo o histórico dela.`
      : `Excluir a Mesa ${table.number}? Isso apaga o histórico de pedidos dessa mesa também.`
    if (!confirm(warn)) return

    const { error, count } = await supabase
      .from('bar_tables')
      .delete({ count: 'exact' })
      .eq('id', table.id)

    if (error) {
      alert('Erro ao excluir mesa: ' + error.message)
      return
    }
    if (!count) {
      alert('Não foi possível excluir — confira se a permissão "admin_delete_tables" foi criada no Supabase (SQL Editor).')
      return
    }
    onChanged()
    onClose()
  }

  const selectedCustomer = customers.find(c => c.id === customerId)
  const filteredCustomers = customers.filter(c =>
    (c.full_name || c.email || '').toLowerCase().includes(customerSearch.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel-enter bg-bgElevated border border-line rounded-2xl w-full max-w-xl max-h-[88vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line sticky top-0 bg-bgElevated z-10">
          <h2 className="text-2xl m-0">Mesa {table.number}</h2>
          <button onClick={onClose} className="text-muted hover:text-red-bright text-2xl bg-transparent border-none cursor-pointer">✕</button>
        </div>

        <div className="px-6 py-4">
          {isStaff && (
            <div className="mb-4">
              {selectedCustomer ? (
                <div className="flex items-center justify-between bg-bgCard border border-line rounded-lg px-3 py-2 text-sm">
                  <span>👤 {selectedCustomer.full_name || selectedCustomer.email}</span>
                  <button onClick={() => attachCustomer(null)} className="text-muted hover:text-red-bright text-xs bg-transparent border-none cursor-pointer">
                    remover
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCustomerPicker(v => !v)}
                  className="text-xs border border-dashed border-line rounded-lg px-3 py-2 text-muted hover:border-red hover:text-paper w-full text-left"
                >
                  + Vincular cliente cadastrado (pra pontuar)
                </button>
              )}
              {showCustomerPicker && !selectedCustomer && (
                <div className="mt-2 bg-bgCard border border-line rounded-lg p-2.5">
                  <input
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Buscar cliente por nome..."
                    className="w-full bg-bg border border-line rounded px-2.5 py-1.5 mb-2 text-sm"
                  />
                  <div className="max-h-40 overflow-y-auto">
                    {filteredCustomers.length === 0 && (
                      <div className="text-xs text-muted py-2">Nenhum cliente encontrado.</div>
                    )}
                    {filteredCustomers.map(c => (
                      <button
                        key={c.id}
                        onClick={() => attachCustomer(c.id)}
                        className="block w-full text-left text-sm py-1.5 px-1 hover:text-red-bright bg-transparent border-none cursor-pointer"
                      >
                        {c.full_name || c.email}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {isStaff && (
            <div className="flex gap-2 mb-4">
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="flex-1 bg-bg border border-line rounded-lg px-3 py-2.5"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {fmt(p.price)}</option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 bg-bg border border-line rounded-lg text-center"
              />
              <button onClick={addItem} className="bg-red hover:bg-red-bright text-paper font-display tracking-wide rounded-lg px-4">
                Adicionar
              </button>
            </div>
          )}

          {loading ? (
            <div className="text-center text-muted py-8 text-sm">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="text-center text-muted py-8 text-sm">Nenhum item lançado ainda.</div>
          ) : (
            items.map(item => {
              const remaining = item.qty - item.paid_qty
              const isFullyPaid = remaining === 0
              return (
                <div key={item.id} className="py-2.5 border-b border-line">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{item.product_name}</div>
                      <div className="text-muted text-xs">
                        {fmt(item.unit_price)} un.
                        {item.paid_qty > 0 && (
                          <span className="text-green-400"> · {item.paid_qty} pago{item.paid_qty > 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button onClick={() => changeQty(item, -1)} className="w-6.5 h-6.5 rounded bg-bgCard border border-line hover:border-red">−</button>
                      <span>{item.qty}</span>
                      <button onClick={() => changeQty(item, 1)} className="w-6.5 h-6.5 rounded bg-bgCard border border-line hover:border-red">+</button>
                      <span className="font-display min-w-[70px] text-right">{fmt(item.unit_price * item.qty)}</span>
                      <button onClick={() => removeItem(item)} className="text-muted hover:text-red-bright bg-transparent border-none cursor-pointer">✕</button>
                    </div>
                  </div>

                  {isStaff && !isFullyPaid && settlingItem !== item.id && (
                    <button
                      onClick={() => openSettle(item)}
                      className="mt-2 text-xs border border-line rounded-full px-3 py-1 text-paperDim hover:border-red hover:text-paper"
                    >
                      Dar baixa ({remaining} pendente{remaining > 1 ? 's' : ''})
                    </button>
                  )}

                  {settlingItem === item.id && (
                    <div className="mt-2 flex items-center gap-2 bg-bgCard border border-line rounded-lg p-2.5">
                      <span className="text-xs text-muted">Quantas unidades foram pagas agora?</span>
                      <input
                        type="number"
                        min={1}
                        max={remaining}
                        value={settleQty}
                        onChange={(e) => setSettleQty(Math.min(remaining, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-16 bg-bg border border-line rounded px-2 py-1 text-center"
                      />
                      <button onClick={() => confirmSettle(item)} className="bg-green-600 text-[#0c0909] font-display text-xs px-3 py-1.5 rounded">
                        Confirmar
                      </button>
                      <button onClick={() => setSettlingItem(null)} className="text-muted text-xs hover:text-paper">
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="px-6 py-4 border-t border-line sticky bottom-0 bg-bgElevated">
          <div className="flex justify-between items-center text-xs text-muted mb-1">
            <span>Total do pedido</span>
            <span>{fmt(total)}</span>
          </div>
          {totalPago > 0 && (
            <div className="flex justify-between items-center text-xs text-green-400 mb-1">
              <span>Já pago</span>
              <span>{fmt(totalPago)}</span>
            </div>
          )}
          <div className="flex justify-between items-center mb-3.5">
            <span className="text-muted text-xs tracking-wide uppercase">Falta pagar</span>
            <span className="font-display text-3xl text-red-bright">{fmt(totalPendente)}</span>
          </div>
          {isStaff && table.status === 'ocupada' && (
            <button
              onClick={closeOrder}
              disabled={items.length === 0}
              className="w-full bg-green-500 disabled:opacity-30 text-[#0c0909] font-display tracking-wide uppercase py-3 rounded-lg"
            >
              Fechar Pedido
            </button>
          )}
          {isAdmin && (
            <button
              onClick={deleteTable}
              className="w-full mt-2.5 text-xs text-muted hover:text-red-bright border border-line hover:border-red-dark rounded-lg py-2 bg-transparent"
            >
              Excluir mesa
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

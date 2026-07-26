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
  customer_id: string | null
}
type TableRow = { id: string; number: number; status: 'livre' | 'ocupada' }
type Customer = { id: string; full_name: string | null; email: string | null }
type Payment = { id: string; amount: number; payer_customer_id: string | null; method: string | null; created_at: string }

const fmt = (n: number) => 'R$ ' + n.toFixed(2).replace('.', ',')

type PayMode = 'total' | 'itens' | 'valor' | null

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
  const [payments, setPayments] = useState<Payment[]>([])
  const [checkins, setCheckins] = useState<Customer[]>([])
  const [selectedProduct, setSelectedProduct] = useState(products[0]?.id || '')
  const [qty, setQty] = useState(1)
  const [itemFor, setItemFor] = useState('')
  const [loading, setLoading] = useState(true)

  const [allCustomers, setAllCustomers] = useState<Customer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)

  const [payMode, setPayMode] = useState<PayMode>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payPayer, setPayPayer] = useState('')
  const [payMethod, setPayMethod] = useState('dinheiro')
  const [itemSelections, setItemSelections] = useState<Record<string, number>>({})
  const [submittingPayment, setSubmittingPayment] = useState(false)

  const itemsTotal = items.reduce((sum, it) => sum + it.unit_price * it.qty, 0)
  const paymentsTotal = payments.reduce((sum, p) => sum + p.amount, 0)
  const total = itemsTotal
  const totalPago = paymentsTotal
  const totalPendente = Math.max(0, total - totalPago)
  const quitado = items.length > 0 && totalPendente <= 0.005

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
      const [{ data: orderItems }, { data: orderPayments }] = await Promise.all([
        supabase.from('order_items').select('*').eq('order_id', order.id),
        supabase.from('order_payments').select('*').eq('order_id', order.id).order('created_at'),
      ])
      setItems(orderItems || [])
      setPayments(orderPayments || [])
    } else {
      setOrderId(null)
      setItems([])
      setPayments([])
    }

    const { data: checkinRows } = await supabase
      .from('table_checkins')
      .select('customer_id, profiles(id, full_name, email)')
      .eq('table_id', table.id)
    setCheckins((checkinRows || []).map((r: any) => r.profiles).filter(Boolean))

    setLoading(false)
  }

  useEffect(() => { loadOrder() }, [table.id])

  useEffect(() => {
    if (!isStaff) return
    supabase.from('profiles').select('id, full_name, email').eq('role', 'cliente').order('full_name')
      .then(({ data }) => setAllCustomers(data || []))
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

  const addCheckin = async (customer: Customer) => {
    const { data: elsewhere } = await supabase.rpc('customer_active_tables', { p_customer_id: customer.id })
    const other = (elsewhere || []).find((t: any) => t.table_id !== table.id)
    if (other) {
      const ok = confirm(`${customer.full_name || customer.email} já está na Mesa ${other.table_number}. Adicionar aqui também (sem tirar de lá)?`)
      if (!ok) return
    }
    await supabase.from('table_checkins').insert({ table_id: table.id, customer_id: customer.id, checked_in_by: user?.id })
    setShowCustomerPicker(false)
    setCustomerSearch('')
    await loadOrder()
  }

  const removeCheckin = async (customerId: string) => {
    await supabase.from('table_checkins').delete().eq('table_id', table.id).eq('customer_id', customerId)
    await loadOrder()
  }

  const addItem = async () => {
    const product = products.find(p => p.id === selectedProduct)
    if (!product) return
    const oid = await ensureOrder()
    if (!oid) return

    const forCustomer = itemFor || null
    const existing = items.find(it => it.product_id === product.id && it.customer_id === forCustomer)
    if (existing) {
      await supabase.from('order_items').update({ qty: existing.qty + qty }).eq('id', existing.id)
    } else {
      await supabase.from('order_items').insert({
        order_id: oid, product_id: product.id, product_name: product.name, unit_price: product.price, qty,
        customer_id: forCustomer,
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

  // "Dar baixa" aqui = remover um item lançado por engano. Só admin.
  const removeItem = async (item: Item) => {
    if (item.paid_qty > 0) {
      alert('Esse item já tem pagamento registrado em cima dele — não dá pra remover.')
      return
    }
    if (!confirm(`Remover "${item.product_name}" do pedido? Use isso só quando o item foi lançado errado.`)) return
    await supabase.from('order_items').delete().eq('id', item.id)
    await adjustStockForProduct(item.product_id, -item.qty)
    const remaining = items.filter(it => it.id !== item.id)
    if (remaining.length === 0 && orderId) {
      await supabase.from('bar_tables').update({ status: 'livre' }).eq('id', table.id)
    }
    await loadOrder()
    onChanged()
  }

  const nameOf = (id: string | null) => {
    if (!id) return null
    return allCustomers.find(c => c.id === id)?.full_name || allCustomers.find(c => c.id === id)?.email
      || checkins.find(c => c.id === id)?.full_name || checkins.find(c => c.id === id)?.email
  }

  const openPayForm = (mode: PayMode) => {
    setPayMode(mode)
    setPayAmount('')
    setPayPayer('')
    if (mode === 'itens') {
      const sel: Record<string, number> = {}
      items.forEach(it => { if (it.qty > it.paid_qty) sel[it.id] = 0 })
      setItemSelections(sel)
    }
  }

  const itemsSelectionTotal = Object.entries(itemSelections).reduce((sum, [id, q]) => {
    const it = items.find(i => i.id === id)
    return sum + (it ? it.unit_price * q : 0)
  }, 0)

  const submitPayment = async () => {
    if (!orderId || !payMode) return
    setSubmittingPayment(true)

    let amount = 0
    let itemDeltas: { id: string; delta: number }[] = []

    if (payMode === 'total') {
      amount = totalPendente
      itemDeltas = items.filter(it => it.qty > it.paid_qty).map(it => ({ id: it.id, delta: it.qty - it.paid_qty }))
    } else if (payMode === 'itens') {
      amount = itemsSelectionTotal
      itemDeltas = Object.entries(itemSelections).filter(([, q]) => q > 0).map(([id, q]) => ({ id, delta: q }))
    } else {
      amount = parseFloat(payAmount.replace(',', '.'))
    }

    if (isNaN(amount) || amount <= 0) {
      alert('Informe um valor válido maior que zero.')
      setSubmittingPayment(false)
      return
    }

    await supabase.from('order_payments').insert({
      order_id: orderId, amount, payer_customer_id: payPayer || null, method: payMethod, created_by: user?.id,
    })

    for (const d of itemDeltas) {
      const item = items.find(i => i.id === d.id)
      if (!item) continue
      await supabase.from('order_items').update({ paid_qty: item.paid_qty + d.delta }).eq('id', item.id)
    }

    if (payPayer) {
      const { data: settings } = await supabase.from('app_settings').select('points_per_real').eq('id', 1).single()
      const ratio = settings?.points_per_real ?? 1
      const points = Math.round(amount * ratio)
      if (points > 0) {
        await supabase.from('loyalty_transactions').insert({
          customer_id: payPayer, points, reason: `Pagamento na Mesa ${table.number}`, order_id: orderId, created_by: user?.id,
        })
      }
    }

    setPayMode(null)
    setSubmittingPayment(false)
    await loadOrder()
  }

  const closeOrder = async () => {
    if (!orderId || items.length === 0) return
    const msg = totalPendente > 0
      ? `Ainda falta ${fmt(totalPendente)} pra quitar nessa mesa. Mesmo assim fechar o pedido (total: ${fmt(total)})?`
      : `Fechar o pedido da Mesa ${table.number} no valor de ${fmt(total)}?`
    if (!confirm(msg)) return

    await supabase.from('orders').update({ status: 'fechado', closed_at: new Date().toISOString(), total }).eq('id', orderId)
    await supabase.from('bar_tables').update({ status: 'livre' }).eq('id', table.id)
    await supabase.from('table_checkins').delete().eq('table_id', table.id)

    onChanged()
    onClose()
  }

  const deleteTable = async () => {
    const warn = items.length > 0
      ? `A Mesa ${table.number} tem um pedido em aberto. Excluir mesmo assim? Isso apaga a mesa e todo o histórico dela.`
      : `Excluir a Mesa ${table.number}? Isso apaga o histórico de pedidos dessa mesa também.`
    if (!confirm(warn)) return

    const { error, count } = await supabase.from('bar_tables').delete({ count: 'exact' }).eq('id', table.id)
    if (error) { alert('Erro ao excluir mesa: ' + error.message); return }
    if (!count) { alert('Não foi possível excluir — confira se a permissão "admin_delete_tables" foi criada no Supabase.'); return }
    onChanged()
    onClose()
  }

  const filteredCustomers = allCustomers.filter(c =>
    !checkins.some(k => k.id === c.id) &&
    (c.full_name || c.email || '').toLowerCase().includes(customerSearch.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel-enter card w-full max-w-xl max-h-[88vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line sticky top-0 bg-bgElevated z-10">
          <h2 className="text-2xl m-0">Mesa {table.number}</h2>
          <button onClick={onClose} className="btn btn-ghost text-2xl">✕</button>
        </div>

        <div className="px-6 py-4">
          {isStaff && (
            <div className="mb-5">
              <div className="text-[11px] tracking-wide uppercase text-muted mb-2">Clientes na mesa</div>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {checkins.map(c => (
                  <span key={c.id} className="chip">
                    👤 {c.full_name || c.email}
                    <button onClick={() => removeCheckin(c.id)} className="btn-ghost bg-transparent border-none cursor-pointer text-muted hover:text-red-bright p-0">✕</button>
                  </span>
                ))}
                <button onClick={() => setShowCustomerPicker(v => !v)} className="btn btn-outline btn-sm btn-pill">
                  + adicionar cliente
                </button>
              </div>
              {showCustomerPicker && (
                <div className="mt-2 card p-2.5">
                  <input
                    value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Buscar cliente por nome..." className="field-input w-full mb-2"
                  />
                  <div className="max-h-40 overflow-y-auto">
                    {filteredCustomers.length === 0 && <div className="text-xs text-muted py-2">Nenhum cliente encontrado.</div>}
                    {filteredCustomers.map(c => (
                      <button key={c.id} onClick={() => addCheckin(c)}
                        className="block w-full text-left text-sm py-1.5 px-1 hover:text-red-bright bg-transparent border-none cursor-pointer transition-colors">
                        {c.full_name || c.email}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {isStaff && (
            <div className="flex gap-2 mb-5 flex-wrap">
              <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}
                className="field-input flex-1 min-w-[160px]">
                {products.map(p => <option key={p.id} value={p.id}>{p.name} — {fmt(p.price)}</option>)}
              </select>
              <input type="number" min={1} value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="field-input w-16 text-center" />
              {checkins.length > 0 && (
                <select value={itemFor} onChange={(e) => setItemFor(e.target.value)} className="field-input text-sm">
                  <option value="">Compartilhado</option>
                  {checkins.map(c => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}
                </select>
              )}
              <button onClick={addItem} className="btn btn-solid">Adicionar</button>
            </div>
          )}

          {loading ? (
            <div className="text-center text-muted py-8 text-sm">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="text-center text-muted py-8 text-sm">Nenhum item lançado ainda.</div>
          ) : (
            items.map((item, i) => (
              <div key={item.id} className="fade-in-up flex items-center justify-between py-2.5 border-b border-line" style={{ animationDelay: `${i * 30}ms` }}>
                <div>
                  <div className="font-medium">{item.product_name}</div>
                  <div className="text-muted text-xs">
                    {fmt(item.unit_price)} un.
                    {item.paid_qty > 0 && <span className="text-green-400"> · {item.paid_qty} pago{item.paid_qty > 1 ? 's' : ''}</span>}
                    {item.customer_id && <span> · 👤 {nameOf(item.customer_id)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isStaff && <button onClick={() => changeQty(item, -1)} className="w-6.5 h-6.5 rounded bg-bgElevated border border-line hover:border-red transition-colors">−</button>}
                  <span className="min-w-[16px] text-center">{item.qty}</span>
                  {isStaff && <button onClick={() => changeQty(item, 1)} className="w-6.5 h-6.5 rounded bg-bgElevated border border-line hover:border-red transition-colors">+</button>}
                  <span className="font-display min-w-[70px] text-right">{fmt(item.unit_price * item.qty)}</span>
                  {isAdmin && (
                    <button onClick={() => removeItem(item)} className="btn btn-danger-outline btn-sm">
                      Dar baixa
                    </button>
                  )}
                </div>
              </div>
            ))
          )}

          {isStaff && orderId && (
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] tracking-wide uppercase text-muted">Pagamentos registrados</div>
              </div>
              {payments.length > 0 && (
                <div className="mb-3">
                  {payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b border-line">
                      <span className="text-paperDim">
                        {p.method || 'pagamento'} {nameOf(p.payer_customer_id) ? `· ${nameOf(p.payer_customer_id)}` : ''}
                      </span>
                      <span className="font-display text-green-400">{fmt(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {!payMode ? (
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => openPayForm('total')} className="btn btn-outline btn-sm" disabled={totalPendente <= 0}>Pagar total</button>
                  <button onClick={() => openPayForm('itens')} className="btn btn-outline btn-sm" disabled={items.every(it => it.qty <= it.paid_qty)}>Pagar por itens</button>
                  <button onClick={() => openPayForm('valor')} className="btn btn-outline btn-sm">Pagar valor livre</button>
                </div>
              ) : (
                <div className="card p-3.5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-display text-sm uppercase tracking-wide">
                      {payMode === 'total' ? 'Pagamento total' : payMode === 'itens' ? 'Pagar por itens' : 'Valor livre'}
                    </span>
                    <button onClick={() => setPayMode(null)} className="btn btn-ghost btn-sm">Cancelar</button>
                  </div>

                  {payMode === 'total' && (
                    <div className="text-center mb-3">
                      <div className="text-muted text-xs uppercase tracking-wide">Valor a registrar</div>
                      <div className="font-display text-3xl text-red-bright">{fmt(totalPendente)}</div>
                    </div>
                  )}

                  {payMode === 'itens' && (
                    <div className="mb-3 space-y-2">
                      {items.filter(it => it.qty > it.paid_qty).map(it => {
                        const remaining = it.qty - it.paid_qty
                        return (
                          <div key={it.id} className="flex items-center justify-between text-sm">
                            <span>{it.product_name} <span className="text-muted text-xs">({remaining} pendente{remaining > 1 ? 's' : ''})</span></span>
                            <input
                              type="number" min={0} max={remaining}
                              value={itemSelections[it.id] ?? 0}
                              onChange={(e) => setItemSelections(prev => ({ ...prev, [it.id]: Math.min(remaining, Math.max(0, parseInt(e.target.value) || 0)) }))}
                              className="field-input w-16 text-center"
                            />
                          </div>
                        )
                      })}
                      <div className="flex justify-between text-sm pt-2 border-t border-line">
                        <span className="text-muted">Total selecionado</span>
                        <span className="font-display text-red-bright">{fmt(itemsSelectionTotal)}</span>
                      </div>
                    </div>
                  )}

                  {payMode === 'valor' && (
                    <input
                      value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                      type="text" inputMode="decimal" placeholder="Valor (ex: 50)"
                      className="field-input w-full mb-3"
                    />
                  )}

                  <div className="flex gap-2 flex-wrap mb-3">
                    <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="field-input text-sm">
                      <option value="dinheiro">Dinheiro</option>
                      <option value="pix">Pix</option>
                      <option value="cartao">Cartão</option>
                    </select>
                    <select value={payPayer} onChange={(e) => setPayPayer(e.target.value)} className="field-input text-sm flex-1 min-w-[160px]">
                      <option value="">Pagador (opcional, pra pontuar)</option>
                      {checkins.map(c => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}
                    </select>
                  </div>

                  <button onClick={submitPayment} disabled={submittingPayment} className="btn btn-success w-full">
                    {submittingPayment ? 'Registrando...' : 'Confirmar pagamento'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-line sticky bottom-0 bg-bgElevated">
          {quitado && (
            <div className="pulse-success bg-green-600/15 border border-green-600 text-green-400 text-xs rounded-lg px-3 py-2 mb-3 text-center font-display tracking-wide uppercase">
              ✅ Saldo quitado — pode fechar a mesa!
            </div>
          )}
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
            <button onClick={closeOrder} disabled={items.length === 0} className="btn w-full py-3" style={{ background: quitado ? '#4ade80' : '#22c55e', color: '#0c0909', fontFamily: 'Anton', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Fechar Pedido
            </button>
          )}
          {isAdmin && (
            <button onClick={deleteTable} className="btn btn-danger-outline w-full mt-2.5">
              Excluir mesa
            </button>
          )}
        </div>
      </div>
    </div>
  )
}   

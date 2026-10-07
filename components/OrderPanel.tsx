'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/providers'
import { adjustStockForProduct } from '@/lib/stock'
import {
  Banknote,
  BellRing,
  CalendarClock,
  CalendarX2,
  CircleCheck,
  CreditCard,
  ListChecks,
  Plus,
  QrCode,
  Receipt,
  Search,
  Trash2,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  LoadingBlock,
  Modal,
  Select,
  Stepper,
  cn,
  fmtMoney as fmt,
  useUI,
} from '@/components/ui'

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
type TableStatus = 'livre' | 'ocupada' | 'reservada'
type TableRow = { id: string; number: number; status: TableStatus }
type Customer = { id: string; full_name: string | null; email: string | null }
type Payment = { id: string; amount: number; payer_customer_id: string | null; method: string | null; created_at: string }

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
  const { toast, confirm } = useUI()
  const [orderId, setOrderId] = useState<string | null>(null)
  const [billRequested, setBillRequested] = useState(false)
  const [tableStatus, setTableStatus] = useState<TableStatus>(table.status)
  const [items, setItems] = useState<Item[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [checkins, setCheckins] = useState<Customer[]>([])
  const [selectedProduct, setSelectedProduct] = useState(products[0]?.id || '')
  const [categoryFilter, setCategoryFilter] = useState('')
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

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)))
  const visibleProducts = categoryFilter ? products.filter(p => p.category === categoryFilter) : products
  // Se o produto escolhido saiu da lista filtrada, usa o primeiro da lista visível
  const effectiveProduct = visibleProducts.some(p => p.id === selectedProduct)
    ? selectedProduct
    : visibleProducts[0]?.id || ''

  const itemsTotal = items.reduce((sum, it) => sum + it.unit_price * it.qty, 0)
  const paymentsTotal = payments.reduce((sum, p) => sum + p.amount, 0)
  const total = itemsTotal
  const totalPago = paymentsTotal
  const totalPendente = Math.max(0, total - totalPago)
  const quitado = items.length > 0 && totalPendente <= 0.005

  const loadOrder = async () => {
    setLoading(true)
    const { data: freshTable } = await supabase.from('bar_tables').select('status').eq('id', table.id).single()
    if (freshTable) setTableStatus(freshTable.status)

    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('table_id', table.id)
      .eq('status', 'aberto')
      .maybeSingle()

    if (order) {
      setOrderId(order.id)
      setBillRequested(order.bill_requested || false)
      const [{ data: orderItems }, { data: orderPayments }] = await Promise.all([
        supabase.from('order_items').select('*').eq('order_id', order.id),
        supabase.from('order_payments').select('*').eq('order_id', order.id).order('created_at'),
      ])
      setItems(orderItems || [])
      setPayments(orderPayments || [])
    } else {
      setOrderId(null)
      setBillRequested(false)
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
    setTableStatus('ocupada')
    setOrderId(newOrder.id)
    return newOrder.id as string
  }

  const toggleBillRequested = async () => {
    const oid = await ensureOrder()
    if (!oid) return
    const next = !billRequested
    await supabase.from('orders').update({ bill_requested: next }).eq('id', oid)
    setBillRequested(next)
  }

  const markReserved = async () => {
    await supabase.from('bar_tables').update({ status: 'reservada' }).eq('id', table.id)
    setTableStatus('reservada')
    onChanged()
  }

  const cancelReservation = async () => {
    await supabase.from('bar_tables').update({ status: 'livre' }).eq('id', table.id)
    setTableStatus('livre')
    onChanged()
  }

  const addCheckin = async (customer: Customer) => {
    const { data: elsewhere } = await supabase.rpc('customer_active_tables', { p_customer_id: customer.id })
    const other = (elsewhere || []).find((t: any) => t.table_id !== table.id)
    if (other) {
      const ok = await confirm({
        title: 'Cliente já está em outra mesa',
        message: `${customer.full_name || customer.email} já está na Mesa ${other.table_number}. Adicionar aqui também, sem tirar de lá?`,
        confirmLabel: 'Adicionar aqui também',
      })
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
    const product = products.find(p => p.id === effectiveProduct)
    if (!product) { toast.error('Escolha um produto para lançar.'); return }
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

  const removeItem = async (item: Item) => {
    if (item.paid_qty > 0) {
      toast.error('Esse item já tem pagamento registrado — não dá para remover.')
      return
    }
    const okRemove = await confirm({
      title: `Dar baixa em "${item.product_name}"?`,
      message: 'Use isso só quando o item foi lançado por engano. Ele sai do pedido e volta para o estoque.',
      confirmLabel: 'Dar baixa',
      tone: 'danger',
    })
    if (!okRemove) return
    await supabase.from('order_items').delete().eq('id', item.id)
    await adjustStockForProduct(item.product_id, -item.qty)
    const remaining = items.filter(it => it.id !== item.id)
    if (remaining.length === 0 && orderId) {
      await supabase.from('bar_tables').update({ status: 'livre' }).eq('id', table.id)
      setTableStatus('livre')
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
      toast.error('Informe um valor válido, maior que zero.')
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
    toast.success(`Pagamento de ${fmt(amount)} registrado.`)
    await loadOrder()
  }

  const closeOrder = async () => {
    if (!orderId || items.length === 0) return
    const okClose = await confirm({
      title: `Fechar a Mesa ${table.number}?`,
      message: totalPendente > 0
        ? `Ainda faltam ${fmt(totalPendente)} para quitar. Se fechar agora, o pedido vai constar com total de ${fmt(total)}.`
        : `O pedido de ${fmt(total)} está quitado. A mesa volta a ficar livre.`,
      confirmLabel: 'Fechar pedido',
    })
    if (!okClose) return

    await supabase.from('orders').update({ status: 'fechado', closed_at: new Date().toISOString(), total }).eq('id', orderId)
    await supabase.from('bar_tables').update({ status: 'livre' }).eq('id', table.id)
    await supabase.from('table_checkins').delete().eq('table_id', table.id)

    toast.success(`Mesa ${table.number} fechada.`)
    onChanged()
    onClose()
  }

  const deleteTable = async () => {
    const okDelete = await confirm({
      title: `Excluir a Mesa ${table.number}?`,
      message: items.length > 0
        ? 'Essa mesa tem um pedido em aberto. Excluir apaga a mesa e todo o histórico dela. Não dá para desfazer.'
        : 'Excluir apaga a mesa e o histórico de pedidos dela. Não dá para desfazer.',
      confirmLabel: 'Excluir mesa',
      tone: 'danger',
    })
    if (!okDelete) return

    const { error, count } = await supabase.from('bar_tables').delete({ count: 'exact' }).eq('id', table.id)
    if (error) { toast.error('Erro ao excluir a mesa: ' + error.message); return }
    if (!count) { toast.error('Não foi possível excluir. Confira se a permissão "admin_delete_tables" foi criada no Supabase.'); return }
    toast.success(`Mesa ${table.number} excluída.`)
    onChanged()
    onClose()
  }

  const filteredCustomers = allCustomers.filter(c =>
    !checkins.some(k => k.id === c.id) &&
    (c.full_name || c.email || '').toLowerCase().includes(customerSearch.toLowerCase())
  )

  const statusBadge =
    tableStatus === 'reservada' ? (
      <Badge tone="amber" icon={CalendarClock}>Reservada</Badge>
    ) : billRequested && tableStatus === 'ocupada' ? (
      <Badge tone="blue" icon={BellRing}>Conta pedida</Badge>
    ) : tableStatus === 'ocupada' ? (
      <Badge tone="red">Ocupada</Badge>
    ) : (
      <Badge tone="green">Livre</Badge>
    )

  const payTitle = payMode === 'total' ? 'Pagar o total' : payMode === 'itens' ? 'Pagar por itens' : 'Pagar um valor livre'

  const footer = (
    <div>
      {quitado && (
        <div className="pulse-success mb-3 flex items-center justify-center gap-2 rounded-xl border border-ok/30 bg-ok/10 px-3 py-2 text-sm font-medium text-ok">
          <CircleCheck className="h-4 w-4" aria-hidden />
          Saldo quitado. Pode fechar a mesa.
        </div>
      )}
      <div className="mb-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-ink2">Falta pagar</p>
          <p className={cn('text-3xl font-semibold leading-tight tnum', quitado ? 'text-ok' : 'text-ink')}>
            {fmt(totalPendente)}
          </p>
        </div>
        <p className="shrink-0 text-right text-xs leading-5 text-mute tnum">
          Total {fmt(total)}
          {totalPago > 0 && (
            <>
              <br />
              <span className="text-ok">Pago {fmt(totalPago)}</span>
            </>
          )}
        </p>
      </div>
      {isStaff && tableStatus === 'ocupada' && (
        <Button
          variant={quitado ? 'success' : 'primary'}
          size="lg"
          full
          icon={Receipt}
          disabled={items.length === 0}
          onClick={closeOrder}
        >
          Fechar pedido
        </Button>
      )}
    </div>
  )

  return (
    <Modal onClose={onClose} title={`Mesa ${table.number}`} titleAdornment={statusBadge} footer={footer}>
      <div className="space-y-6">
        {/* Reserva */}
        {isStaff && tableStatus === 'livre' && (
          <Button variant="secondary" size="sm" icon={CalendarClock} onClick={markReserved}>
            Marcar como reservada
          </Button>
        )}
        {isStaff && tableStatus === 'reservada' && (
          <Button variant="secondary" size="sm" icon={CalendarX2} onClick={cancelReservation}>
            Cancelar reserva
          </Button>
        )}

        {/* Clientes na mesa */}
        {isStaff && (
          <section aria-label="Clientes na mesa">
            <h3 className="mb-2.5 text-sm font-semibold text-ink2">Clientes na mesa</h3>
            <div className="no-scrollbar -mx-5 flex items-center gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              <Button variant="secondary" size="sm" icon={UserPlus} onClick={() => setShowCustomerPicker(v => !v)} className="shrink-0">
                Adicionar cliente
              </Button>
              {checkins.map(c => (
                <span
                  key={c.id}
                  className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full border border-line bg-raised pl-1 pr-1 text-sm text-ink"
                >
                  <Avatar name={c.full_name || c.email} size="sm" />
                  <span className="max-w-[160px] truncate">{c.full_name || c.email}</span>
                  <button
                    type="button"
                    onClick={() => removeCheckin(c.id)}
                    aria-label={`Remover ${c.full_name || c.email} da mesa`}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-mute transition-colors hover:bg-hover hover:text-red-bright"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              ))}
            </div>

            {showCustomerPicker && (
              <Card className="mt-3 animate-fade-in p-3">
                <Input
                  icon={Search}
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  placeholder="Buscar cliente pelo nome"
                  autoFocus
                />
                <div className="mt-2 max-h-44 overflow-y-auto">
                  {filteredCustomers.length === 0 && (
                    <p className="px-1 py-3 text-sm text-mute">Nenhum cliente encontrado.</p>
                  )}
                  {filteredCustomers.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => addCheckin(c)}
                      className="flex h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm text-ink transition-colors hover:bg-raised"
                    >
                      <Avatar name={c.full_name || c.email} size="sm" />
                      <span className="min-w-0 truncate">{c.full_name || c.email}</span>
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </section>
        )}

        {/* Lançar item */}
        {isStaff && (
          <section aria-label="Lançar item">
            <h3 className="mb-2.5 text-sm font-semibold text-ink2">Lançar item</h3>
            <Card className="space-y-3 bg-bg p-3">
              {categories.length > 1 && (
                <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
                  {['', ...categories].map(cat => (
                    <button
                      key={cat || 'todas'}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      aria-pressed={categoryFilter === cat}
                      className={cn(
                        'h-8 shrink-0 rounded-full border px-3 text-[13px] font-medium transition-colors',
                        categoryFilter === cat
                          ? 'border-red/50 bg-red/15 text-ink'
                          : 'border-line bg-surface text-ink2 hover:border-lineStrong hover:text-ink',
                      )}
                    >
                      {cat || 'Todos'}
                    </button>
                  ))}
                </div>
              )}

              {/* Celular: seletor em linha própria (para o preço não ser cortado). Telas maiores: 2 linhas compactas. */}
              <div className="grid grid-cols-[auto_1fr] items-center gap-3 sm:grid-cols-[1fr_auto]">
                <div className="col-span-2 min-w-0 sm:col-span-1">
                  <Select
                    aria-label="Produto"
                    value={effectiveProduct}
                    onChange={e => setSelectedProduct(e.target.value)}
                  >
                    {visibleProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.name} — {fmt(p.price)}</option>
                    ))}
                  </Select>
                </div>
                <Stepper label="quantidade" value={qty} onChange={setQty} />
                {checkins.length > 0 && (
                  <div className="min-w-0">
                    <Select aria-label="Para quem é o item" value={itemFor} onChange={e => setItemFor(e.target.value)}>
                      <option value="">Compartilhado</option>
                      {checkins.map(c => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}
                    </Select>
                  </div>
                )}
                <Button
                  variant="primary"
                  size="lg"
                  icon={Plus}
                  onClick={addItem}
                  disabled={!effectiveProduct}
                  className={checkins.length > 0 ? 'col-span-2 !h-11 sm:col-span-1' : 'col-span-2 !h-11'}
                >
                  Adicionar
                </Button>
              </div>
            </Card>
          </section>
        )}

        {/* Itens */}
        <section aria-label="Itens do pedido">
          <h3 className="mb-2.5 text-sm font-semibold text-ink2">
            Itens do pedido{items.length > 0 && <span className="ml-1.5 font-normal text-mute">({items.length})</span>}
          </h3>
          {loading ? (
            <LoadingBlock className="py-8" />
          ) : items.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Nenhum item lançado"
              description={isStaff ? 'Escolha um produto acima para abrir o pedido desta mesa.' : 'Quando o atendente lançar algo, aparece aqui.'}
              className="py-8"
            />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {items.map(item => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-surface px-3.5 py-3">
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="truncate text-[15px] font-medium text-ink">{item.product_name}</p>
                    <p className="mt-0.5 text-xs text-mute">
                      {fmt(item.unit_price)} cada
                      {item.paid_qty > 0 && <span className="text-ok"> · {item.paid_qty} pago{item.paid_qty > 1 ? 's' : ''}</span>}
                      {item.customer_id && <span> · {nameOf(item.customer_id)}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {isStaff ? (
                      <Stepper
                        size="sm"
                        label={`quantidade de ${item.product_name}`}
                        value={item.qty}
                        min={Math.max(1, item.paid_qty)}
                        onChange={v => changeQty(item, v - item.qty)}
                      />
                    ) : (
                      <span className="text-sm text-ink2 tnum">{item.qty}×</span>
                    )}
                    <span className="min-w-[76px] text-right text-sm font-semibold text-ink tnum">
                      {fmt(item.unit_price * item.qty)}
                    </span>
                    {isAdmin && (
                      <IconButton
                        icon={Trash2}
                        label={`Dar baixa em ${item.product_name}`}
                        size="sm"
                        onClick={() => removeItem(item)}
                        className="hover:text-red-bright"
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Conta e pagamentos */}
        {isStaff && orderId && (
          <section aria-label="Conta e pagamentos" className="space-y-4">
            <Button
              variant={billRequested ? 'primary' : 'secondary'}
              size="sm"
              icon={BellRing}
              onClick={toggleBillRequested}
              className={billRequested ? '!bg-info !text-bg hover:!bg-info/90' : ''}
            >
              {billRequested ? 'Conta pedida (toque para desmarcar)' : 'Pedir a conta'}
            </Button>

            <div>
              <h3 className="mb-2.5 text-sm font-semibold text-ink2">Pagamentos</h3>
              {payments.length > 0 && (
                <ul className="mb-3 divide-y divide-line overflow-hidden rounded-xl border border-line">
                  {payments.map(p => (
                    <li key={p.id} className="flex items-center justify-between gap-3 bg-surface px-3.5 py-2.5 text-sm">
                      <span className="min-w-0 truncate text-ink2">
                        <span className="capitalize">{p.method || 'Pagamento'}</span>
                        {nameOf(p.payer_customer_id) ? ` · ${nameOf(p.payer_customer_id)}` : ''}
                      </span>
                      <span className="font-semibold text-ok tnum">{fmt(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}

              {!payMode ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button variant="secondary" icon={Wallet} onClick={() => openPayForm('total')} disabled={totalPendente <= 0}>
                    Pagar total
                  </Button>
                  <Button variant="secondary" icon={ListChecks} onClick={() => openPayForm('itens')} disabled={items.every(it => it.qty <= it.paid_qty)}>
                    Por itens
                  </Button>
                  <Button variant="secondary" icon={Banknote} onClick={() => openPayForm('valor')}>
                    Valor livre
                  </Button>
                </div>
              ) : (
                <Card className="animate-fade-in space-y-4 bg-bg p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-[15px] font-semibold text-ink">{payTitle}</h4>
                    <Button variant="ghost" size="sm" onClick={() => setPayMode(null)}>Cancelar</Button>
                  </div>

                  {payMode === 'total' && (
                    <div className="rounded-xl bg-surface py-4 text-center">
                      <p className="text-xs text-mute">Valor a registrar</p>
                      <p className="mt-1 text-3xl font-semibold text-ink tnum">{fmt(totalPendente)}</p>
                    </div>
                  )}

                  {payMode === 'itens' && (
                    <div className="space-y-2.5">
                      {items.filter(it => it.qty > it.paid_qty).map(it => {
                        const remaining = it.qty - it.paid_qty
                        return (
                          <div key={it.id} className="flex items-center justify-between gap-3 text-sm">
                            <span className="min-w-0 truncate">
                              {it.product_name}{' '}
                              <span className="text-xs text-mute">({remaining} pendente{remaining > 1 ? 's' : ''})</span>
                            </span>
                            <Stepper
                              size="sm"
                              label={`itens pagos de ${it.product_name}`}
                              min={0}
                              max={remaining}
                              value={itemSelections[it.id] ?? 0}
                              onChange={v => setItemSelections(prev => ({ ...prev, [it.id]: Math.min(remaining, Math.max(0, v)) }))}
                            />
                          </div>
                        )
                      })}
                      <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
                        <span className="text-ink2">Total selecionado</span>
                        <span className="text-lg font-semibold text-ink tnum">{fmt(itemsSelectionTotal)}</span>
                      </div>
                    </div>
                  )}

                  {payMode === 'valor' && (
                    <Field label="Valor">
                      <Input
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        type="text"
                        inputMode="decimal"
                        placeholder="Ex.: 50"
                        autoFocus
                      />
                    </Field>
                  )}

                  <div>
                    <p className="mb-1.5 text-xs font-medium text-ink2">Forma de pagamento</p>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { v: 'dinheiro', label: 'Dinheiro', icon: Banknote },
                        { v: 'pix', label: 'Pix', icon: QrCode },
                        { v: 'cartao', label: 'Cartão', icon: CreditCard },
                      ] as const).map(m => {
                        const Icon = m.icon
                        const active = payMethod === m.v
                        return (
                          <button
                            key={m.v}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setPayMethod(m.v)}
                            className={cn(
                              'flex h-14 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium transition-colors',
                              active
                                ? 'border-red/60 bg-red/15 text-ink'
                                : 'border-line bg-surface text-ink2 hover:border-lineStrong hover:text-ink',
                            )}
                          >
                            <Icon className={cn('h-4 w-4', active && 'text-red-bright')} aria-hidden />
                            {m.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <Field label="Quem pagou (opcional, para pontuar)">
                    <Select value={payPayer} onChange={e => setPayPayer(e.target.value)}>
                      <option value="">Sem pontuação</option>
                      {checkins.map(c => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}
                    </Select>
                  </Field>

                  <Button variant="success" size="lg" full loading={submittingPayment} onClick={submitPayment}>
                    {submittingPayment ? 'Registrando…' : 'Confirmar pagamento'}
                  </Button>
                </Card>
              )}
            </div>
          </section>
        )}

        {isAdmin && (
          <div className="border-t border-line pt-4">
            <button
              type="button"
              onClick={deleteTable}
              className="flex items-center gap-1.5 rounded-lg px-1 py-1 text-xs text-mute transition-colors hover:text-red-bright"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Excluir mesa
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

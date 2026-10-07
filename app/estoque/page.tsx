'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Link2, Minus, Package, PackageOpen, Plus, Trash2, TriangleAlert, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/providers'
import PageShell, { FullScreenLoading } from '@/components/PageShell'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  LoadingBlock,
  ProgressBar,
  Select,
  cn,
  useUI,
} from '@/components/ui'

type StockItem = { id: string; name: string; unit: string; qty: number; min_qty: number }
type Product = { id: string; name: string }
type Usage = { id: string; product_id: string; stock_item_id: string; qty_per_unit: number }

export default function EstoquePage() {
  const { user, isStaff, isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const { toast, confirm } = useUI()

  const [items, setItems] = useState<StockItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [usage, setUsage] = useState<Usage[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const [name, setName] = useState('')
  const [unit, setUnit] = useState('un')
  const [qty, setQty] = useState('')
  const [minQty, setMinQty] = useState('')

  const [recipeProduct, setRecipeProduct] = useState('')
  const [recipeStockItem, setRecipeStockItem] = useState('')
  const [recipeQty, setRecipeQty] = useState('1')

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login/')
  }, [authLoading, user, router])
  useEffect(() => {
    if (!authLoading && user && !isStaff) router.replace('/mesas/')
  }, [authLoading, user, isStaff, router])

  const load = async () => {
    setLoadingData(true)
    const [{ data: stockRows }, { data: productRows }, { data: usageRows }] = await Promise.all([
      supabase.from('stock_items').select('*').order('name'),
      supabase.from('products').select('id, name').order('name'),
      supabase.from('product_stock_usage').select('*'),
    ])
    setItems(stockRows || [])
    setProducts(productRows || [])
    setUsage(usageRows || [])
    if (productRows && productRows.length > 0 && !recipeProduct) setRecipeProduct(productRows[0].id)
    setLoadingData(false)
  }
  useEffect(() => { if (isStaff) load() }, [isStaff])

  const addItem = async () => {
    if (!name.trim()) { toast.error('Dê um nome ao insumo.'); return }
    const { error } = await supabase.from('stock_items').insert({
      name: name.trim(),
      unit: unit.trim() || 'un',
      qty: parseFloat(qty) || 0,
      min_qty: parseFloat(minQty) || 0,
    })
    if (error) { toast.error('Não foi possível salvar: ' + error.message); return }
    toast.success(`${name.trim()} adicionado ao estoque.`)
    setName(''); setUnit('un'); setQty(''); setMinQty('')
    await load()
  }

  const updateQty = async (item: StockItem, delta: number) => {
    const newQty = Math.max(0, item.qty + delta)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, qty: newQty } : i))
    const { error } = await supabase.from('stock_items').update({ qty: newQty }).eq('id', item.id)
    if (error) {
      toast.error('Não foi possível atualizar a quantidade: ' + error.message)
      await load()
    }
  }

  const removeItem = async (item: StockItem) => {
    const ok = await confirm({
      title: `Remover "${item.name}" do estoque?`,
      message: 'A receita ligada a produtos também é apagada.',
      confirmLabel: 'Remover',
      tone: 'danger',
    })
    if (!ok) return
    const { error } = await supabase.from('stock_items').delete().eq('id', item.id)
    if (error) { toast.error('Não foi possível remover: ' + error.message); return }
    toast.success('Item removido.')
    await load()
  }

  const addUsage = async () => {
    if (!recipeProduct || !recipeStockItem) { toast.error('Escolha o produto e o insumo.'); return }
    const q = parseFloat(recipeQty)
    if (isNaN(q) || q <= 0) { toast.error('Informe uma quantidade maior que zero.'); return }
    const { error } = await supabase.from('product_stock_usage').upsert(
      { product_id: recipeProduct, stock_item_id: recipeStockItem, qty_per_unit: q },
      { onConflict: 'product_id,stock_item_id' }
    )
    if (error) { toast.error('Não foi possível vincular: ' + error.message); return }
    toast.success('Insumo vinculado ao produto.')
    setRecipeQty('1')
    await load()
  }

  const removeUsage = async (id: string) => {
    const { error } = await supabase.from('product_stock_usage').delete().eq('id', id)
    if (error) { toast.error('Não foi possível desvincular: ' + error.message); return }
    await load()
  }

  if (authLoading) return <FullScreenLoading />
  if (!user || !isStaff) return null

  const stockName = (id: string) => items.find(i => i.id === id)?.name || '—'
  const stockUnit = (id: string) => items.find(i => i.id === id)?.unit || ''
  const recipeForProduct = usage.filter(u => u.product_id === recipeProduct)
  const lowCount = items.filter(i => i.qty <= i.min_qty).length
  const fmtQty = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')

  return (
    <PageShell
      title="Estoque"
      subtitle={
        loadingData
          ? undefined
          : lowCount > 0
          ? `${lowCount} ${lowCount === 1 ? 'item precisa' : 'itens precisam'} de reposição`
          : `${items.length} ${items.length === 1 ? 'item' : 'itens'}, nenhum abaixo do mínimo`
      }
    >
      {isAdmin && (
        <Card className="mb-6 p-4 sm:p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Novo insumo</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
            <Field label="Nome" className="sm:col-span-2 lg:col-span-1">
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Vodka" />
            </Field>
            <Field label="Unidade">
              <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="ml, un, kg" />
            </Field>
            <Field label="Quantidade atual">
              <Input value={qty} onChange={e => setQty(e.target.value)} type="number" step="0.01" inputMode="decimal" placeholder="0" />
            </Field>
            <Field label="Mínimo">
              <Input value={minQty} onChange={e => setMinQty(e.target.value)} type="number" step="0.01" inputMode="decimal" placeholder="0" />
            </Field>
            <Button variant="primary" size="lg" icon={Plus} onClick={addItem} className="sm:col-span-2 lg:col-span-1 lg:h-11">
              Adicionar
            </Button>
          </div>
        </Card>
      )}

      {loadingData ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={PackageOpen}
            title="Nenhum item no estoque"
            description={isAdmin ? 'Cadastre os insumos acima. Depois, ligue cada um aos produtos para a baixa ser automática.' : 'Peça a um admin para cadastrar os insumos.'}
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(item => {
            const low = item.qty <= item.min_qty
            const level = item.min_qty > 0 ? (item.qty / (item.min_qty * 2)) * 100 : 100
            return (
              <Card key={item.id} className={cn('flex flex-col p-4', low && 'border-red/40')}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-medium text-ink">{item.name}</h3>
                    <p className="mt-0.5 text-xs text-mute">
                      Mínimo: {fmtQty(item.min_qty)} {item.unit}
                    </p>
                  </div>
                  {low && <Badge tone="red" icon={TriangleAlert}>Repor</Badge>}
                  {isAdmin && (
                    <IconButton
                      icon={Trash2}
                      label={`Remover ${item.name}`}
                      size="sm"
                      onClick={() => removeItem(item)}
                      className="-mr-1 -mt-1 hover:text-red-bright"
                    />
                  )}
                </div>

                <div className="mb-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    aria-label={`Diminuir ${item.name}`}
                    onClick={() => updateQty(item, -1)}
                    disabled={item.qty <= 0}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-raised text-ink2 transition-colors hover:border-lineStrong hover:text-ink active:scale-95 disabled:opacity-40"
                  >
                    <Minus className="h-4 w-4" aria-hidden />
                  </button>
                  <p className="min-w-0 truncate text-center">
                    <span className={cn('text-2xl font-semibold tnum', low ? 'text-red-bright' : 'text-ink')}>
                      {fmtQty(item.qty)}
                    </span>
                    <span className="ml-1.5 text-sm text-mute">{item.unit}</span>
                  </p>
                  <button
                    type="button"
                    aria-label={`Aumentar ${item.name}`}
                    onClick={() => updateQty(item, 1)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-raised text-ink2 transition-colors hover:border-lineStrong hover:text-ink active:scale-95"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                  </button>
                </div>

                {item.min_qty > 0 && <ProgressBar value={level} tone={low ? 'red' : 'green'} />}
              </Card>
            )
          })}
        </div>
      )}

      {isAdmin && products.length > 0 && (
        <section className="mt-10" aria-label="Receita dos produtos">
          <h2 className="text-lg font-semibold text-ink">Receita dos produtos</h2>
          <p className="mb-4 mt-1 max-w-xl text-sm text-ink2">
            Defina quanto de cada insumo um produto consome. Assim, o estoque baixa sozinho quando o item é lançado na mesa.
          </p>

          <Card className="p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_160px_auto] lg:items-end">
              <Field label="Produto">
                <Select value={recipeProduct} onChange={e => setRecipeProduct(e.target.value)}>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Field>
              <Field label="Insumo">
                <Select value={recipeStockItem} onChange={e => setRecipeStockItem(e.target.value)}>
                  <option value="">Escolha o insumo…</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </Select>
              </Field>
              <Field label="Qtd. por unidade vendida">
                <Input value={recipeQty} onChange={e => setRecipeQty(e.target.value)} type="number" step="0.01" inputMode="decimal" />
              </Field>
              <Button variant="primary" size="lg" icon={Link2} onClick={addUsage} className="sm:col-span-2 lg:col-span-1 lg:h-11">
                Vincular
              </Button>
            </div>

            <div className="mt-5 border-t border-line pt-4">
              {recipeForProduct.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-mute">
                  <Package className="h-4 w-4" aria-hidden /> Esse produto ainda não consome nenhum insumo.
                </p>
              ) : (
                <ul className="space-y-2">
                  {recipeForProduct.map(u => (
                    <li key={u.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm">
                      <span className="min-w-0 truncate">
                        <span className="text-ink">{stockName(u.stock_item_id)}</span>
                        <span className="text-mute"> · {fmtQty(u.qty_per_unit)} {stockUnit(u.stock_item_id)} por unidade</span>
                      </span>
                      <IconButton icon={X} label="Desvincular insumo" size="sm" onClick={() => removeUsage(u.id)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </section>
      )}
    </PageShell>
  )
}

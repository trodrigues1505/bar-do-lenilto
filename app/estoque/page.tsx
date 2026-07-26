'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/providers'
import Topbar from '@/components/Topbar'

type StockItem = { id: string; name: string; unit: string; qty: number; min_qty: number }
type Product = { id: string; name: string }
type Usage = { id: string; product_id: string; stock_item_id: string; qty_per_unit: number }

export default function EstoquePage() {
  const { user, isStaff, isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

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
    if (!name.trim()) return
    await supabase.from('stock_items').insert({
      name: name.trim(),
      unit: unit.trim() || 'un',
      qty: parseFloat(qty) || 0,
      min_qty: parseFloat(minQty) || 0,
    })
    setName(''); setUnit('un'); setQty(''); setMinQty('')
    await load()
  }

  const updateQty = async (item: StockItem, delta: number) => {
    const newQty = Math.max(0, item.qty + delta)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, qty: newQty } : i))
    await supabase.from('stock_items').update({ qty: newQty }).eq('id', item.id)
  }

  const removeItem = async (id: string) => {
    if (!confirm('Remover esse item do estoque? A receita ligada a produtos também é apagada.')) return
    await supabase.from('stock_items').delete().eq('id', id)
    await load()
  }

  const addUsage = async () => {
    if (!recipeProduct || !recipeStockItem) return
    const q = parseFloat(recipeQty)
    if (isNaN(q) || q <= 0) return
    await supabase.from('product_stock_usage').upsert(
      { product_id: recipeProduct, stock_item_id: recipeStockItem, qty_per_unit: q },
      { onConflict: 'product_id,stock_item_id' }
    )
    setRecipeQty('1')
    await load()
  }

  const removeUsage = async (id: string) => {
    await supabase.from('product_stock_usage').delete().eq('id', id)
    await load()
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted text-sm">Carregando...</div>
  }
  if (!user || !isStaff) return null

  const productName = (id: string) => products.find(p => p.id === id)?.name || '—'
  const stockName = (id: string) => items.find(i => i.id === id)?.name || '—'
  const recipeForProduct = usage.filter(u => u.product_id === recipeProduct)

  return (
    <div className="max-w-6xl mx-auto px-5 pt-5 pb-20">
      <Topbar />
      <h2 className="text-xl mb-4">Estoque ({items.length})</h2>

      {isAdmin && (
        <div className="grid gap-2.5 mb-6" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr auto' }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do insumo (ex: Vodka)"
            className="bg-bgElevated border border-line rounded-lg px-3 py-2.5" />
          <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="Unidade (ml, un, kg)"
            className="bg-bgElevated border border-line rounded-lg px-3 py-2.5" />
          <input value={qty} onChange={e => setQty(e.target.value)} type="number" step="0.01" placeholder="Qtd atual"
            className="bg-bgElevated border border-line rounded-lg px-3 py-2.5" />
          <input value={minQty} onChange={e => setMinQty(e.target.value)} type="number" step="0.01" placeholder="Mínimo"
            className="bg-bgElevated border border-line rounded-lg px-3 py-2.5" />
          <button onClick={addItem} className="bg-red hover:bg-red-bright rounded-lg px-4 font-display tracking-wide">
            Adicionar
          </button>
        </div>
      )}

      {loadingData ? (
        <div className="text-center text-muted py-8 text-sm">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-center text-muted py-8 text-sm">Nenhum item de estoque cadastrado ainda.</div>
      ) : (
        <table className="w-full border-collapse mb-10">
          <thead>
            <tr>
              <th className="text-left text-[11px] tracking-wide uppercase text-muted px-2.5 py-2 border-b border-line">Item</th>
              <th className="text-left text-[11px] tracking-wide uppercase text-muted px-2.5 py-2 border-b border-line">Qtd</th>
              <th className="text-left text-[11px] tracking-wide uppercase text-muted px-2.5 py-2 border-b border-line">Mínimo</th>
              <th className="border-b border-line"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const low = item.qty <= item.min_qty
              return (
                <tr key={item.id}>
                  <td className="px-2.5 py-2.5 border-b border-line">
                    {item.name}
                    {low && <span className="ml-2 bg-red text-paper text-[10px] px-2 py-0.5 rounded-full uppercase font-bold">Repor!</span>}
                  </td>
                  <td className="px-2.5 py-2.5 border-b border-line">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(item, -1)} className="w-6.5 h-6.5 rounded bg-bgCard border border-line hover:border-red">−</button>
                      <span className={low ? 'text-red-bright font-display' : ''}>{item.qty} {item.unit}</span>
                      <button onClick={() => updateQty(item, 1)} className="w-6.5 h-6.5 rounded bg-bgCard border border-line hover:border-red">+</button>
                    </div>
                  </td>
                  <td className="px-2.5 py-2.5 border-b border-line text-paperDim">{item.min_qty} {item.unit}</td>
                  <td className="px-2.5 py-2.5 border-b border-line">
                    {isAdmin && (
                      <button onClick={() => removeItem(item.id)} className="text-muted hover:text-red-bright text-sm bg-transparent border-none cursor-pointer">
                        Remover
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {isAdmin && products.length > 0 && (
        <div>
          <h3 className="text-lg mb-1">Receita dos produtos</h3>
          <p className="text-muted text-sm mb-4">
            Diz quanto de cada insumo um produto consome — assim a baixa no estoque acontece sozinha quando o item é vendido.
          </p>

          <div className="flex flex-wrap gap-2.5 mb-4">
            <select value={recipeProduct} onChange={e => setRecipeProduct(e.target.value)}
              className="bg-bgElevated border border-line rounded-lg px-3 py-2.5">
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={recipeStockItem} onChange={e => setRecipeStockItem(e.target.value)}
              className="bg-bgElevated border border-line rounded-lg px-3 py-2.5">
              <option value="">Escolha o insumo...</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <input value={recipeQty} onChange={e => setRecipeQty(e.target.value)} type="number" step="0.01"
              placeholder="Qtd por unidade vendida" className="w-40 bg-bgElevated border border-line rounded-lg px-3 py-2.5" />
            <button onClick={addUsage} className="bg-red hover:bg-red-bright rounded-lg px-4 font-display tracking-wide">
              Vincular
            </button>
          </div>

          {recipeForProduct.length > 0 && (
            <ul className="text-sm space-y-1.5">
              {recipeForProduct.map(u => (
                <li key={u.id} className="flex items-center justify-between bg-bgCard border border-line rounded-lg px-3 py-2">
                  <span>{stockName(u.stock_item_id)} — {u.qty_per_unit} por unidade</span>
                  <button onClick={() => removeUsage(u.id)} className="text-muted hover:text-red-bright text-xs bg-transparent border-none cursor-pointer">
                    remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

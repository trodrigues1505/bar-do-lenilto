'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/providers'
import Topbar from '@/components/Topbar'

type Product = { id: string; name: string; price: number; category: string }
const fmt = (n: number) => 'R$ ' + n.toFixed(2).replace('.', ',')

export default function ProdutosPage() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editCategory, setEditCategory] = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login/')
  }, [authLoading, user, router])

  const load = async () => {
    const { data } = await supabase.from('products').select('*').order('name')
    setProducts(data || [])
  }
  useEffect(() => { load() }, [])

  const addProduct = async () => {
    const p = parseFloat(price)
    if (!name.trim() || isNaN(p)) return
    await supabase.from('products').insert({ name: name.trim(), price: p, category: category.trim() || 'Geral' })
    setName(''); setPrice(''); setCategory('')
    await load()
  }

  const removeProduct = async (id: string) => {
    if (!confirm('Remover esse produto do catálogo?')) return
    await supabase.from('products').delete().eq('id', id)
    await load()
  }

  const startEdit = (p: Product) => {
    setEditingId(p.id)
    setEditName(p.name)
    setEditPrice(String(p.price))
    setEditCategory(p.category)
  }

  const cancelEdit = () => setEditingId(null)

  const saveEdit = async (id: string) => {
    const p = parseFloat(editPrice)
    if (!editName.trim() || isNaN(p)) return
    await supabase.from('products').update({
      name: editName.trim(),
      price: p,
      category: editCategory.trim() || 'Geral',
    }).eq('id', id)
    setEditingId(null)
    await load()
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
      <h2 className="text-xl mb-4">Produtos ({products.length})</h2>

      {isAdmin && (
        <div className="grid gap-2.5 mb-5" style={{ gridTemplateColumns: '2fr 1fr 1fr auto' }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do produto"
            className="bg-bgElevated border border-line rounded-lg px-3 py-2.5" />
          <input value={price} onChange={e => setPrice(e.target.value)} type="number" step="0.01" placeholder="Preço"
            className="bg-bgElevated border border-line rounded-lg px-3 py-2.5" />
          <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Categoria"
            className="bg-bgElevated border border-line rounded-lg px-3 py-2.5" />
          <button onClick={addProduct} className="bg-red hover:bg-red-bright rounded-lg px-4 font-display tracking-wide">
            Adicionar
          </button>
        </div>
      )}

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left text-[11px] tracking-wide uppercase text-muted px-2.5 py-2 border-b border-line">Nome</th>
            <th className="text-left text-[11px] tracking-wide uppercase text-muted px-2.5 py-2 border-b border-line">Categoria</th>
            <th className="text-left text-[11px] tracking-wide uppercase text-muted px-2.5 py-2 border-b border-line">Preço</th>
            <th className="border-b border-line"></th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            editingId === p.id ? (
              <tr key={p.id}>
                <td className="px-2.5 py-2.5 border-b border-line">
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    className="w-full bg-bg border border-line rounded px-2 py-1.5" />
                </td>
                <td className="px-2.5 py-2.5 border-b border-line">
                  <input value={editCategory} onChange={e => setEditCategory(e.target.value)}
                    className="w-full bg-bg border border-line rounded px-2 py-1.5" />
                </td>
                <td className="px-2.5 py-2.5 border-b border-line">
                  <input value={editPrice} onChange={e => setEditPrice(e.target.value)} type="number" step="0.01"
                    className="w-24 bg-bg border border-line rounded px-2 py-1.5" />
                </td>
                <td className="px-2.5 py-2.5 border-b border-line whitespace-nowrap">
                  <button onClick={() => saveEdit(p.id)} className="text-green-400 text-sm bg-transparent border-none cursor-pointer mr-3">Salvar</button>
                  <button onClick={cancelEdit} className="text-muted text-sm bg-transparent border-none cursor-pointer">Cancelar</button>
                </td>
              </tr>
            ) : (
              <tr key={p.id}>
                <td className="px-2.5 py-2.5 border-b border-line">{p.name}</td>
                <td className="px-2.5 py-2.5 border-b border-line">
                  <span className="bg-bgCard border border-line px-2.5 py-0.5 rounded-full text-xs text-paperDim">{p.category}</span>
                </td>
                <td className="px-2.5 py-2.5 border-b border-line">{fmt(p.price)}</td>
                <td className="px-2.5 py-2.5 border-b border-line whitespace-nowrap">
                  {isAdmin && (
                    <>
                      <button onClick={() => startEdit(p)} className="text-paperDim hover:text-paper text-sm bg-transparent border-none cursor-pointer mr-3">
                        Editar
                      </button>
                      <button onClick={() => removeProduct(p.id)} className="text-muted hover:text-red-bright text-sm bg-transparent border-none cursor-pointer">
                        Remover
                      </button>
                    </>
                  )}
                </td>
              </tr>
            )
          ))}
        </tbody>
      </table>
    </div>
  )
}

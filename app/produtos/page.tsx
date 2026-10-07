'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil, Plus, Search, Trash2, Wine, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/providers'
import PageShell, { FullScreenLoading } from '@/components/PageShell'
import {
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  LoadingBlock,
  fmtMoney as fmt,
  useUI,
} from '@/components/ui'

type Product = { id: string; name: string; price: number; category: string }

export default function ProdutosPage() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const { toast, confirm } = useUI()

  const [products, setProducts] = useState<Product[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [search, setSearch] = useState('')
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
    setLoadingData(false)
  }
  useEffect(() => { load() }, [])

  const addProduct = async () => {
    const p = parseFloat(price)
    if (!name.trim() || isNaN(p)) { toast.error('Informe o nome e o preço do produto.'); return }
    const { error } = await supabase.from('products').insert({ name: name.trim(), price: p, category: category.trim() || 'Geral' })
    if (error) { toast.error('Não foi possível salvar: ' + error.message); return }
    toast.success(`${name.trim()} adicionado ao catálogo.`)
    setName(''); setPrice(''); setCategory('')
    await load()
  }

  const removeProduct = async (p: Product) => {
    const ok = await confirm({
      title: `Remover "${p.name}"?`,
      message: 'Ele sai do catálogo. As receitas de estoque ligadas a ele são apagadas e troféus que contam esse produto ficam sem produto. Se já foi lançado em algum pedido, o banco não deixa remover.',
      confirmLabel: 'Remover',
      tone: 'danger',
    })
    if (!ok) return
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (error) {
      // 23503 = violação de chave estrangeira (produto já usado em pedidos)
      toast.error(
        error.code === '23503'
          ? 'Esse produto já foi lançado em pedidos e não pode ser removido do catálogo.'
          : 'Não foi possível remover: ' + error.message,
      )
      return
    }
    toast.success('Produto removido.')
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
    if (!editName.trim() || isNaN(p)) { toast.error('Informe o nome e o preço do produto.'); return }
    const { error } = await supabase.from('products').update({
      name: editName.trim(),
      price: p,
      category: editCategory.trim() || 'Geral',
    }).eq('id', id)
    if (error) { toast.error('Não foi possível salvar: ' + error.message); return }
    setEditingId(null)
    toast.success('Produto atualizado.')
    await load()
  }

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? products.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
      : products
    const map = new Map<string, Product[]>()
    filtered.forEach(p => {
      const key = p.category || 'Geral'
      map.set(key, [...(map.get(key) || []), p])
    })
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
  }, [products, search])

  if (authLoading) return <FullScreenLoading />
  if (!user) return null

  return (
    <PageShell
      title="Produtos"
      subtitle={`${products.length} ${products.length === 1 ? 'item' : 'itens'} no catálogo`}
    >
      {isAdmin && (
        <Card className="mb-6 p-4 sm:p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Novo produto</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto] lg:items-end">
            <Field label="Nome">
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Caipirinha de limão" />
            </Field>
            <Field label="Preço (R$)">
              <Input value={price} onChange={e => setPrice(e.target.value)} type="number" step="0.01" inputMode="decimal" placeholder="0,00" />
            </Field>
            <Field label="Categoria">
              <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Ex.: Drinks" />
            </Field>
            <Button variant="primary" size="lg" icon={Plus} onClick={addProduct} className="sm:col-span-2 lg:col-span-1 lg:h-11">
              Adicionar
            </Button>
          </div>
        </Card>
      )}

      {products.length > 6 && (
        <div className="mb-5 max-w-sm">
          <Input icon={Search} value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto ou categoria" aria-label="Buscar produto" />
        </div>
      )}

      {loadingData ? (
        <LoadingBlock />
      ) : products.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wine}
            title="Nenhum produto cadastrado"
            description={isAdmin ? 'Cadastre o primeiro produto no formulário acima para poder lançá-lo nas mesas.' : 'O catálogo ainda está vazio.'}
          />
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState icon={Search} title="Nada encontrado" description={`Nenhum produto corresponde a "${search}".`} />
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map(([cat, list]) => (
            <section key={cat} aria-label={cat}>
              <div className="mb-2.5 flex items-baseline gap-2 px-1">
                <h2 className="text-sm font-semibold text-ink">{cat}</h2>
                <span className="text-xs text-mute">{list.length}</span>
              </div>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {list.map(p =>
                  editingId === p.id ? (
                    <li key={p.id} className="grid gap-3 bg-raised p-3.5 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-center">
                      <Input value={editName} onChange={e => setEditName(e.target.value)} aria-label="Nome" />
                      <Input value={editCategory} onChange={e => setEditCategory(e.target.value)} aria-label="Categoria" />
                      <Input value={editPrice} onChange={e => setEditPrice(e.target.value)} type="number" step="0.01" inputMode="decimal" aria-label="Preço" />
                      <div className="flex gap-2">
                        <Button variant="primary" size="sm" icon={Check} onClick={() => saveEdit(p.id)}>Salvar</Button>
                        <Button variant="ghost" size="sm" icon={X} onClick={cancelEdit}>Cancelar</Button>
                      </div>
                    </li>
                  ) : (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <p className="min-w-0 flex-1 truncate text-[15px] text-ink">{p.name}</p>
                      <p className="shrink-0 text-[15px] font-semibold text-ink tnum">{fmt(p.price)}</p>
                      {isAdmin && (
                        <div className="flex shrink-0 gap-1">
                          <IconButton icon={Pencil} label={`Editar ${p.name}`} size="sm" onClick={() => startEdit(p)} />
                          <IconButton icon={Trash2} label={`Remover ${p.name}`} size="sm" onClick={() => removeProduct(p)} className="hover:text-red-bright" />
                        </div>
                      )}
                    </li>
                  ),
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
    </PageShell>
  )
}

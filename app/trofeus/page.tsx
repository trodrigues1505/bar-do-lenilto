'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/providers'
import Topbar from '@/components/Topbar'

type Product = { id: string; name: string }
type Level = { id: string; trophy_id: string; threshold: number; title: string; sort_order: number }
type Trophy = { id: string; name: string; description: string | null; icon: string; product_id: string | null }
type MyTrophy = {
  trophy_id: string; trophy_name: string; description: string | null; icon: string
  product_name: string | null; count: number
  current_level_title: string | null; current_threshold: number | null
  next_level_title: string | null; next_threshold: number | null
}

export default function TrofeusPage() {
  const { user, isAdmin, isStaff, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [trophies, setTrophies] = useState<Trophy[]>([])
  const [levels, setLevels] = useState<Level[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [myTrophies, setMyTrophies] = useState<MyTrophy[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('🏆')
  const [productId, setProductId] = useState('')

  const [newLevelTrophy, setNewLevelTrophy] = useState<string | null>(null)
  const [levelThreshold, setLevelThreshold] = useState('')
  const [levelTitle, setLevelTitle] = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login/')
  }, [authLoading, user, router])
  useEffect(() => {
    if (!authLoading && user && isStaff && !isAdmin) router.replace('/mesas/')
  }, [authLoading, user, isStaff, isAdmin, router])

  const load = async () => {
    setLoadingData(true)
    if (isAdmin) {
      const [{ data: t }, { data: l }, { data: p }] = await Promise.all([
        supabase.from('trophies').select('*').order('created_at'),
        supabase.from('trophy_levels').select('*').order('threshold'),
        supabase.from('products').select('id, name').order('name'),
      ])
      setTrophies(t || [])
      setLevels(l || [])
      setProducts(p || [])
    } else {
      const { data } = await supabase.rpc('get_my_trophies')
      setMyTrophies(data || [])
    }
    setLoadingData(false)
  }
  useEffect(() => { if (user) load() }, [user, isAdmin])

  const createTrophy = async () => {
    if (!name.trim() || !productId) return
    await supabase.from('trophies').insert({
      name: name.trim(), description: description.trim() || null, icon: icon.trim() || '🏆',
      product_id: productId, created_by: user?.id,
    })
    setName(''); setDescription(''); setIcon('🏆'); setProductId('')
    await load()
  }

  const removeTrophy = async (id: string) => {
    if (!confirm('Excluir esse troféu e todos os níveis dele?')) return
    await supabase.from('trophies').delete().eq('id', id)
    await load()
  }

  const addLevel = async (trophyId: string) => {
    const threshold = parseInt(levelThreshold)
    if (isNaN(threshold) || !levelTitle.trim()) return
    await supabase.from('trophy_levels').insert({
      trophy_id: trophyId, threshold, title: levelTitle.trim(), sort_order: threshold,
    })
    setLevelThreshold(''); setLevelTitle(''); setNewLevelTrophy(null)
    await load()
  }

  const removeLevel = async (id: string) => {
    await supabase.from('trophy_levels').delete().eq('id', id)
    await load()
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted text-sm">Carregando...</div>
  }
  if (!user || (isStaff && !isAdmin)) return null

  // -------- Visão do cliente --------
  if (!isAdmin) {
    return (
      <div className="max-w-6xl mx-auto px-5 pt-5 pb-20">
        <Topbar />
        <h2 className="text-xl mb-1">Meus Troféus 🏆</h2>
        <p className="text-muted text-sm mb-5">Desbloqueados por consumo — quanto mais você pede, mais sobe de nível.</p>

        {loadingData ? (
          <div className="text-center text-muted py-8 text-sm">Carregando...</div>
        ) : myTrophies.length === 0 ? (
          <div className="text-center text-muted py-10 text-sm">Nenhum troféu cadastrado ainda.</div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {myTrophies.map(t => {
              const progress = t.next_threshold
                ? Math.min(100, (t.count / t.next_threshold) * 100)
                : 100
              return (
                <div key={t.trophy_id} className="bg-bgCard border border-line rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">{t.icon}</span>
                    <div>
                      <div className="font-display text-lg leading-tight">{t.trophy_name}</div>
                      {t.product_name && <div className="text-muted text-xs">{t.product_name}</div>}
                    </div>
                  </div>
                  {t.description && <p className="text-paperDim text-xs mb-3">{t.description}</p>}

                  {t.current_level_title ? (
                    <div className="bg-red/15 border border-red-dark rounded-lg px-3 py-2 mb-3 text-center">
                      <div className="text-[10px] uppercase tracking-wide text-muted">Nível atual</div>
                      <div className="font-display text-red-bright">{t.current_level_title}</div>
                    </div>
                  ) : (
                    <div className="text-muted text-xs mb-3">Ainda sem nível — comece a pedir!</div>
                  )}

                  <div className="text-xs text-muted mb-1 flex justify-between">
                    <span>{t.count}x pedido</span>
                    {t.next_threshold && <span>próximo: {t.next_level_title} ({t.next_threshold}x)</span>}
                  </div>
                  {t.next_threshold && (
                    <div className="w-full h-2 bg-bgElevated rounded-full overflow-hidden">
                      <div className="h-full bg-red" style={{ width: `${progress}%` }} />
                    </div>
                  )}
                  {!t.next_threshold && t.current_level_title && (
                    <div className="text-green-400 text-xs font-display uppercase tracking-wide text-center mt-1">Nível máximo! 🎉</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // -------- Visão admin --------
  return (
    <div className="max-w-6xl mx-auto px-5 pt-5 pb-20">
      <Topbar />
      <h2 className="text-xl mb-4">Troféus ({trophies.length})</h2>

      <div className="grid gap-2.5 mb-6" style={{ gridTemplateColumns: '2fr 2fr 80px 2fr auto' }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome (ex: Gogó de Ouro)"
          className="bg-bgElevated border border-line rounded-lg px-3 py-2.5" />
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição (opcional)"
          className="bg-bgElevated border border-line rounded-lg px-3 py-2.5" />
        <input value={icon} onChange={e => setIcon(e.target.value)} placeholder="🏆"
          className="bg-bgElevated border border-line rounded-lg px-3 py-2.5 text-center" />
        <select value={productId} onChange={e => setProductId(e.target.value)}
          className="bg-bgElevated border border-line rounded-lg px-3 py-2.5">
          <option value="">Produto contado...</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={createTrophy} className="bg-red hover:bg-red-bright rounded-lg px-4 font-display tracking-wide">
          Criar
        </button>
      </div>

      {loadingData ? (
        <div className="text-center text-muted py-8 text-sm">Carregando...</div>
      ) : trophies.length === 0 ? (
        <div className="text-center text-muted py-8 text-sm">Nenhum troféu criado ainda.</div>
      ) : (
        <div className="space-y-4">
          {trophies.map(t => {
            const trophyLevels = levels.filter(l => l.trophy_id === t.id)
            const productName = products.find(p => p.id === t.product_id)?.name
            return (
              <div key={t.id} className="bg-bgCard border border-line rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{t.icon}</span>
                    <div>
                      <div className="font-display">{t.name}</div>
                      <div className="text-muted text-xs">{productName || 'produto removido'}</div>
                    </div>
                  </div>
                  <button onClick={() => removeTrophy(t.id)} className="text-muted hover:text-red-bright text-xs bg-transparent border-none cursor-pointer">
                    Excluir troféu
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 mb-2">
                  {trophyLevels.map(l => (
                    <span key={l.id} className="flex items-center gap-1.5 bg-bgElevated border border-line rounded-full pl-3 pr-1.5 py-1 text-xs">
                      {l.threshold}x — {l.title}
                      <button onClick={() => removeLevel(l.id)} className="text-muted hover:text-red-bright bg-transparent border-none cursor-pointer">✕</button>
                    </span>
                  ))}
                  <button onClick={() => setNewLevelTrophy(newLevelTrophy === t.id ? null : t.id)}
                    className="text-xs border border-dashed border-line rounded-full px-3 py-1 text-muted hover:border-red hover:text-paper">
                    + nível
                  </button>
                </div>

                {newLevelTrophy === t.id && (
                  <div className="flex gap-2 items-center bg-bgElevated border border-line rounded-lg p-2.5">
                    <input value={levelThreshold} onChange={e => setLevelThreshold(e.target.value)} type="number"
                      placeholder="Quantas vezes (ex: 10)" className="w-40 bg-bg border border-line rounded px-2 py-1.5 text-sm" />
                    <input value={levelTitle} onChange={e => setLevelTitle(e.target.value)}
                      placeholder="Título (ex: Gogó de Prata)" className="flex-1 bg-bg border border-line rounded px-2 py-1.5 text-sm" />
                    <button onClick={() => addLevel(t.id)} className="bg-red hover:bg-red-bright text-paper text-xs font-display px-3 py-1.5 rounded">
                      Adicionar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/providers'
import Topbar from '@/components/Topbar'

type Product = { id: string; name: string }
type Level = { id: string; trophy_id: string; threshold: number; title: string }
type Trophy = { id: string; name: string; description: string | null; icon: string; product_id: string | null }
type MyTrophy = {
  trophy_id: string; trophy_name: string; description: string | null; icon: string
  product_name: string | null; count: number
  current_level_title: string | null; current_threshold: number | null
  next_level_title: string | null; next_threshold: number | null
}
type DraftLevel = { threshold: string; title: string }

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
  const [draftLevels, setDraftLevels] = useState<DraftLevel[]>([{ threshold: '', title: '' }])
  const [creating, setCreating] = useState(false)

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

  const updateDraftLevel = (i: number, field: 'threshold' | 'title', value: string) => {
    setDraftLevels(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }
  const addDraftLevelRow = () => setDraftLevels(prev => [...prev, { threshold: '', title: '' }])
  const removeDraftLevelRow = (i: number) => setDraftLevels(prev => prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i))

  const createTrophy = async () => {
    if (!name.trim()) { alert('Dá um nome pro troféu primeiro.'); return }
    if (!productId) { alert('Escolhe qual produto esse troféu vai contar.'); return }

    const validLevels = draftLevels
      .map(l => ({ threshold: parseInt(l.threshold), title: l.title.trim() }))
      .filter(l => !isNaN(l.threshold) && l.threshold > 0 && l.title.length > 0)

    if (validLevels.length === 0) {
      alert('Preenche pelo menos um nível: quantas vezes (ex: 10) e o título (ex: Cantor Iniciante).')
      return
    }

    setCreating(true)
    const { data: trophy, error } = await supabase.from('trophies').insert({
      name: name.trim(), description: description.trim() || null, icon: icon.trim() || '🏆',
      product_id: productId, created_by: user?.id,
    }).select().single()

    if (error || !trophy) {
      alert('Erro ao criar troféu: ' + (error?.message || 'motivo desconhecido') + '\n\nConfira se as migrações foram rodadas no Supabase.')
      setCreating(false)
      return
    }

    const { error: levelError } = await supabase.from('trophy_levels').insert(
      validLevels.map(l => ({ trophy_id: trophy.id, threshold: l.threshold, title: l.title }))
    )
    if (levelError) {
      alert('O troféu foi criado, mas deu erro ao criar os níveis: ' + levelError.message)
    }

    setName(''); setDescription(''); setIcon('🏆'); setProductId('')
    setDraftLevels([{ threshold: '', title: '' }])
    setCreating(false)
    await load()
  }

  const removeTrophy = async (id: string) => {
    if (!confirm('Excluir esse troféu e todos os níveis dele?')) return
    const { error } = await supabase.from('trophies').delete().eq('id', id)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    await load()
  }

  const addLevel = async (trophyId: string) => {
    const threshold = parseInt(levelThreshold)
    if (isNaN(threshold) || threshold <= 0) { alert('Preenche quantas vezes é preciso pra esse nível.'); return }
    if (!levelTitle.trim()) { alert('Dá um título pra esse nível.'); return }
    const { error } = await supabase.from('trophy_levels').insert({ trophy_id: trophyId, threshold, title: levelTitle.trim() })
    if (error) { alert('Erro ao adicionar nível: ' + error.message); return }
    setLevelThreshold(''); setLevelTitle(''); setNewLevelTrophy(null)
    await load()
  }

  const removeLevel = async (id: string) => {
    const { error } = await supabase.from('trophy_levels').delete().eq('id', id)
    if (error) { alert('Erro ao remover nível: ' + error.message); return }
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
            {myTrophies.map((t, i) => {
              const progress = t.next_threshold ? Math.min(100, (t.count / t.next_threshold) * 100) : 100
              return (
                <div key={t.trophy_id} className="card card-hover fade-in-up p-5" style={{ animationDelay: `${i * 60}ms` }}>
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
                      <div className="h-full bg-red transition-all duration-500" style={{ width: `${progress}%` }} />
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

      <div className="card p-4 mb-6">
        <div className="text-[11px] tracking-wide uppercase text-muted mb-2.5">Novo troféu</div>
        <div className="grid gap-2.5 mb-4" style={{ gridTemplateColumns: '2fr 2fr 70px 2fr' }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome (ex: Gogó de Ouro)" className="field-input" />
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição (opcional)" className="field-input" />
          <input value={icon} onChange={e => setIcon(e.target.value)} placeholder="🏆" className="field-input text-center" />
          <select value={productId} onChange={e => setProductId(e.target.value)} className="field-input">
            <option value="">Produto contado...</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="text-[11px] tracking-wide uppercase text-muted mb-2">Níveis (quantas vezes → título)</div>
        <div className="space-y-2 mb-2.5">
          {draftLevels.map((l, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input value={l.threshold} onChange={e => updateDraftLevel(i, 'threshold', e.target.value)} type="number"
                placeholder="Quantas vezes (ex: 10)" className="field-input w-44" />
              <input value={l.title} onChange={e => updateDraftLevel(i, 'title', e.target.value)}
                placeholder="Título (ex: Cantor Iniciante)" className="field-input flex-1" />
              <button onClick={() => removeDraftLevelRow(i)} className="btn btn-ghost btn-sm">✕</button>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center">
          <button onClick={addDraftLevelRow} className="btn btn-outline btn-sm">+ adicionar outro nível</button>
          <button onClick={createTrophy} disabled={creating} className="btn btn-solid">
            {creating ? 'Criando...' : 'Criar troféu'}
          </button>
        </div>
      </div>

      {loadingData ? (
        <div className="text-center text-muted py-8 text-sm">Carregando...</div>
      ) : trophies.length === 0 ? (
        <div className="text-center text-muted py-8 text-sm">Nenhum troféu criado ainda.</div>
      ) : (
        <div className="space-y-4">
          {trophies.map((t, i) => {
            const trophyLevels = levels.filter(l => l.trophy_id === t.id).sort((a, b) => a.threshold - b.threshold)
            const productName = products.find(p => p.id === t.product_id)?.name
            return (
              <div key={t.id} className="card fade-in-up p-4" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{t.icon}</span>
                    <div>
                      <div className="font-display">{t.name}</div>
                      <div className="text-muted text-xs">{productName || 'produto removido'}</div>
                    </div>
                  </div>
                  <button onClick={() => removeTrophy(t.id)} className="btn btn-danger-outline btn-sm">Excluir troféu</button>
                </div>

                <div className="flex flex-wrap gap-2 mb-2">
                  {trophyLevels.map(l => (
                    <span key={l.id} className="chip">
                      {l.threshold}x — {l.title}
                      <button onClick={() => removeLevel(l.id)} className="text-muted hover:text-red-bright bg-transparent border-none cursor-pointer">✕</button>
                    </span>
                  ))}
                  <button onClick={() => setNewLevelTrophy(newLevelTrophy === t.id ? null : t.id)} className="btn btn-outline btn-sm btn-pill">
                    + nível
                  </button>
                </div>

                {newLevelTrophy === t.id && (
                  <div className="flex gap-2 items-center card p-2.5">
                    <input value={levelThreshold} onChange={e => setLevelThreshold(e.target.value)} type="number"
                      placeholder="Quantas vezes (ex: 10)" className="field-input w-40" />
                    <input value={levelTitle} onChange={e => setLevelTitle(e.target.value)}
                      placeholder="Título (ex: Gogó de Prata)" className="field-input flex-1" />
                    <button onClick={() => addLevel(t.id)} className="btn btn-success btn-sm">Adicionar</button>
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

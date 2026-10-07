'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PartyPopper, Plus, Trash2, Trophy, X } from 'lucide-react'
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
  useUI,
} from '@/components/ui'

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
  const { toast, confirm } = useUI()

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
    if (!name.trim()) { toast.error('Dê um nome ao troféu primeiro.'); return }
    if (!productId) { toast.error('Escolha qual produto esse troféu vai contar.'); return }

    const validLevels = draftLevels
      .map(l => ({ threshold: parseInt(l.threshold), title: l.title.trim() }))
      .filter(l => !isNaN(l.threshold) && l.threshold > 0 && l.title.length > 0)

    if (validLevels.length === 0) {
      toast.error('Preencha pelo menos um nível: quantas vezes (ex.: 10) e o título (ex.: Cantor Iniciante).')
      return
    }

    setCreating(true)
    const { data: trophy, error } = await supabase.from('trophies').insert({
      name: name.trim(), description: description.trim() || null, icon: icon.trim() || '🏆',
      product_id: productId, created_by: user?.id,
    }).select().single()

    if (error || !trophy) {
      toast.error('Erro ao criar o troféu: ' + (error?.message || 'motivo desconhecido') + '. Confira se as migrações foram rodadas no Supabase.')
      setCreating(false)
      return
    }

    const { error: levelError } = await supabase.from('trophy_levels').insert(
      validLevels.map(l => ({ trophy_id: trophy.id, threshold: l.threshold, title: l.title }))
    )
    if (levelError) {
      toast.error('O troféu foi criado, mas deu erro ao criar os níveis: ' + levelError.message)
    } else {
      toast.success(`Troféu "${name.trim()}" criado.`)
    }

    setName(''); setDescription(''); setIcon('🏆'); setProductId('')
    setDraftLevels([{ threshold: '', title: '' }])
    setCreating(false)
    await load()
  }

  const removeTrophy = async (t: Trophy) => {
    const ok = await confirm({
      title: `Excluir o troféu "${t.name}"?`,
      message: 'Todos os níveis dele também são apagados.',
      confirmLabel: 'Excluir troféu',
      tone: 'danger',
    })
    if (!ok) return
    const { error } = await supabase.from('trophies').delete().eq('id', t.id)
    if (error) { toast.error('Erro ao excluir: ' + error.message); return }
    toast.success('Troféu excluído.')
    await load()
  }

  const addLevel = async (trophyId: string) => {
    const threshold = parseInt(levelThreshold)
    if (isNaN(threshold) || threshold <= 0) { toast.error('Informe quantas vezes é preciso para esse nível.'); return }
    if (!levelTitle.trim()) { toast.error('Dê um título para esse nível.'); return }
    const { error } = await supabase.from('trophy_levels').insert({ trophy_id: trophyId, threshold, title: levelTitle.trim() })
    if (error) { toast.error('Erro ao adicionar o nível: ' + error.message); return }
    toast.success('Nível adicionado.')
    setLevelThreshold(''); setLevelTitle(''); setNewLevelTrophy(null)
    await load()
  }

  const removeLevel = async (id: string) => {
    const { error } = await supabase.from('trophy_levels').delete().eq('id', id)
    if (error) { toast.error('Erro ao remover o nível: ' + error.message); return }
    await load()
  }

  if (authLoading) return <FullScreenLoading />
  if (!user || (isStaff && !isAdmin)) return null

  // -------- Visão do cliente --------
  if (!isAdmin) {
    return (
      <PageShell title="Meus troféus" subtitle="Quanto mais você pede, mais sobe de nível.">
        {loadingData ? (
          <LoadingBlock />
        ) : myTrophies.length === 0 ? (
          <Card>
            <EmptyState icon={Trophy} title="Nenhum troféu por aqui ainda" description="Quando o bar criar os primeiros troféus, você acompanha seu progresso nesta tela." />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myTrophies.map(t => {
              const progress = t.next_threshold ? Math.min(100, (t.count / t.next_threshold) * 100) : 100
              const maxed = !t.next_threshold && !!t.current_level_title
              return (
                <Card key={t.trophy_id} className="flex flex-col p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-raised text-2xl" aria-hidden>
                      {t.icon}
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-[15px] font-semibold leading-tight text-ink">{t.trophy_name}</h2>
                      {t.product_name && <p className="truncate text-xs text-mute">{t.product_name}</p>}
                    </div>
                  </div>
                  {t.description && <p className="mb-3 text-sm text-ink2">{t.description}</p>}

                  <div className="mt-auto">
                    {t.current_level_title ? (
                      <Badge tone="red" className="mb-3 h-7 px-3 text-[13px]">{t.current_level_title}</Badge>
                    ) : (
                      <p className="mb-3 text-sm text-mute">Ainda sem nível. Peça o primeiro!</p>
                    )}

                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs text-ink2">
                      <span className="tnum">{t.count}× pedido</span>
                      {t.next_threshold && (
                        <span className="truncate">Próximo: {t.next_level_title} ({t.next_threshold}×)</span>
                      )}
                    </div>
                    <ProgressBar value={progress} tone={maxed ? 'green' : 'red'} />
                    {maxed && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-ok">
                        <PartyPopper className="h-3.5 w-3.5" aria-hidden /> Nível máximo!
                      </p>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </PageShell>
    )
  }

  // -------- Visão admin --------
  return (
    <PageShell
      title="Troféus"
      subtitle="Conquistas que os clientes desbloqueiam ao pedir um produto várias vezes."
    >
      <Card className="mb-6 p-4 sm:p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink">Novo troféu</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_2fr_80px_2fr]">
          <Field label="Nome">
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Gogó de Ouro" />
          </Field>
          <Field label="Descrição (opcional)">
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex.: Para quem não perde um karaokê" />
          </Field>
          <Field label="Ícone">
            <Input value={icon} onChange={e => setIcon(e.target.value)} placeholder="🏆" className="text-center" />
          </Field>
          <Field label="Produto contado">
            <Select value={productId} onChange={e => setProductId(e.target.value)}>
              <option value="">Escolha um produto…</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <h3 className="mb-1 text-sm font-semibold text-ink">Níveis</h3>
          <p className="mb-3 text-xs text-mute">Quantas vezes o cliente precisa pedir para alcançar cada título.</p>
          <div className="space-y-2.5">
            {draftLevels.map((l, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2.5 sm:flex-nowrap">
                <Input
                  value={l.threshold}
                  onChange={e => updateDraftLevel(i, 'threshold', e.target.value)}
                  type="number"
                  inputMode="numeric"
                  placeholder="Vezes (ex.: 10)"
                  aria-label={`Nível ${i + 1}: quantas vezes`}
                  className="w-32 shrink-0"
                />
                <Input
                  value={l.title}
                  onChange={e => updateDraftLevel(i, 'title', e.target.value)}
                  placeholder="Título (ex.: Cantor Iniciante)"
                  aria-label={`Nível ${i + 1}: título`}
                  className="min-w-0 flex-1"
                />
                <IconButton
                  icon={X}
                  label={`Remover nível ${i + 1}`}
                  onClick={() => removeDraftLevelRow(i)}
                  disabled={draftLevels.length === 1}
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" size="sm" icon={Plus} onClick={addDraftLevelRow}>
              Outro nível
            </Button>
            <Button variant="primary" size="lg" loading={creating} onClick={createTrophy}>
              {creating ? 'Criando…' : 'Criar troféu'}
            </Button>
          </div>
        </div>
      </Card>

      {loadingData ? (
        <LoadingBlock />
      ) : trophies.length === 0 ? (
        <Card>
          <EmptyState icon={Trophy} title="Nenhum troféu criado" description="Crie o primeiro no formulário acima." />
        </Card>
      ) : (
        <div className="space-y-4">
          {trophies.map(t => {
            const trophyLevels = levels.filter(l => l.trophy_id === t.id).sort((a, b) => a.threshold - b.threshold)
            const productName = products.find(p => p.id === t.product_id)?.name
            return (
              <Card key={t.id} className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-raised text-2xl" aria-hidden>
                      {t.icon}
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-[15px] font-semibold text-ink">{t.name}</h2>
                      <p className="truncate text-xs text-mute">{productName || 'Produto removido'}</p>
                    </div>
                  </div>
                  <IconButton icon={Trash2} label={`Excluir troféu ${t.name}`} onClick={() => removeTrophy(t)} className="hover:text-red-bright" />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {trophyLevels.map(l => (
                    <span key={l.id} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-raised pl-3 pr-1 text-sm text-ink">
                      <span className="tnum text-mute">{l.threshold}×</span> {l.title}
                      <button
                        type="button"
                        onClick={() => removeLevel(l.id)}
                        aria-label={`Remover nível ${l.title}`}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-mute transition-colors hover:bg-hover hover:text-red-bright"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </span>
                  ))}
                  <Button variant="secondary" size="sm" icon={Plus} onClick={() => setNewLevelTrophy(newLevelTrophy === t.id ? null : t.id)}>
                    Nível
                  </Button>
                </div>

                {newLevelTrophy === t.id && (
                  <div className="mt-3 flex animate-fade-in flex-wrap items-center gap-2.5 rounded-xl border border-line bg-bg p-3 sm:flex-nowrap">
                    <Input
                      value={levelThreshold}
                      onChange={e => setLevelThreshold(e.target.value)}
                      type="number"
                      inputMode="numeric"
                      placeholder="Vezes (ex.: 10)"
                      aria-label="Quantas vezes"
                      className="w-32 shrink-0"
                    />
                    <Input
                      value={levelTitle}
                      onChange={e => setLevelTitle(e.target.value)}
                      placeholder="Título (ex.: Gogó de Prata)"
                      aria-label="Título do nível"
                      className="min-w-0 flex-1"
                    />
                    <Button variant="primary" size="lg" onClick={() => addLevel(t.id)} className="lg:h-11">Adicionar</Button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}

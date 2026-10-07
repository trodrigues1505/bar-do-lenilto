'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crown, History, Lock, Medal, SlidersHorizontal, Trophy, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/providers'
import PageShell, { FullScreenLoading } from '@/components/PageShell'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  Segmented,
  Switch,
  cn,
  fmtMoney as fmt,
  useUI,
} from '@/components/ui'

type LeaderRow = { customer_id: string; full_name: string | null; email: string | null; total_points: number }
type ClientProfile = { id: string; full_name: string | null; email: string | null; created_at: string }
type HistoryRow = { product_name: string; qty: number; unit_price: number; created_at: string; table_number: number | null }

const PERIOD_OPTIONS = [
  { value: 'month' as const, label: 'Este mês' },
  { value: 'all' as const, label: 'Geral' },
]

export default function ClientesPage() {
  const { user, isStaff, isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useUI()

  const [period, setPeriod] = useState<'month' | 'all'>('month')
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([])
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [settingsVisible, setSettingsVisible] = useState(true)
  const [pointsPerReal, setPointsPerReal] = useState(1)
  const [loadingData, setLoadingData] = useState(true)

  const [adjustingId, setAdjustingId] = useState<string | null>(null)
  const [adjustPoints, setAdjustPoints] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  const [historyId, setHistoryId] = useState<string | null>(null)
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login/')
  }, [authLoading, user, router])

  const loadLeaderboard = async (p: 'month' | 'all') => {
    const { data } = await supabase.rpc('get_leaderboard', { period: p })
    setLeaderboard(data || [])
  }

  const loadAll = async () => {
    setLoadingData(true)
    await loadLeaderboard(period)
    if (isStaff) {
      const { data: clientRows } = await supabase
        .from('profiles').select('id, full_name, email, created_at')
        .eq('role', 'cliente').order('created_at', { ascending: false })
      setClients(clientRows || [])
    }
    const { data: settings } = await supabase.from('app_settings').select('*').eq('id', 1).single()
    if (settings) {
      setSettingsVisible(settings.leaderboard_visible)
      setPointsPerReal(settings.points_per_real)
    }
    setLoadingData(false)
  }

  useEffect(() => { if (user) loadAll() }, [user, isStaff])
  useEffect(() => { if (user) loadLeaderboard(period) }, [period])

  const toggleVisibility = async (newVal: boolean) => {
    setSettingsVisible(newVal)
    const { error } = await supabase.from('app_settings').update({ leaderboard_visible: newVal }).eq('id', 1)
    if (error) { toast.error('Não foi possível salvar: ' + error.message); setSettingsVisible(!newVal) }
  }

  const savePointsRatio = async (value: number) => {
    setPointsPerReal(value)
    const { error } = await supabase.from('app_settings').update({ points_per_real: value }).eq('id', 1)
    if (error) toast.error('Não foi possível salvar: ' + error.message)
  }

  const pointsFor = (clientId: string) => leaderboard.find(l => l.customer_id === clientId)?.total_points ?? 0

  const submitAdjust = async (clientId: string) => {
    const points = parseInt(adjustPoints)
    if (isNaN(points) || points === 0) { toast.error('Informe os pontos, por exemplo +10 ou -10.'); return }
    const { error } = await supabase.from('loyalty_transactions').insert({
      customer_id: clientId,
      points,
      reason: adjustReason.trim() || (points > 0 ? 'Ajuste manual' : 'Desconto por comportamento inadequado'),
      created_by: user?.id,
    })
    if (error) { toast.error('Não foi possível ajustar: ' + error.message); return }
    toast.success(`${points > 0 ? '+' : ''}${points} pontos aplicados.`)
    setAdjustingId(null)
    setAdjustPoints('')
    setAdjustReason('')
    await loadLeaderboard(period)
  }

  const toggleHistory = async (clientId: string) => {
    if (historyId === clientId) { setHistoryId(null); return }
    setHistoryId(clientId)
    setAdjustingId(null)
    setLoadingHistory(true)
    const { data, error } = await supabase
      .from('order_items')
      .select('product_name, qty, unit_price, created_at, orders(bar_tables(number))')
      .eq('customer_id', clientId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) {
      console.error(error)
      toast.error('Não foi possível carregar o histórico.')
      setHistoryRows([])
    } else {
      setHistoryRows((data || []).map((r: any) => ({
        product_name: r.product_name, qty: r.qty, unit_price: r.unit_price,
        created_at: r.created_at, table_number: r.orders?.bar_tables?.number ?? null,
      })))
    }
    setLoadingHistory(false)
  }

  if (authLoading) return <FullScreenLoading />
  if (!user) return null

  // -------- Visão do cliente (sem função administrativa) --------
  if (!isStaff) {
    const myRank = leaderboard.findIndex(l => l.customer_id === user.id)
    const medalTone = ['text-warn', 'text-ink2', 'text-red-bright']
    return (
      <PageShell
        title="Top clientes"
        subtitle="Pontos acumulados por consumo no bar."
        actions={<Segmented value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />}
      >
        {!settingsVisible ? (
          <Card>
            <EmptyState
              icon={Lock}
              title="O ranking está privado"
              description="Pergunte ao atendente quantos pontos você já tem."
            />
          </Card>
        ) : leaderboard.length === 0 ? (
          <Card>
            <EmptyState icon={Trophy} title="Ninguém pontuou ainda" description="Os pontos aparecem aqui assim que os primeiros pagamentos forem registrados neste período." />
          </Card>
        ) : (
          <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {leaderboard.map((l, i) => {
              const mine = l.customer_id === user.id
              return (
                <li key={l.customer_id} className={cn('flex items-center gap-3 px-4 py-3.5', mine && 'bg-red/10')}>
                  <span className="flex w-8 shrink-0 justify-center">
                    {i < 3 ? (
                      <Medal className={cn('h-5 w-5', medalTone[i])} aria-label={`${i + 1}º lugar`} />
                    ) : (
                      <span className="text-sm font-medium text-mute tnum">{i + 1}º</span>
                    )}
                  </span>
                  <Avatar name={l.full_name || l.email} />
                  <span className="min-w-0 flex-1 truncate text-[15px] text-ink">
                    {l.full_name || l.email}
                    {mine && <span className="ml-2 text-xs text-red-bright">(você)</span>}
                  </span>
                  <span className="shrink-0 text-[15px] font-semibold text-ink tnum">{l.total_points} pts</span>
                </li>
              )
            })}
          </ol>
        )}

        {settingsVisible && leaderboard.length > 0 && myRank === -1 && (
          <p className="mt-5 text-center text-sm text-mute">
            Você ainda não tem pontos neste período. Peça para o atendente te vincular à mesa e os pontos começam a contar.
          </p>
        )}
      </PageShell>
    )
  }

  // -------- Visão staff (admin/funcionário) --------
  const sorted = [...clients].sort((a, b) => pointsFor(b.id) - pointsFor(a.id))

  return (
    <PageShell
      title="Clientes"
      subtitle={`${clients.length} ${clients.length === 1 ? 'cliente' : 'clientes'} · ${pointsPerReal} ponto${pointsPerReal === 1 ? '' : 's'} por R$ 1 pago`}
      actions={<Segmented value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />}
    >
      {isAdmin && (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 p-4 sm:p-5">
          <Switch checked={settingsVisible} onChange={toggleVisibility} label="Mostrar o ranking para os clientes" />
          <label className="flex items-center gap-3 text-sm text-ink2">
            Pontos por R$ 1
            <input
              type="number"
              step="0.1"
              min="0"
              value={pointsPerReal}
              onChange={e => savePointsRatio(parseFloat(e.target.value) || 0)}
              aria-label="Pontos por real pago"
              className="h-10 w-20 rounded-[10px] border border-line bg-bg px-3 text-center text-sm text-ink transition-colors hover:border-lineStrong focus:border-red focus:outline-none focus:ring-2 focus:ring-red/25"
            />
          </label>
        </Card>
      )}

      {loadingData ? (
        <LoadingBlock />
      ) : clients.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title="Nenhum cliente ainda" description="Os clientes aparecem aqui depois do primeiro login com o Google." />
        </Card>
      ) : (
        <ul className="space-y-3">
          {sorted.map((c, i) => (
            <li key={c.id}>
              <Card className="overflow-hidden">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
                  <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
                    <Avatar name={c.full_name || c.email} size="lg" />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-[15px] font-medium text-ink">
                        <span className="truncate">{c.full_name || 'Sem nome'}</span>
                        {i === 0 && pointsFor(c.id) > 0 && <Crown className="h-4 w-4 shrink-0 text-warn" aria-label="Líder do ranking" />}
                      </p>
                      <p className="truncate text-sm text-mute">{c.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={pointsFor(c.id) > 0 ? 'red' : 'neutral'} className="h-7 px-3 text-[13px]">
                      <span className="tnum">{pointsFor(c.id)} pts</span>
                    </Badge>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={SlidersHorizontal}
                          onClick={() => { setAdjustingId(adjustingId === c.id ? null : c.id); setHistoryId(null) }}
                          aria-expanded={adjustingId === c.id}
                        >
                          Ajustar
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={History}
                          onClick={() => toggleHistory(c.id)}
                          aria-expanded={historyId === c.id}
                        >
                          Histórico
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {adjustingId === c.id && (
                  <div className="animate-fade-in border-t border-line bg-bg p-4">
                    <div className="grid gap-3 sm:grid-cols-[110px_1fr_auto] sm:items-end">
                      <Field label="Pontos">
                        <Input type="number" placeholder="+10 ou -10" value={adjustPoints} onChange={e => setAdjustPoints(e.target.value)} />
                      </Field>
                      <Field label="Motivo (opcional)">
                        <Input type="text" placeholder="Ex.: comportamento inadequado" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} />
                      </Field>
                      <Button variant="primary" size="lg" onClick={() => submitAdjust(c.id)} className="lg:h-11">Aplicar</Button>
                    </div>
                  </div>
                )}

                {historyId === c.id && (
                  <div className="animate-fade-in border-t border-line bg-bg p-4">
                    <p className="mb-3 text-xs font-medium text-mute">Últimos 50 itens consumidos</p>
                    {loadingHistory ? (
                      <LoadingBlock className="py-6" />
                    ) : historyRows.length === 0 ? (
                      <p className="py-4 text-center text-sm text-mute">Nenhum item atribuído a esse cliente ainda.</p>
                    ) : (
                      <ul className="max-h-72 divide-y divide-line overflow-y-auto">
                        {historyRows.map((h, idx) => (
                          <li key={idx} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                            <span className="min-w-0 truncate text-ink">
                              {h.qty}× {h.product_name}
                              {h.table_number && <span className="text-mute"> · Mesa {h.table_number}</span>}
                            </span>
                            <span className="flex shrink-0 items-center gap-3">
                              <span className="hidden text-xs text-mute sm:inline">{new Date(h.created_at).toLocaleDateString('pt-BR')}</span>
                              <span className="font-medium text-ink2 tnum">{fmt(h.unit_price * h.qty)}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  )
}

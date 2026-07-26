'use client'

import { Fragment, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/providers'
import Topbar from '@/components/Topbar'

type LeaderRow = { customer_id: string; full_name: string | null; email: string | null; total_points: number }
type ClientProfile = { id: string; full_name: string | null; email: string | null; created_at: string }
type HistoryRow = { product_name: string; qty: number; unit_price: number; created_at: string; table_number: number | null }

const fmt = (n: number) => 'R$ ' + n.toFixed(2).replace('.', ',')

export default function ClientesPage() {
  const { user, isStaff, isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

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

  const toggleVisibility = async () => {
    const newVal = !settingsVisible
    setSettingsVisible(newVal)
    await supabase.from('app_settings').update({ leaderboard_visible: newVal }).eq('id', 1)
  }

  const savePointsRatio = async (value: number) => {
    setPointsPerReal(value)
    await supabase.from('app_settings').update({ points_per_real: value }).eq('id', 1)
  }

  const pointsFor = (clientId: string) => leaderboard.find(l => l.customer_id === clientId)?.total_points ?? 0

  const submitAdjust = async (clientId: string) => {
    const points = parseInt(adjustPoints)
    if (isNaN(points) || points === 0) return
    await supabase.from('loyalty_transactions').insert({
      customer_id: clientId,
      points,
      reason: adjustReason.trim() || (points > 0 ? 'Ajuste manual' : 'Desconto por comportamento inadequado'),
      created_by: user?.id,
    })
    setAdjustingId(null)
    setAdjustPoints('')
    setAdjustReason('')
    await loadLeaderboard(period)
  }

  const toggleHistory = async (clientId: string) => {
    if (historyId === clientId) { setHistoryId(null); return }
    setHistoryId(clientId)
    setLoadingHistory(true)
    const { data, error } = await supabase
      .from('order_items')
      .select('product_name, qty, unit_price, created_at, orders(bar_tables(number))')
      .eq('customer_id', clientId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) {
      console.error(error)
      setHistoryRows([])
    } else {
      setHistoryRows((data || []).map((r: any) => ({
        product_name: r.product_name, qty: r.qty, unit_price: r.unit_price,
        created_at: r.created_at, table_number: r.orders?.bar_tables?.number ?? null,
      })))
    }
    setLoadingHistory(false)
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted text-sm">Carregando...</div>
  }
  if (!user) return null

  // -------- Visão do cliente (sem função administrativa) --------
  if (!isStaff) {
    const myRank = leaderboard.findIndex(l => l.customer_id === user.id)
    return (
      <div className="max-w-6xl mx-auto px-5 pt-5 pb-20">
        <Topbar />
        <h2 className="text-xl mb-1">Top Clientes 🏆</h2>
        <p className="text-muted text-sm mb-5">Pontos acumulados por consumo no bar.</p>

        <div className="flex gap-1.5 bg-bgElevated border border-line rounded-lg p-1 mb-5 w-fit">
          <button onClick={() => setPeriod('month')} className={`btn btn-sm ${period === 'month' ? 'btn-solid' : 'btn-ghost'}`}>Este mês</button>
          <button onClick={() => setPeriod('all')} className={`btn btn-sm ${period === 'all' ? 'btn-solid' : 'btn-ghost'}`}>Geral</button>
        </div>

        {!settingsVisible ? (
          <div className="text-center text-muted py-10 text-sm">
            O ranking está privado no momento. Pergunte ao atendente quantos pontos você já tem!
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center text-muted py-10 text-sm">Ninguém pontuou ainda nesse período.</div>
        ) : (
          <div className="card overflow-hidden">
            {leaderboard.map((l, i) => (
              <div key={l.customer_id} className={`fade-in-up flex items-center justify-between px-4 py-3 border-b border-line last:border-b-0 ${l.customer_id === user.id ? 'bg-red/10' : ''}`} style={{ animationDelay: `${i * 40}ms` }}>
                <div className="flex items-center gap-3">
                  <span className="font-display text-lg w-6 text-muted">{i + 1}º</span>
                  <span>{l.full_name || l.email}{l.customer_id === user.id && <span className="text-red-bright text-xs ml-2">(você)</span>}</span>
                </div>
                <span className="font-display text-red-bright">{l.total_points} pts</span>
              </div>
            ))}
          </div>
        )}

        {myRank === -1 && (
          <p className="text-muted text-xs mt-5 text-center">
            Você ainda não tem pontos nesse período — consuma no bar com seu perfil vinculado à mesa!
          </p>
        )}
      </div>
    )
  }

  // -------- Visão staff (admin/funcionário) --------
  return (
    <div className="max-w-6xl mx-auto px-5 pt-5 pb-20">
      <Topbar />
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <h2 className="text-xl m-0">Clientes ({clients.length})</h2>
        <div className="flex gap-1.5 bg-bgElevated border border-line rounded-lg p-1">
          <button onClick={() => setPeriod('month')} className={`btn btn-sm ${period === 'month' ? 'btn-solid' : 'btn-ghost'}`}>Este mês</button>
          <button onClick={() => setPeriod('all')} className={`btn btn-sm ${period === 'all' ? 'btn-solid' : 'btn-ghost'}`}>Geral</button>
        </div>
      </div>
      <p className="text-muted text-sm mb-5">
        Pontos ganhos automaticamente a cada pagamento registrado com um cliente vinculado
        ({pointsPerReal} pt por R$1). Dá pra ajustar pontos manualmente (inclusive descontar).
      </p>

      {isAdmin && (
        <div className="card p-4 mb-6 flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input type="checkbox" checked={settingsVisible} onChange={toggleVisibility} className="w-4 h-4" />
            Lista de pontos visível pros clientes
          </label>
          <label className="flex items-center gap-2.5 text-sm">
            Pontos por R$1:
            <input
              type="number" step="0.1" value={pointsPerReal}
              onChange={(e) => savePointsRatio(parseFloat(e.target.value) || 0)}
              className="field-input w-20"
            />
          </label>
        </div>
      )}

      {loadingData ? (
        <div className="text-center text-muted py-8 text-sm">Carregando...</div>
      ) : clients.length === 0 ? (
        <div className="text-center text-muted py-8 text-sm">Nenhum cliente logou ainda.</div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left text-[11px] tracking-wide uppercase text-muted px-2.5 py-2 border-b border-line">Nome</th>
              <th className="text-left text-[11px] tracking-wide uppercase text-muted px-2.5 py-2 border-b border-line">E-mail</th>
              <th className="text-left text-[11px] tracking-wide uppercase text-muted px-2.5 py-2 border-b border-line">Pontos</th>
              {isAdmin && <th className="border-b border-line"></th>}
            </tr>
          </thead>
          <tbody>
            {[...clients].sort((a, b) => pointsFor(b.id) - pointsFor(a.id)).map(c => (
              <Fragment key={c.id}>
                <tr>
                  <td className="px-2.5 py-2.5 border-b border-line">{c.full_name || '—'}</td>
                  <td className="px-2.5 py-2.5 border-b border-line text-paperDim">{c.email}</td>
                  <td className="px-2.5 py-2.5 border-b border-line font-display text-red-bright">{pointsFor(c.id)}</td>
                  {isAdmin && (
                    <td className="px-2.5 py-2.5 border-b border-line whitespace-nowrap">
                      <button onClick={() => setAdjustingId(adjustingId === c.id ? null : c.id)} className="btn btn-ghost btn-sm">
                        Ajustar pontos
                      </button>
                      <button onClick={() => toggleHistory(c.id)} className="btn btn-ghost btn-sm">
                        Ver histórico
                      </button>
                    </td>
                  )}
                </tr>
                {adjustingId === c.id && (
                  <tr>
                    <td colSpan={4} className="px-2.5 pb-3 border-b border-line">
                      <div className="card p-3 flex flex-wrap items-center gap-2">
                        <input
                          type="number" placeholder="+10 ou -10" value={adjustPoints}
                          onChange={(e) => setAdjustPoints(e.target.value)}
                          className="field-input w-24"
                        />
                        <input
                          type="text" placeholder="Motivo (ex: comportamento inadequado)"
                          value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)}
                          className="field-input flex-1 min-w-[180px]"
                        />
                        <button onClick={() => submitAdjust(c.id)} className="btn btn-solid btn-sm">Aplicar</button>
                      </div>
                    </td>
                  </tr>
                )}
                {historyId === c.id && (
                  <tr>
                    <td colSpan={4} className="px-2.5 pb-3 border-b border-line">
                      <div className="card p-3">
                        <div className="text-[11px] tracking-wide uppercase text-muted mb-2">Histórico de consumo (últimos 50 itens)</div>
                        {loadingHistory ? (
                          <div className="text-center text-muted py-4 text-sm">Carregando...</div>
                        ) : historyRows.length === 0 ? (
                          <div className="text-center text-muted py-4 text-sm">Nenhum item atribuído a esse cliente ainda.</div>
                        ) : (
                          <div className="max-h-64 overflow-y-auto space-y-1">
                            {historyRows.map((h, i) => (
                              <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-line last:border-b-0">
                                <span>
                                  {h.qty}x {h.product_name}
                                  {h.table_number && <span className="text-muted text-xs"> · Mesa {h.table_number}</span>}
                                </span>
                                <span className="flex items-center gap-3">
                                  <span className="text-muted text-xs">{new Date(h.created_at).toLocaleDateString('pt-BR')}</span>
                                  <span className="font-display text-paperDim">{fmt(h.unit_price * h.qty)}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

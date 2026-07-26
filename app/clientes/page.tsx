'use client'

import { Fragment, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/providers'
import Topbar from '@/components/Topbar'

type LeaderRow = { customer_id: string; full_name: string | null; email: string | null; total_points: number }
type ClientProfile = { id: string; full_name: string | null; email: string | null; created_at: string }

export default function ClientesPage() {
  const { user, profile, isStaff, isAdmin, loading: authLoading } = useAuth()
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

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted text-sm">Carregando...</div>
  }
  if (!user) return null

  // -------- Visão do cliente (sem função administrativa) --------
  if (!isStaff) {
    const myPoints = leaderboard.find(l => l.customer_id === user.id)?.total_points ?? 0
    const myRank = leaderboard.findIndex(l => l.customer_id === user.id)
    return (
      <div className="max-w-6xl mx-auto px-5 pt-5 pb-20">
        <Topbar />
        <h2 className="text-xl mb-1">Top Clientes 🏆</h2>
        <p className="text-muted text-sm mb-5">Pontos acumulados por consumo no bar.</p>

        <div className="flex gap-1.5 bg-bgElevated border border-line rounded-lg p-1 mb-5 w-fit">
          <button onClick={() => setPeriod('month')} className={`px-3.5 py-1.5 rounded-md text-xs font-display tracking-wide uppercase ${period === 'month' ? 'bg-red text-paper' : 'text-paperDim'}`}>Este mês</button>
          <button onClick={() => setPeriod('all')} className={`px-3.5 py-1.5 rounded-md text-xs font-display tracking-wide uppercase ${period === 'all' ? 'bg-red text-paper' : 'text-paperDim'}`}>Geral</button>
        </div>

        {!settingsVisible ? (
          <div className="text-center text-muted py-10 text-sm">
            O ranking está privado no momento. Pergunte ao atendente quantos pontos você já tem!
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center text-muted py-10 text-sm">Ninguém pontuou ainda nesse período.</div>
        ) : (
          <div className="bg-bgCard border border-line rounded-xl overflow-hidden">
            {leaderboard.map((l, i) => (
              <div key={l.customer_id} className={`flex items-center justify-between px-4 py-3 border-b border-line last:border-b-0 ${l.customer_id === user.id ? 'bg-red/10' : ''}`}>
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
          <button onClick={() => setPeriod('month')} className={`px-3.5 py-1.5 rounded-md text-xs font-display tracking-wide uppercase ${period === 'month' ? 'bg-red text-paper' : 'text-paperDim'}`}>Este mês</button>
          <button onClick={() => setPeriod('all')} className={`px-3.5 py-1.5 rounded-md text-xs font-display tracking-wide uppercase ${period === 'all' ? 'bg-red text-paper' : 'text-paperDim'}`}>Geral</button>
        </div>
      </div>
      <p className="text-muted text-sm mb-5">
        Pontos ganhos automaticamente ao vincular um cliente numa mesa e fechar o pedido
        ({pointsPerReal} pt por R$1). Dá pra ajustar pontos manualmente (inclusive descontar).
      </p>

      {isAdmin && (
        <div className="bg-bgElevated border border-line rounded-xl p-4 mb-6 flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input type="checkbox" checked={settingsVisible} onChange={toggleVisibility} className="w-4 h-4" />
            Lista de pontos visível pros clientes
          </label>
          <label className="flex items-center gap-2.5 text-sm">
            Pontos por R$1:
            <input
              type="number" step="0.1" value={pointsPerReal}
              onChange={(e) => savePointsRatio(parseFloat(e.target.value) || 0)}
              className="w-20 bg-bg border border-line rounded px-2 py-1"
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
                <tr key={c.id}>
                  <td className="px-2.5 py-2.5 border-b border-line">{c.full_name || '—'}</td>
                  <td className="px-2.5 py-2.5 border-b border-line text-paperDim">{c.email}</td>
                  <td className="px-2.5 py-2.5 border-b border-line font-display text-red-bright">{pointsFor(c.id)}</td>
                  {isAdmin && (
                    <td className="px-2.5 py-2.5 border-b border-line">
                      <button
                        onClick={() => setAdjustingId(adjustingId === c.id ? null : c.id)}
                        className="text-xs text-paperDim hover:text-paper bg-transparent border-none cursor-pointer"
                      >
                        Ajustar pontos
                      </button>
                    </td>
                  )}
                </tr>
                {adjustingId === c.id && (
                  <tr key={`${c.id}-adjust`}>
                    <td colSpan={4} className="px-2.5 pb-3 border-b border-line">
                      <div className="bg-bgCard border border-line rounded-lg p-3 flex flex-wrap items-center gap-2">
                        <input
                          type="number" placeholder="+10 ou -10" value={adjustPoints}
                          onChange={(e) => setAdjustPoints(e.target.value)}
                          className="w-24 bg-bg border border-line rounded px-2 py-1.5 text-sm"
                        />
                        <input
                          type="text" placeholder="Motivo (ex: comportamento inadequado)"
                          value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)}
                          className="flex-1 min-w-[180px] bg-bg border border-line rounded px-2 py-1.5 text-sm"
                        />
                        <button onClick={() => submitAdjust(c.id)} className="bg-red hover:bg-red-bright text-paper text-xs font-display px-3 py-1.5 rounded">
                          Aplicar
                        </button>
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

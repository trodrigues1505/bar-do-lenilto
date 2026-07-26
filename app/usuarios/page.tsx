'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/providers'
import Topbar from '@/components/Topbar'

type Profile = {
  id: string
  email: string | null
  full_name: string | null
  role: 'admin' | 'funcionario' | 'cliente'
  created_at: string
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  funcionario: 'Funcionário',
  cliente: 'Cliente',
}

export default function UsuariosPage() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login/')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!authLoading && user && !isAdmin) router.replace('/mesas/')
  }, [authLoading, user, isAdmin, router])

  const load = async () => {
    setLoadingList(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    setProfiles(data || [])
    setLoadingList(false)
  }
  useEffect(() => { if (isAdmin) load() }, [isAdmin])

  const changeRole = async (profile: Profile, newRole: string) => {
    if (profile.id === user?.id && newRole !== 'admin') {
      if (!confirm('Você está tirando o seu próprio acesso de admin. Tem certeza?')) return
    }
    setSavingId(profile.id)
    await supabase.from('profiles').update({ role: newRole }).eq('id', profile.id)
    await load()
    setSavingId(null)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted text-sm">
        Carregando...
      </div>
    )
  }
  if (!user || !isAdmin) return null

  return (
    <div className="max-w-6xl mx-auto px-5 pt-5 pb-20">
      <Topbar />
      <h2 className="text-xl mb-4">Usuários ({profiles.length})</h2>
      <p className="text-muted text-sm mb-5">
        Só aparece aqui quem já fez login pelo menos uma vez no app. Clientes entram
        automaticamente com esse papel — promova pra Funcionário ou Admin quando precisar.
      </p>

      {loadingList ? (
        <div className="text-center text-muted py-8 text-sm">Carregando...</div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left text-[11px] tracking-wide uppercase text-muted px-2.5 py-2 border-b border-line">Nome</th>
              <th className="text-left text-[11px] tracking-wide uppercase text-muted px-2.5 py-2 border-b border-line">E-mail</th>
              <th className="text-left text-[11px] tracking-wide uppercase text-muted px-2.5 py-2 border-b border-line">Papel</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map(p => (
              <tr key={p.id}>
                <td className="px-2.5 py-2.5 border-b border-line">
                  {p.full_name || '—'}
                  {p.id === user?.id && <span className="text-muted text-xs ml-2">(você)</span>}
                </td>
                <td className="px-2.5 py-2.5 border-b border-line text-paperDim">{p.email}</td>
                <td className="px-2.5 py-2.5 border-b border-line">
                  <select
                    value={p.role}
                    disabled={savingId === p.id}
                    onChange={(e) => changeRole(p, e.target.value)}
                    className="bg-bgElevated border border-line rounded-lg px-3 py-1.5 text-sm"
                  >
                    <option value="cliente">Cliente</option>
                    <option value="funcionario">Funcionário</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

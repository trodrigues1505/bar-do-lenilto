'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/app/providers'
import PageShell, { FullScreenLoading } from '@/components/PageShell'
import { Avatar, Badge, Card, EmptyState, LoadingBlock, Select, useUI } from '@/components/ui'

type Profile = {
  id: string
  email: string | null
  full_name: string | null
  role: 'admin' | 'funcionario' | 'cliente'
  created_at: string
}

export default function UsuariosPage() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const { toast, confirm } = useUI()
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
      const ok = await confirm({
        title: 'Remover o seu próprio acesso de admin?',
        message: 'Depois disso você não vai conseguir abrir esta tela de novo, a menos que outro admin te promova.',
        confirmLabel: 'Remover meu acesso',
        tone: 'danger',
      })
      if (!ok) return
    }
    setSavingId(profile.id)
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', profile.id)
    if (error) toast.error('Não foi possível alterar o papel: ' + error.message)
    else toast.success('Papel atualizado.')
    await load()
    setSavingId(null)
  }

  if (authLoading) return <FullScreenLoading />
  if (!user || !isAdmin) return null

  const counts = {
    admin: profiles.filter(p => p.role === 'admin').length,
    funcionario: profiles.filter(p => p.role === 'funcionario').length,
    cliente: profiles.filter(p => p.role === 'cliente').length,
  }

  return (
    <PageShell
      title="Usuários"
      subtitle="Aparece aqui quem já entrou no app ao menos uma vez. Novos usuários entram como cliente."
    >
      {loadingList ? (
        <LoadingBlock />
      ) : profiles.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title="Nenhum usuário ainda" description="Quando alguém entrar com o Google, aparece nesta lista." />
        </Card>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            <Badge tone="red" icon={ShieldCheck}>{counts.admin} admin{counts.admin !== 1 ? 's' : ''}</Badge>
            <Badge tone="blue">{counts.funcionario} funcionário{counts.funcionario !== 1 ? 's' : ''}</Badge>
            <Badge>{counts.cliente} cliente{counts.cliente !== 1 ? 's' : ''}</Badge>
          </div>

          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {profiles.map(p => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5">
                <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
                  <Avatar name={p.full_name || p.email} size="lg" />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium text-ink">
                      {p.full_name || 'Sem nome'}
                      {p.id === user?.id && <span className="ml-2 text-xs font-normal text-mute">(você)</span>}
                    </p>
                    <p className="truncate text-sm text-mute">{p.email}</p>
                  </div>
                </div>
                <div className="w-full sm:w-44">
                  <Select
                    aria-label={`Papel de ${p.full_name || p.email}`}
                    value={p.role}
                    disabled={savingId === p.id}
                    onChange={e => changeRole(p, e.target.value)}
                    className="h-10"
                  >
                    <option value="cliente">Cliente</option>
                    <option value="funcionario">Funcionário</option>
                    <option value="admin">Admin</option>
                  </Select>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </PageShell>
  )
}

'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

type Profile = {
  id: string
  email: string | null
  full_name: string | null
  role: 'admin' | 'funcionario' | 'cliente'
}

type AuthContextType = {
  user: User | null
  profile: Profile | null
  loading: boolean
  isStaff: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isStaff: false,
  isAdmin: false,
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    let mounted = true

    const loadProfile = async (userId: string) => {
      try {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
        if (mounted) setProfile(data as Profile)
      } catch (err) {
        console.error('Erro ao carregar perfil:', err)
      }
    }

    const init = async () => {
      try {
        // getSession lê a sessão salva localmente (rápido, sem depender de rede).
        // Se algo corrompido tiver ficado salvo, isso não deve travar o app.
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Erro ao ler sessão:', error)
          // Sessão inválida/corrompida — limpa e segue como deslogado.
          await supabase.auth.signOut().catch(() => {})
        }
        if (!mounted) return
        setUser(session?.user ?? null)
        if (session?.user) await loadProfile(session.user.id)
      } catch (err) {
        console.error('Falha inesperada ao iniciar sessão:', err)
      } finally {
        // Isso SEMPRE roda, então a tela nunca fica travada em "carregando".
        if (mounted) setLoading(false)
      }
    }
    init()

    // Trava de segurança: se por algum motivo nada resolver em 8s, libera a tela assim mesmo.
    const safety = setTimeout(() => { if (mounted) setLoading(false) }, 8000)

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      if (session?.user) {
        await loadProfile(session.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => {
      mounted = false
      clearTimeout(safety)
      listener.subscription.unsubscribe()
    }
  }, [])

  const isStaff = profile?.role === 'admin' || profile?.role === 'funcionario'
  const isAdmin = profile?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, profile, loading, isStaff, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

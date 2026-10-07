'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withBasePath } from '@/lib/basePath'
import { Button, useUI } from '@/components/ui'

export default function LoginPage() {
  const supabase = createClient()
  const { toast } = useUI()
  const [signingIn, setSigningIn] = useState(false)

  const handleGoogleLogin = async () => {
    setSigningIn(true)
    // Sem servidor (GitHub Pages): o Supabase lê o token direto na URL quando
    // o Google redireciona de volta para o app (detectSessionInUrl: true no client).
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${withBasePath('/mesas/')}`,
      },
    })
    if (error) {
      toast.error('Não foi possível entrar com o Google: ' + error.message)
      setSigningIn(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-line bg-surface">
        <div className="stripe h-2" aria-hidden />
        <div className="px-7 pb-8 pt-9 text-center">
          <img
            src={withBasePath('/logo.jpg')}
            alt=""
            className="mx-auto mb-5 h-24 w-24 rounded-full object-cover ring-2 ring-red/60 ring-offset-4 ring-offset-surface"
          />
          <h1 className="font-display text-3xl uppercase leading-none tracking-wide text-ink">Bar do Lenilto</h1>
          <p className="mt-3 text-sm text-ink2">Mesas, pedidos e pontos dos clientes em um só lugar.</p>

          <Button
            variant="secondary"
            size="lg"
            full
            loading={signingIn}
            onClick={handleGoogleLogin}
            className="mt-8 !border-transparent !bg-ink !text-bg hover:!bg-ink/90"
          >
            {!signingIn && (
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03l2.97-2.33z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z" />
              </svg>
            )}
            Entrar com Google
          </Button>

          <p className="mt-6 text-xs leading-relaxed text-mute">
            No primeiro acesso você entra como cliente. Um administrador pode liberar o acesso de funcionário.
          </p>
        </div>
      </div>
    </div>
  )
}

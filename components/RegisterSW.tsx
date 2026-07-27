'use client'

import { useEffect } from 'react'
import { withBasePath } from '@/lib/basePath'

export default function RegisterSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register(withBasePath('/sw.js'), {
        scope: withBasePath('/'),
        // Crucial: sem isso, o navegador pode achar que o próprio sw.js
        // está "em cache" e nunca perceber que ele mudou — é isso que
        // deixava uma versão antiga presa mesmo depois de deploys novos.
        updateViaCache: 'none',
      })
      .then((reg) => {
        // Força checar se existe uma versão mais nova toda vez que o app abre.
        reg.update().catch(() => {})
      })
      .catch(() => {})

    // Quando uma versão nova do Service Worker assume o controle,
    // recarrega a página uma vez pra garantir que tudo bate certinho.
    let reloaded = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return
      reloaded = true
      window.location.reload()
    })
  }, [])
  return null
}

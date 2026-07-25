'use client'

import { useEffect } from 'react'
import { withBasePath } from '@/lib/basePath'

export default function RegisterSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register(withBasePath('/sw.js'), { scope: withBasePath('/') })
        .catch(() => {})
    }
  }, [])
  return null
}

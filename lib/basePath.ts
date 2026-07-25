// Quando o site é publicado em usuario.github.io/NOME-DO-REPO/, o Next precisa
// saber esse prefixo para achar imagens, manifest, service worker etc.
// Esse valor vem da variável NEXT_PUBLIC_BASE_PATH definida no build (ver workflow do GitHub Actions).
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

export function withBasePath(path: string) {
  const clean = path.startsWith('/') ? path : `/${path}`
  return `${basePath}${clean}`
}

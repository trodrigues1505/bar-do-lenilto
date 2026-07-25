# 🤘 Bar do Lenilto — Gestão de Mesas

App para gerenciar pedidos por mesa, com login Google real, banco de produtos, perfis
(admin / funcionário / cliente) e instalável como app (Android, iOS, PC).

Publicado como site 100% estático no **GitHub Pages**, com **Supabase** cuidando do
banco de dados e do login.

## 1. Banco de dados no Supabase

1. Crie uma conta/projeto em https://supabase.com (grátis).
2. No painel: **SQL Editor > New query**.
3. Copie todo o conteúdo de `supabase/schema.sql` deste projeto, cole e clique **Run**.
   Isso cria as tabelas, as regras de segurança (RLS) e já cadastra as 10 mesas e os
   produtos de exemplo.
4. Em **Project Settings > API**, copie o `Project URL` e a `anon public key` — vai
   precisar deles no passo 3.

## 2. Login com Google

1. No Supabase: **Authentication > Providers > Google** → habilite.
2. No Google Cloud Console (https://console.cloud.google.com/apis/credentials):
   - **Create Credentials > OAuth client ID** → tipo **Web application**
   - Em **Authorized redirect URIs**, cole a URL que a tela do Google no Supabase mostra
     (algo como `https://SEU-PROJETO.supabase.co/auth/v1/callback`)
   - Copie o **Client ID** e o **Client Secret** e cole nos campos do Supabase.
3. Em **Authentication > URL Configuration** no Supabase, configure:
   - **Site URL**: `https://SEU-USUARIO.github.io/NOME-DO-REPO/`
   - **Redirect URLs**: adicione `https://SEU-USUARIO.github.io/NOME-DO-REPO/**`
     (o `**` no final cobre `/mesas/`, `/login/` etc.)

   Troque `SEU-USUARIO` e `NOME-DO-REPO` pelos valores reais do seu repositório.

## 3. Publicar no GitHub Pages

O projeto já vem com um robô (`.github/workflows/deploy.yml`) que builda e publica
sozinho toda vez que você sobe arquivos na branch `main`.

1. Suba os arquivos deste projeto pro seu repositório no GitHub (upload pela web
   funciona normalmente).
2. No repositório: **Settings > Secrets and variables > Actions > New repository secret**,
   crie duas secrets:
   - `NEXT_PUBLIC_SUPABASE_URL` → a Project URL do passo 1
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → a anon key do passo 1
3. Em **Settings > Pages**, em **Build and deployment > Source**, selecione
   **GitHub Actions**.
4. Pronto — a cada upload/commit na `main`, o site é rebuildado e publicado
   automaticamente em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.
   Acompanhe o progresso na aba **Actions** do repositório.

> ⚠️ Se o seu repositório se chamar exatamente `SEU-USUARIO.github.io` (página de
> usuário, publicada na raiz do domínio, sem subpasta), edite
> `.github/workflows/deploy.yml` e apague a linha
> `NEXT_PUBLIC_BASE_PATH: /${{ github.event.repository.name }}` — nesse caso não
> existe subpasta.

## 4. Virar admin

Todo login novo entra como **Cliente**. Pra você virar admin, no Supabase
(**SQL Editor**), rode trocando pelo seu e-mail do Google:

```sql
update public.profiles set role = 'admin' where email = 'seuemail@gmail.com';
```

Para dar acesso de **Funcionário** a alguém (pai, irmão etc.):

```sql
update public.profiles set role = 'funcionario' where email = 'email-da-pessoa@gmail.com';
```

Depois de rodar o comando, a pessoa precisa sair e entrar de novo no app pra o novo
perfil valer.

## 5. Instalar como app (PWA)

O app já tem manifest, ícones e service worker configurados — dá pra instalar como
se fosse um app nativo:

- **Android (Chrome)**: abre o site, toca nos três pontinhos → **Instalar app** (ou
  aparece um banner automático perguntando).
- **iPhone/iPad (Safari)**: abre o site, toca no ícone de compartilhar (□↑) →
  **Adicionar à Tela de Início**.
- **PC (Chrome/Edge)**: abre o site, clica no ícone de instalação que aparece na
  barra de endereço (ou menu → **Instalar Bar do Lenilto**).

## O que já funciona

- Login real com Google (Supabase Auth), 100% client-side (compatível com GitHub Pages)
- Perfis: admin / funcionário / cliente
- 10 mesas cadastradas, com botão para adicionar mais
- Pedido por mesa: lançar produtos, ajustar quantidade, remover item, total em tempo real
- Fechar pedido (fica registrado como "fechado" na tabela `orders`)
- Cadastro de produtos (nome, preço, categoria) — gerenciado pelo admin
- Splash screen animada com o logo ao abrir o app
- Instalável no Android, iOS e PC (PWA)
- Regras de segurança no banco (RLS): cliente não mexe em pedidos/produtos mesmo
  tentando pela API diretamente

## Próximos passos sugeridos

- Controle de estoque inteligente (baixa automática de insumos por produto vendido,
  alertas de reposição)
- Relatórios (faturamento por dia/mesa/produto)
- Histórico de pedidos fechados por mesa
- Tela própria para o perfil Cliente

## Rodar localmente (opcional, pra testar antes de subir)

```bash
npm install
cp .env.local.example .env.local
# edite o .env.local com sua URL e chave do Supabase
npm run dev
```

Abre `http://localhost:3000`.

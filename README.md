# 🤘 Bar do Lenilto — Gestão de Mesas

App para gerenciar pedidos por mesa, com login Google real, banco de produtos e perfis
de Admin / Funcionário / Cliente. Feito com Next.js + Supabase.

## 1. Criar o projeto no Supabase

1. Acesse https://supabase.com e crie uma conta / novo projeto (grátis).
2. No painel do projeto, vá em **SQL Editor > New query**.
3. Copie todo o conteúdo do arquivo `supabase/schema.sql` deste repositório, cole e clique em **Run**.
   Isso cria as tabelas, as regras de segurança (RLS) e já cadastra as 10 mesas e os produtos iniciais.
4. Vá em **Project Settings > API** e copie:
   - `Project URL`
   - `anon public key`

## 2. Ativar login com Google

1. No Supabase: **Authentication > Providers > Google** → habilite.
2. Você vai precisar de um **Client ID** e **Client Secret** do Google. Para gerar:
   - Acesse https://console.cloud.google.com/apis/credentials
   - Crie um projeto (se não tiver um) → **Create Credentials > OAuth client ID**
   - Tipo de aplicativo: **Web application**
   - Em **Authorized redirect URIs**, adicione a URL que o Supabase mostra na tela do
     provider Google (algo como `https://SEU-PROJETO.supabase.co/auth/v1/callback`)
   - Copie o Client ID e o Client Secret gerados e cole nos campos do Supabase.
3. Em **Authentication > URL Configuration**, defina:
   - **Site URL**: a URL onde o app vai ficar publicado (ex: `https://bardolenilto.vercel.app`)
   - **Redirect URLs**: adicione também `http://localhost:3000/auth/callback` (para testar local)
     e `https://SEU-DOMINIO/auth/callback` (produção)

## 3. Configurar o projeto localmente

```bash
npm install
cp .env.local.example .env.local
```

Edite `.env.local` e cole a URL e a chave anon copiadas no passo 1:

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

Rodar localmente:

```bash
npm run dev
```

Abra `http://localhost:3000` — vai te redirecionar para o login com Google.

## 4. Virar admin

Todo mundo que faz login pela primeira vez entra como **Cliente**. Para você virar admin,
no Supabase vá em **SQL Editor** e rode (trocando pelo seu e-mail do Google):

```sql
update public.profiles set role = 'admin' where email = 'seuemail@gmail.com';
```

Depois disso, faça logout e login de novo no app — o perfil admin libera as abas de
Produtos e (em breve) Estoque/Relatórios, além do cadastro de mesas.

Para dar acesso de **Funcionário** a alguém (ex: seu pai, seu irmão), mesma lógica:

```sql
update public.profiles set role = 'funcionario' where email = 'email-do-funcionario@gmail.com';
```

## 5. Publicar no GitHub + Vercel

```bash
git init
git add .
git commit -m "Bar do Lenilto - versão inicial"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/bar-do-lenilto.git
git push -u origin main
```

Depois:

1. Acesse https://vercel.com, importe o repositório do GitHub.
2. Em **Environment Variables**, adicione as mesmas duas variáveis do `.env.local`.
3. Deploy. A Vercel te dá uma URL pública (ex: `bar-do-lenilto.vercel.app`).
4. Volte no Supabase (**Authentication > URL Configuration**) e atualize a **Site URL** e
   **Redirect URLs** para essa URL de produção, e no Google Cloud Console adicione essa
   URL também nas origens autorizadas, se pedir.

## O que já funciona

- Login real com Google (Supabase Auth)
- Perfis: admin / funcionário / cliente (cliente ainda sem função própria)
- 10 mesas cadastradas, com botão para adicionar mais
- Pedido por mesa: lançar produtos, ajustar quantidade, remover item, total em tempo real
- Fechar pedido (zera a mesa, fica no histórico da tabela `orders` como "fechado")
- Cadastro de produtos (nome, preço, categoria) — gerenciado pelo admin
- Regras de segurança (RLS) no banco: cliente não consegue mexer em pedidos/produtos
  mesmo tentando pela API diretamente

## Próximos passos sugeridos

- Controle de estoque inteligente (baixa automática de insumos por produto vendido, alertas de reposição)
- Relatórios (faturamento por dia/mesa/produto)
- Histórico de pedidos fechados por mesa
- Tela própria para o perfil Cliente (ex: ver cardápio, chamar garçom)

# app-financas

App mobile pessoal de controle financeiro para um grupo pequeno e fechado (3 pessoas).

O objetivo central: **descobrir para onde o dinheiro está indo** e tornar o registro de
gastos rápido o bastante para não ser abandonado na primeira semana.

## Stack

| Camada | Tecnologia |
|---|---|
| App | React Native + Expo SDK 57 (Android) |
| Backend / DB / Auth | Supabase (Postgres + RLS + Edge Functions) |
| IA | Groq (via Edge Function, nunca direto do app) |
| Integração bancária | Nenhuma — lançamento manual |

Escopo completo (o porquê de cada decisão) em [`docs/ESCOPO.md`](docs/ESCOPO.md).

## Como testar agora

### 1. Instalar e rodar

```bash
npm install
cp .env.example .env      # preencha com sua URL + anon key do Supabase
npm start
```

Abra o app **Expo Go** no Android e escaneie o QR code que aparece no terminal.
Não precisa de build nativa nem de cabo — é o mesmo Metro bundler de sempre.

### 2. Entrar

Sua conta já existe no banco. Use o e-mail combinado na conversa e a senha
temporária que foi gerada — troque-a assim que puder (ainda não existe uma
tela de "trocar senha" no app; até lá, troque pelo painel do Supabase em
**Authentication → Users**).

Ao logar pela primeira vez, um Espaço **Pessoal** já existe, com 24
categorias padrão prontas — pode lançar na hora.

### 3. Adicionar sua esposa e sua amiga

Cadastro é fechado (ninguém se registra sozinho). Para cada pessoa:

1. Painel do Supabase → **Authentication → Users → Add user** (e-mail + senha).
2. Ela abre o app, faz login — o Espaço `Pessoal` dela é criado sozinho.
3. Você cria o Espaço `Casa` (aba Perfil → Meus Espaços → Criar Espaço) e
   compartilha o código de convite (+ senha, se tiver definido uma) com ela.
4. Ela entra pelo mesmo menu → "Entrar com código".

### 4. Ligar o chat de IA

A tela **IA** já existe no app, mas a função que fala com o Groq roda no
Supabase e eu não consigo publicá-la por você (exige login interativo).
São ~3 minutos, uma vez só — passo a passo em
[`supabase/functions/ai-chat/README.md`](supabase/functions/ai-chat/README.md).
Até lá, a aba mostra um aviso claro em vez de travar.

## Banco de dados

```bash
npm run db:migrate   # aplica supabase/migrations/*.sql que faltam
npm run db:test       # 20 verificações de RLS/regras de negócio, com rollback
```

Todas as tabelas têm RLS. O modelo de dados e o porquê de cada regra estão
documentados no topo de cada arquivo em `supabase/migrations/`.

## Limitações conhecidas da v1.0 recém-construída

Testável hoje, mas com pontos que valem uma segunda passada:

- **Sem tela de trocar senha** no app — hoje só pelo painel do Supabase.
- **Offline** cobre criar lançamento simples; parcelamento exige internet, e
  editar/excluir ainda não tem fila offline.
- **Categorias "recentes"** no lançamento rápido ainda não existem — a ordem
  é a padrão (`sort_order`), não a de uso.
- Chat de IA precisa do deploy manual da Edge Function (acima).

## Status

✅ v1.0 construída e verificada (`tsc --noEmit` limpo, bundle Android exporta
sem erros, `expo-doctor` 21/21, 20/20 testes de RLS). Pronta para uso real —
ajustamos o que aparecer no uso do dia a dia.

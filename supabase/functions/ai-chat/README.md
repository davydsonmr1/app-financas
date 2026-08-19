# Deploy da ai-chat

Eu não consigo fazer isto por você — deploy de Edge Function exige login
interativo (`supabase login` abre o navegador) ou um Personal Access Token,
e eu só tenho a senha do banco e as chaves da API, que não dão esse acesso.
São ~3 minutos, uma vez só.

## 1. Instalar a CLI (se ainda não tiver)

```bash
npm install -g supabase
```

## 2. Login e link com o projeto

```bash
supabase login
supabase link --project-ref okkikgzyzhgnaitknrwp
```

## 3. Configurar o segredo do Groq (nunca vai para o app)

```bash
supabase secrets set GROQ_API_KEY=sua_chave_groq_aqui
```

## 4. Deploy

```bash
supabase functions deploy ai-chat
```

Pronto — a partir daí a aba IA do app já responde. Se trocar a chave do Groq
depois (recomendado, já que ela passou por esta conversa), repita só o passo 3.

## Testar direto (opcional)

```bash
curl -i --location --request POST \
  'https://okkikgzyzhgnaitknrwp.supabase.co/functions/v1/ai-chat' \
  --header 'Authorization: Bearer SEU_JWT_DE_USUARIO_LOGADO' \
  --header 'Content-Type: application/json' \
  --data '{"space_id":"...", "message":"quanto gastei esse mês?"}'
```

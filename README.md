# app-financas

App mobile pessoal de controle financeiro para um grupo pequeno e fechado (3 pessoas).

O objetivo central: **descobrir para onde o dinheiro está indo** e tornar o registro de
gastos rápido o bastante para não ser abandonado na primeira semana.

## Stack

| Camada | Tecnologia |
|---|---|
| App | React Native + Expo (Android) |
| Backend / DB / Auth | Supabase (Postgres + RLS + Edge Functions) |
| IA | Groq (via Edge Function, nunca direto do app) |
| Integração bancária | Nenhuma — lançamento manual |

## Conceito principal: Espaços

Um **Espaço** é um contexto financeiro compartilhado. Cada usuário pode participar de
vários. Exemplos:

- `Casa` — eu + esposa, vemos os gastos um do outro e lançamos gastos da casa
- `Pessoal` — só meu, ninguém mais vê
- `Viagem` — eu + amiga, temporário

O que é lançado dentro de um Espaço só existe dentro dele.

## Status

🚧 Definição de escopo — v1.0 ainda não iniciada.

Escopo detalhado em [`docs/ESCOPO.md`](docs/ESCOPO.md).

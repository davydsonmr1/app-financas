# Escopo — app-financas v1.0

> **Status: RASCUNHO EM REFINAMENTO.** Decisões abertas marcadas com ❓.

---

## 1. O problema real

> "Estou gastando demais e não sei pra onde vai."

Isso não é um problema de gráfico. É um problema de **registro**. Um app de finanças pessoais morre de dois jeitos:

1. **Atrito** — lançar um gasto demora 30 segundos, você para de lançar no dia 4.
2. **Cegueira parcial** — você só vê o que digitou hoje, mas o dinheiro some em assinaturas recorrentes e em parcelas de compras que você já esqueceu que fez.

O v1.0 tem que atacar os dois. Se o app só tiver "cadastrar gasto + gráfico de pizza", ele vai mostrar um gráfico bonito de 40% dos seus gastos reais — e você continua sem saber pra onde vai o dinheiro.

### Critério de sucesso

- Lançar um gasto em **≤ 3 toques** e **menos de 8 segundos**.
- No fim do mês 1, o app explica **≥ 90%** da diferença entre o que entrou e o que saiu.
- Os 3 usuários ainda estão lançando gastos depois de 30 dias.

---

## 2. Usuários

3 pessoas, convidadas manualmente. **Sem cadastro público.**
Eu (owner), esposa, amiga.

---

## 3. Conceito central: Espaços

Um **Espaço** é um contexto financeiro isolado. Um usuário participa de vários.

| Espaço | Membros | O que acontece |
|---|---|---|
| Pessoal | só eu | ninguém mais vê |
| Casa | eu + esposa | vemos os gastos um do outro + gastos "da casa" |
| Viagem | eu + amiga | temporário, gastos do rolê |

**Regras:**

- Todo lançamento pertence a **exatamente um** Espaço e a **um autor** (quem gastou).
- Membro do Espaço vê **tudo** que está nele. Não-membro não vê **nada**.
- Todo usuário nasce com um Espaço `Pessoal` criado automaticamente.
- Trocar de Espaço é um dropdown no topo, sempre visível. O Espaço ativo filtra o app inteiro (dashboard, lançamentos, IA).
- Entrar num Espaço existente = **código de convite + senha do Espaço**.

### ⚠️ Sobre a senha do Espaço — importante

A senha **não** é o que protege os dados. Quem protege é o **RLS do Postgres**: o banco simplesmente não devolve linhas de um Espaço do qual você não é membro.

A senha serve para o **ato de ingressar** e, opcionalmente, para uma **trava local** ao abrir um Espaço sensível no celular.

Isso não é criptografia. Se a intenção fosse que nem você-com-acesso-ao-Supabase conseguisse ler, aí seria criptografia ponta-a-ponta — outro projeto, não cabe no v1.0. ❓ *Confirmar que está OK.*

---

## 4. Escopo v1.0 — o que entra

### 4.1 Autenticação e perfil

- Login com e-mail + senha (Supabase Auth).
- Cadastro fechado: só por convite.
- Perfil: nome, foto, tema (claro/escuro).

### 4.2 Renda / Salário

- Cadastrar e editar renda, **com histórico** (`vigente a partir de`).
  → Editar o salário de hoje **não pode** reescrever os meses passados.
- Suporta mais de uma fonte (salário, freela, extra).
- Por Espaço: toggle **"compartilhar minha renda neste Espaço"**.
  (Você pode querer dividir gastos com a amiga sem contar seu salário pra ela.)

### 4.3 Lançamentos

Uma única entidade `transaction` com três tipos: **despesa**, **receita**, **investimento**.

Campos: valor, categoria, data, descrição, forma de pagamento (dinheiro / pix / débito / crédito / boleto), Espaço, autor.

**Fluxo rápido — o mais importante do app:**

- Botão `+` flutuante em todas as telas.
- Teclado numérico abre já focado no valor.
- Categorias recentes/favoritas como atalho na primeira linha.
- Data pré-preenchida com "hoje".
- Salvar → volta pro dashboard. **3 toques.**

### 4.4 Categorias

- Conjunto padrão pronto (Mercado, Transporte, Alimentação fora, Moradia, Saúde, Lazer, Assinaturas, Educação, Pets, Vestuário, Outros).
- Criar / editar / arquivar categorias próprias por Espaço (ícone + cor).
- Categorias de investimento separadas (Renda Fixa, Ações, FIIs, Cripto, Reserva de emergência).
- Arquivar em vez de deletar — não quebra o histórico.

### 4.5 Gastos fixos / recorrentes 🔑

Aluguel, Netflix, academia, internet, seguro.

- Cadastra uma vez com dia do mês → o app gera o lançamento automaticamente.
- Tela **"Meus fixos"**: soma total dos recorrentes e **quanto % da sua renda já está comprometido antes de você gastar qualquer coisa**.

> Essa tela sozinha costuma responder metade do "pra onde vai meu dinheiro".

### 4.6 Parcelamento no cartão 🔑

Realidade brasileira: "comprei em 10x de R$ 89".

- Ao lançar, marcar `parcelado` → número de parcelas.
- O app cria as N parcelas nos meses futuros, ligadas por um `installment_group_id`.
- Dashboard mostra **"já comprometido nos próximos meses"**.

> Sem isso, o mês parece tranquilo e o dinheiro some. Considero **obrigatório** no v1.0.

### 4.7 Gastos compartilhados (o "gasto da casa")

- Marcar um lançamento como **compartilhado**.
- Divisão: 50/50, por percentual, ou valor manual.
- Card **"acerto de contas"**: quanto A deve a B no período. ❓ *Entra no v1.0?*

### 4.8 Orçamento por categoria

- Definir teto mensal por categoria (ex.: Lazer = R$ 400).
- Barra de progresso; muda de cor em 80% e em 100%.
- Escopo: pessoal ou do Espaço.

### 4.9 Dashboard (aba Início)

- Seletor de período: **Dia | Semana | Mês**, com navegação `<` `>`.
- Toggle: **Meus gastos | Todos do Espaço**.
- Cards do topo: Entrou · Saiu · Investido · **Sobra** (com % da renda).
- **Gráfico de pizza** de despesas por categoria; tocar na fatia → lista daquela categoria.
- Top 5 categorias com variação vs. período anterior (↑ ↓).
- Orçamentos estourando.
- **Comprometido no futuro** (parcelas + fixos).

### 4.10 Aba Lançamentos

Lista cronológica, busca por texto, filtros (categoria / tipo / autor / forma de pagamento / período). Editar e excluir (soft delete).

### 4.11 Aba IA (Groq)

Chat em linguagem natural sobre os dados do **Espaço ativo**.

Perguntas alvo:

- "Quanto gastei com comida esse mês?"
- "Onde eu gastei mais que no mês passado?"
- "Consigo economizar R$ 500 esse mês?"
- "Quais assinaturas eu tenho?"

**Arquitetura (não negociável):**

```
App  →  Supabase Edge Function  →  Groq
              ↑
        a chave da API mora AQUI
```

A chave do Groq **nunca** vai no app — bundle de React Native é lido em 2 minutos.

A Edge Function não manda o banco inteiro pro modelo. Ela roda queries agregadas (totais por categoria, top gastos, renda, fixos, orçamentos do período) e injeta esse resumo compacto no prompt. Barato, rápido, e não vaza linha por linha.

Modelo sugerido: `llama-3.3-70b-versatile` — bom em português, barato, rápido.

❓ *A IA também deve **lançar** gastos por texto? ("gastei 50 no mercado")*

### 4.12 Notificação diária

Lembrete local ("já lançou os gastos de hoje?") em horário configurável.
Barato de implementar e é o que mantém o hábito vivo.

---

## 5. Fora do escopo v1.0

| Item | Por quê |
|---|---|
| Integração bancária / Open Finance | decidido |
| iOS | decidido |
| OCR de nota fiscal / foto de cupom | complexo, retorno baixo no início |
| Rentabilidade automática de investimentos | exige cotação de mercado |
| Múltiplas moedas | não precisa |
| Metas de economia ("juntar R$ 5.000") | v1.1 |
| Fatura fechada de cartão (ciclo corte/vencimento) | v1.1 — parcelas resolvem 80% |
| Web / desktop | não precisa |
| Criptografia ponta-a-ponta | outro projeto |

---

## 6. Modelo de dados (rascunho)

```
profiles            id(→auth.users), display_name, avatar_url, theme

incomes             id, user_id, label, amount, kind,
                    effective_from, effective_to

spaces              id, name, icon, color, owner_id, password_hash,
                    is_personal, invite_code

space_members       space_id, user_id, role, share_income, joined_at

categories          id, space_id(null=padrão), name, icon, color,
                    kind, archived_at

transactions        id, space_id, user_id, category_id, kind, amount,
                    description, occurred_at, payment_method, is_shared,
                    installment_group_id, installment_no, installment_total,
                    recurrence_id, created_at, deleted_at

transaction_splits  transaction_id, user_id, share_amount

recurrences         id, space_id, user_id, category_id, amount, description,
                    payment_method, day_of_month, start_date, end_date, active

budgets             id, space_id, category_id, scope, user_id, amount, period

ai_messages         id, space_id, user_id, role, content, created_at
```

**Regras técnicas:**

- Valores em `numeric(12,2)`. **Nunca `float`** — `0.1 + 0.2 ≠ 0.3` e a soma do mês sai errada.
- Soft delete (`deleted_at`) em transações.
- RLS ligado em **todas** as tabelas, sem exceção. Política base: *"você só enxerga linhas de Espaços onde existe um `space_members` com o seu `user_id`"*.

---

## 7. Navegação

```
┌─────────────────────────────────┐
│  [ Casa  ▾ ]              👤    │  ← seletor de Espaço, sempre visível
├─────────────────────────────────┤
│                                 │
│           conteúdo              │
│                                 │
│                      ( + )      │  ← FAB: novo lançamento
├─────────────────────────────────┤
│  Início  Lançam.   IA   Perfil  │
└─────────────────────────────────┘
```

**Aba Perfil** concentra: dados pessoais, **renda/salário**, meus Espaços (criar / entrar / sair), categorias, orçamentos, gastos fixos, notificações, exportar CSV, sair.

---

## 8. Fases de entrega

| Fase | Entrega | Resultado |
|---|---|---|
| 0 | Setup Expo + Supabase + Auth + navegação | login funcionando |
| 1 | Espaços + membros + RLS | isolamento de dados garantido |
| 2 | Categorias + lançamento rápido + lista | **já dá pra usar de verdade** |
| 3 | Renda + Dashboard + pizza | as respostas aparecem |
| 4 | Recorrentes + parcelamento | fecha o buraco do "pra onde vai" |
| 5 | Orçamentos + compartilhado / divisão | controle |
| 6 | Chat IA (Edge Function + Groq) | camada de conversa |
| 7 | Notificações + export CSV + polimento | build final |

> A partir da **Fase 2** o app já deve estar instalado no seu celular e em uso real.
> Dados reais desde cedo revelam o que o escopo errou.

---

## 9. Decisões em aberto ❓

1. Senha do Espaço: só para **ingressar**, ou **trava toda vez** que abre o Espaço?
2. Parcelamento de cartão entra no v1.0? *(recomendação: sim)*
3. Gastos compartilhados: só marcar como "da casa", ou rastrear **quem deve a quem**?
4. IA: só responde, ou também **lança gasto por texto**?
5. Offline: precisa lançar gasto sem internet? *(recomendação: sim, fila local)*

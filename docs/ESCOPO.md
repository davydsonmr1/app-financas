# Escopo — app-financas v1.0

> **Status:** escopo v1.0 fechado. Pronto para virar schema e Fase 0.

---

## 1. O problema real

> "Estou gastando demais e não sei pra onde vai."

Isso não é um problema de gráfico. É um problema de **registro**. Um app de finanças pessoais morre de dois jeitos:

1. **Atrito** — lançar um gasto demora 30 segundos, você para de lançar no dia 4.
2. **Cegueira parcial** — você só vê o que digitou hoje, mas o dinheiro some em assinaturas recorrentes e em parcelas de compras que você já esqueceu que fez.

O v1.0 ataca os dois. Se o app só tiver "cadastrar gasto + gráfico de pizza", ele vai mostrar um gráfico bonito de 40% dos seus gastos reais — e você continua sem saber pra onde vai o dinheiro.

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
| Casa | eu + esposa | caixa único: rendas somam, gastos num bolo só |
| Viagem | eu + amiga | temporário, gastos do rolê |

**Regras:**

- Todo lançamento pertence a **exatamente um** Espaço.
- Membro do Espaço vê **tudo** que está nele. Não-membro não vê **nada**.
- Todo usuário nasce com um Espaço `Pessoal` criado automaticamente.
- Trocar de Espaço é um dropdown no topo, sempre visível. O Espaço ativo filtra o app inteiro (dashboard, lançamentos, IA).

### Senha do Espaço — ✅ decidido

**Só para ingressar.** Entrar num Espaço existente exige **código de convite + senha do Espaço**. Depois disso ele fica na sua lista e a troca é livre, sem pedir senha de novo.

⚠️ A senha **não** é o que protege os dados. Quem protege é o **RLS do Postgres**: o banco não devolve linhas de um Espaço do qual você não é membro. A senha protege o *ato de entrar*.

Isso não é criptografia — quem tem acesso ao painel do Supabase lê tudo. Aceito para o v1.0 (é o dono do app).

---

## 4. Escopo v1.0

### 4.1 Autenticação e perfil

- Login com e-mail + senha (Supabase Auth).
- Cadastro fechado: só por convite.
- Perfil: nome, foto, tema (claro/escuro).

### 4.2 Renda / Salário

- Cadastrar e editar renda, **com histórico** (`vigente a partir de`).
  → Editar o salário de hoje **não pode** reescrever os meses passados.
- Suporta mais de uma fonte (salário, freela, extra).
- **Num Espaço compartilhado, as rendas dos membros somam** e formam a renda do Espaço.
  Controlado por um toggle por membro: *"somar minha renda neste Espaço"* (padrão: ligado).
  → No Espaço da Casa fica ligado. No Espaço da viagem com a amiga, desligado.

### 4.3 Lançamentos

Uma única entidade `transaction` com três tipos: **despesa**, **receita**, **investimento**.

Campos: valor, **atribuição**, categoria, data, descrição, forma de pagamento (dinheiro / pix / débito / crédito / boleto), Espaço, autor do registro.

**Fluxo rápido — o mais importante do app:**

```
[ valor ]  →  [ Eu | Esposa | Casa ]  →  [ categoria ]  →  salvar
              (já vem pré-selecionado         (recentes
               no último usado)                em atalho)
```

- Botão `+` flutuante em todas as telas.
- Teclado numérico abre já focado no valor.
- Data pré-preenchida com "hoje".
- Em Espaço de 1 pessoa o seletor de atribuição **não aparece**.
- Salvar → volta pro dashboard. **3 toques.**

### 4.4 Caixa único e atribuição 🔑

O modelo do Espaço compartilhado **não rastreia dívida entre pessoas**. É um caixa comum:

- As rendas dos membros **somam** numa renda única do Espaço.
- Os gastos entram num **bolo único**.
- Cada lançamento carrega uma **atribuição**, escolhida antes da categoria real:

| Atribuição | Significado |
|---|---|
| `Eu` | gasto pessoal meu |
| `Esposa` | gasto pessoal dela |
| `Casa` | gasto comum (mercado, aluguel, luz) |

As opções são geradas automaticamente: **um item por membro do Espaço + "Casa"**.
Se um terceiro membro entrar, ele vira opção sozinho.

**Autor ≠ atribuição.** Quem *registrou* o lançamento (`user_id`) é separado de a quem ele *pertence* (`attributed_to`). Eu posso lançar um gasto dela; ela pode lançar um gasto da casa.

> Isso dá duas leituras no dashboard: **por categoria** (no que foi gasto) e **por atribuição** (de qual bolso saiu) — e o cruzamento das duas.

*Não entra no v1.0:* cálculo de "quem deve a quem". Se um dia fizer falta, dá pra derivar depois a partir de `user_id` + `attributed_to` sem migrar dado.

### 4.5 Categorias

- Conjunto padrão pronto (Mercado, Transporte, Alimentação fora, Moradia, Saúde, Lazer, Assinaturas, Educação, Pets, Vestuário, Outros).
- Criar / editar / arquivar categorias próprias por Espaço (ícone + cor).
- Categorias de investimento separadas (Renda Fixa, Ações, FIIs, Cripto, Reserva de emergência).
- Arquivar em vez de deletar — não quebra o histórico.

### 4.6 Gastos fixos / recorrentes 🔑

Aluguel, Netflix, academia, internet, seguro.

- Cadastra uma vez com dia do mês → o app gera o lançamento automaticamente (com atribuição fixa).
- Tela **"Meus fixos"**: soma total dos recorrentes e **quanto % da renda já está comprometido antes de gastar qualquer coisa**.

> Essa tela sozinha costuma responder metade do "pra onde vai meu dinheiro".

### 4.7 Parcelamento no cartão 🔑

Realidade brasileira: "comprei em 10x de R$ 89".

- Ao lançar, marcar `parcelado` → número de parcelas.
- O app cria as N parcelas nos meses futuros, ligadas por um `installment_group_id`.
- Dashboard mostra **"já comprometido nos próximos meses"**.

> Sem isso, o mês parece tranquilo e o dinheiro some.

### 4.8 Investimentos — só aportes ✅

Investimento é um `kind` de lançamento, com categorias próprias (Renda Fixa, Ações, FIIs, Cripto, Reserva de emergência).

- Registra **quanto foi aportado**, quando, em qual categoria e por quem.
- Dashboard: total investido no período, evolução mês a mês, % da renda.
- **Não** rastreia saldo atual nem rentabilidade — isso exigiria atualização manual constante ou cotação de mercado. Fica para a v1.1.

> A pergunta que o v1.0 responde é *"estou conseguindo guardar alguma coisa?"*, não *"quanto rendeu?"*.

### 4.9 Orçamento por categoria

- Definir teto mensal por categoria (ex.: Lazer = R$ 400).
- Barra de progresso; muda de cor em 80% e em 100%.
- Escopo: por atribuição (`Eu`, `Esposa`, `Casa`) ou do Espaço inteiro.

### 4.10 Dashboard (aba Início)

- Seletor de período: **Dia | Semana | Mês**, com navegação `<` `>`.
- Filtro por atribuição: **Tudo | Eu | Esposa | Casa**.
- Cards do topo: Entrou (renda somada) · Saiu · Investido · **Sobra** (com % da renda).
- **Pizza por categoria** — tocar na fatia abre a lista daquela categoria.
- **Pizza por atribuição** — quanto foi meu, dela, da casa.
- Top 5 categorias com variação vs. período anterior (↑ ↓).
- Orçamentos estourando.
- **Comprometido no futuro** (parcelas + fixos).

#### Regra de período — nenhuma janela atravessa o mês 🔑

Todo período do dashboard fica **contido dentro de um único mês do calendário**.
Nunca existe uma janela tipo `25/ago → 25/set`.

| Período | Definição |
|---|---|
| **Dia** | um dia |
| **Semana** | semana do calendário **recortada nas bordas do mês** |
| **Mês** | dia 1 até o último dia |

**Consequência: semanas de borda são parciais.** Exemplo real, agosto/2026 (começa num sábado, semana iniciando no domingo):

```
Sem 1   01/ago            →  1 dia   ⚠️ parcial
Sem 2   02/ago – 08/ago   →  7 dias
Sem 3   09/ago – 15/ago   →  7 dias
Sem 4   16/ago – 22/ago   →  7 dias
Sem 5   23/ago – 29/ago   →  7 dias
Sem 6   30/ago – 31/ago   →  2 dias  ⚠️ parcial
```

Isso cria uma armadilha de leitura: gastar R$ 200 numa semana de 2 dias **não** é melhor que R$ 500 numa de 7. Como o app trata:

- Semana parcial exibe o rótulo **`parcial · N dias`**.
- Em qualquer **comparação** entre janelas de tamanhos diferentes, o app usa **média diária**, não total bruto.
- A navegação `<` `>` **para na borda do mês**. Para sair do mês, você troca o mês — é um gesto separado e explícito.

**Ciclo:** o "mês" é sempre o **mês do calendário**. Ciclo customizado por data de pagamento fica para a v1.1, se incomodar no uso real.

### 4.11 Comparação entre meses 🔑

Tela própria, alcançável pelo dashboard. Responde: **"estou gastando mais que antes?"**

Você escolhe um **mês de referência** (ex.: 2 meses atrás) e ele é comparado com o mês atual, **alinhado por dia do mês**.

#### Gasto acumulado (visão principal)

```
R$
     │                              ⋯⋯ jun (fechou 4.180)
3k   │                        ⋯⋯⋯⋯⋯
     │                 ⋯⋯⋯⋯⋯⋯        ── ago (hoje, dia 19)
2k   │           ⋯⋯⋯⋯──────
     │      ⋯⋯───────
1k   │  ⋯───
     │──
     └────┬────┬────┬────┬────┬────┬──
          5   10   15   19   25   31
                          ▲ hoje
```

A curva acumulada é a leitura que importa. O gasto de um dia isolado é ruidoso demais — você comprou um mês inteiro de mercado numa terça e o dia parece catástrofe. O acumulado mostra a **tendência**.

- Toggle **Acumulado | Diário** — o diário existe para investigar um dia específico.
- Tocar num dia abre o comparativo lado a lado: *"dia 10 · ago R$ 340 · jun R$ 180 · **+89%**"*.
- Filtro por atribuição e por categoria — dá pra comparar só "Mercado" entre os dois meses.

#### Comparação justa ⚠️

O mês atual está incompleto. Comparar agosto-até-o-dia-19 com junho-fechado infla o passado e você conclui errado.

Por padrão o app corta os dois no **mesmo dia**: *"até o dia 19 — ago R$ 2.310 · jun R$ 1.890 · **+22%**"*. O total fechado do mês de referência aparece como linha pontilhada, marcado como **projeção/fechado**, nunca somado à comparação.

**Meses de tamanhos diferentes:** o eixo vai até o maior dos dois; a série do mês mais curto simplesmente termina. Dia 31 comparado com um mês de 30 dias não inventa valor.

#### Comparação de despesas fixas

Mesma lógica aplicada aos recorrentes — aqui é onde mora a assinatura que subiu de preço e ninguém percebeu:

| Fixo | Mês ref. | Mês atual | |
|---|---|---|---|
| Aluguel | 1.800,00 | 1.800,00 | — |
| Netflix | 39,90 | 44,90 | 🔺 +12,5% |
| Academia | — | 89,00 | 🆕 novo |
| Spotify | 21,90 | — | ❌ saiu |
| **Total** | **1.861,80** | **1.933,90** | 🔺 **+3,9%** |

Rodapé: **% da renda comprometido** em cada mês. É a leitura que mostra o cerco se fechando antes de você sentir.

### 4.12 Aba Lançamentos

Lista cronológica, busca por texto, filtros (atribuição / categoria / tipo / autor / forma de pagamento / período). Editar e excluir (soft delete).

### 4.13 Aba IA (Groq) — lê e lança ✅

Chat em linguagem natural sobre os dados do **Espaço ativo**.

**Consulta:**
- "Quanto gastei com comida esse mês?"
- "Onde eu gastei mais que no mês passado?"
- "Quais assinaturas eu tenho?"
- "Quanto a gente gastou de Casa em julho?"

**Lançamento por texto** (menor atrito que existe):
- "gastei 50 no mercado" → propõe `R$ 50 · Casa · Mercado · hoje · pix`
- **Sempre mostra um card de confirmação antes de salvar.** A IA nunca escreve direto no banco.
- Se a atribuição não estiver clara no texto, usa a última usada e destaca o campo.

**Arquitetura (não negociável):**

```
App  →  Supabase Edge Function  →  Groq
              ↑
        a chave da API mora AQUI
```

A chave do Groq **nunca** vai no app — bundle de React Native se abre em 2 minutos.

A Edge Function não manda o banco inteiro pro modelo. Ela roda queries agregadas (totais por categoria, por atribuição, top gastos, renda, fixos, orçamentos do período) e injeta esse resumo compacto no prompt. Barato, rápido, e não vaza linha por linha.

Lançamento usa **tool calling**: o modelo devolve uma chamada estruturada `criar_lancamento(...)`, o app renderiza o card de confirmação, e só o toque do usuário grava.

Modelo sugerido: `llama-3.3-70b-versatile` — bom em português, barato, rápido.

### 4.14 Offline ✅

Lançar gasto **funciona sem internet**.

- Escrita vai primeiro pra fila local (SQLite / MMKV), UI atualiza na hora.
- Sincroniza quando a conexão volta.
- `id` gerado no cliente (uuid) → sem conflito de chave.
- Indicador visual de "pendente de sincronização".
- Leitura/dashboard: cache do último estado conhecido.

> Você vai querer lançar no mercado, no metrô, no estacionamento. Gasto não registrado na hora é gasto perdido.

### 4.15 Notificação diária

Lembrete local ("já lançou os gastos de hoje?") em horário configurável.
Barato de implementar e é o que mantém o hábito vivo.

---

## 5. Fora do escopo v1.0

| Item | Por quê |
|---|---|
| Integração bancária / Open Finance | decidido |
| iOS | decidido |
| "Quem deve a quem" | modelo é caixa único; derivável depois |
| OCR de nota fiscal / foto de cupom | complexo, retorno baixo no início |
| Saldo atual e rentabilidade de investimentos | v1.1 — v1.0 registra só aportes |
| Múltiplas moedas | não precisa |
| Metas de economia ("juntar R$ 5.000") | v1.1 |
| Ciclo mensal customizado (dia do pagamento) | v1.1 — calendário resolve por ora |
| Fatura fechada de cartão (ciclo corte/vencimento) | v1.1 — parcelas resolvem 80% |
| Web / desktop | não precisa |
| Criptografia ponta-a-ponta | outro projeto |

---

## 6. Modelo de dados

```
profiles            id(→auth.users), display_name, avatar_url, theme

incomes             id, user_id, label, amount, kind,
                    effective_from, effective_to

spaces              id, name, icon, color, owner_id, password_hash,
                    is_personal, invite_code

space_members       space_id, user_id, role, share_income, joined_at

categories          id, space_id(null=padrão), name, icon, color,
                    kind, archived_at

transactions        id, space_id,
                    user_id,          -- quem REGISTROU
                    attributed_to,    -- a quem PERTENCE (null = Casa)
                    category_id, kind, amount, description, occurred_at,
                    payment_method, installment_group_id, installment_no,
                    installment_total, recurrence_id,
                    created_at, updated_at, deleted_at, synced_at

recurrences         id, space_id, attributed_to, category_id, amount,
                    description, payment_method, day_of_month,
                    start_date, end_date, active

budgets             id, space_id, category_id, scope, attributed_to,
                    amount, period

ai_messages         id, space_id, user_id, role, content, created_at
```

**Regras técnicas:**

- `attributed_to` **NULL = Casa** (gasto comum do Espaço). Não-nulo = gasto pessoal daquele membro.
- Valores em `numeric(12,2)`. **Nunca `float`** — `0.1 + 0.2 ≠ 0.3` e a soma do mês sai errada.
- `id` das transações gerado no **cliente** (uuid v4) para o offline funcionar sem conflito.
- Soft delete (`deleted_at`) em transações.
- RLS ligado em **todas** as tabelas, sem exceção. Política base: *"você só enxerga linhas de Espaços onde existe um `space_members` com o seu `user_id`"*.
- Índice em `transactions (space_id, occurred_at)` — toda query do dashboard e da comparação filtra por essa dupla.
- Períodos são calculados **sempre no fuso do dispositivo** (`America/Sao_Paulo`), nunca em UTC. Se calcular em UTC, um gasto lançado às 21h do dia 31 cai no mês seguinte e a regra de "não atravessar o mês" quebra silenciosamente.
- `occurred_at` é `date`, não `timestamp`. O que importa é o dia do gasto, não a hora — e isso elimina a classe inteira de bug de fuso.

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

**Aba Perfil** concentra: dados pessoais, **renda/salário**, meus Espaços (criar / entrar / sair / convidar), categorias, orçamentos, gastos fixos, notificações, exportar CSV, sair.

---

## 8. Fases de entrega

| Fase | Entrega | Resultado |
|---|---|---|
| 0 | Setup Expo + Supabase + Auth + navegação | login funcionando |
| 1 | Espaços + membros + convite/senha + RLS | isolamento de dados garantido |
| 2 | Categorias + atribuição + lançamento rápido + lista | **já dá pra usar de verdade** |
| 3 | Renda somada + Dashboard + as duas pizzas + regra de período | as respostas aparecem |
| 4 | Recorrentes + parcelamento | fecha o buraco do "pra onde vai" |
| 5 | Comparação entre meses (acumulado + fixas) | *"estou gastando mais que antes?"* |
| 6 | Offline / fila de sincronização | o hábito sobrevive ao mundo real |
| 7 | Orçamentos por categoria | controle |
| 8 | Chat IA (Edge Function + Groq, ler e lançar) | camada de conversa |
| 9 | Notificações + export CSV + polimento + build | v1.0 |

> A Fase 5 depende da 4: comparar despesas fixas exige que os recorrentes já existam.

> A partir da **Fase 2** o app já deve estar instalado no seu celular e em uso real.
> Dados reais desde cedo revelam o que o escopo errou.

---

## 9. Decisões fechadas

| # | Decisão |
|---|---|
| 1 | Senha do Espaço: **só para ingressar** (convite + senha), não trava a cada abertura |
| 2 | Parcelamento de cartão: **entra no v1.0** |
| 3 | Compartilhado: **caixa único com atribuição** (Eu / Esposa / Casa), sem "quem deve a quem" |
| 4 | Renda: **soma entre membros** do Espaço, com toggle por membro |
| 5 | IA: **lê e lança** gastos por texto, sempre com confirmação |
| 6 | Offline: **sim**, fila local com sincronização |
| 7 | Investimentos: **só aportes**, sem saldo atual nem rentabilidade |
| 8 | Ciclo: **mês do calendário** (dia 1 ao último dia) |
| 9 | Períodos **nunca atravessam o mês** — semana de borda é recortada e marcada como parcial |
| 10 | Comparação entre meses **alinhada por dia**, cortada no mesmo dia, com curva acumulada |

---

## 10. Operacional

**Custo: ~R$ 0.** Supabase free tier aguenta 3 usuários com folga; Groq tem free tier generoso. Nada a pagar nesse porte.

**Distribuição:** EAS Build gerando **APK**, instalado direto nos 3 celulares. Sem Play Store — não faz sentido para app fechado e evita semanas de burocracia.

**Locale:** pt-BR, moeda R$, datas `dd/mm`, semana começando no domingo.

**Segredos:** chave do Groq só na Edge Function (Supabase secrets). No app, apenas a `anon key` do Supabase — que é pública por design e só é segura porque o RLS está correto. Por isso o RLS não é opcional em nenhuma tabela.

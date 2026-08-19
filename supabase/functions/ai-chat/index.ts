// ============================================================================
// ai-chat — Edge Function (Deno)
//
// Ponte entre o app e o Groq. A chave do Groq mora SÓ AQUI (Supabase secret),
// nunca no bundle do app. Ver docs/ESCOPO.md §4.12.
//
// O que faz:
//  1. Autentica o usuário a partir do JWT que o app já manda (Authorization).
//  2. Confere que ele é membro do space_id pedido — usando um client Supabase
//     com a ANON key + o JWT do usuário, ou seja, tudo passa pelo RLS normal.
//     NUNCA usa a service_role para ler dados do usuário.
//  3. Monta um RESUMO AGREGADO do Espaço (totais por categoria, por
//     atribuição, renda, fixos, orçamentos) — não manda o banco inteiro pro
//     modelo. Mais barato, mais rápido, não vaza linha por linha.
//  4. Chama o Groq com tool-calling: o modelo pode responder texto OU propor
//     um lançamento via `propose_transaction`. A IA NUNCA escreve no banco —
//     devolve a proposta, o app mostra um card de confirmação, e só o toque
//     do usuário grava (o insert de fato acontece no cliente, pelo caminho
//     normal de sempre, offline-queue incluso).
// ============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GROQ_MODEL = 'llama-3.3-70b-versatile';

const PROPOSE_TOOL = {
  type: 'function',
  function: {
    name: 'propose_transaction',
    description:
      'Propõe um lançamento financeiro para o usuário confirmar. NUNCA grava sozinho — só propõe.',
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['expense', 'income', 'investment'] },
        amount: { type: 'number', description: 'Valor em reais, positivo.' },
        category_name: { type: 'string', description: 'Nome da categoria mais próxima entre as existentes no Espaço.' },
        attribution: {
          type: 'string',
          description: 'Nome do membro a quem o gasto pertence, ou "Casa". Se não estiver claro, repita a última atribuição usada.',
        },
        description: { type: 'string' },
        occurred_at: { type: 'string', description: 'Data no formato yyyy-mm-dd. Padrão: hoje.' },
      },
      required: ['kind', 'amount', 'category_name'],
    },
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'não autenticado' }, 401);

    const { space_id, message, history } = await req.json();
    if (!space_id || !message) return json({ error: 'space_id e message são obrigatórios' }, 400);

    // Client com a ANON key + JWT do usuário: toda query abaixo passa pelo
    // RLS normal, exatamente como se fosse o app perguntando diretamente.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'sessão inválida' }, 401);

    const { data: membership } = await supabase
      .from('space_members')
      .select('space_id')
      .eq('space_id', space_id)
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (!membership) return json({ error: 'sem acesso a este Espaço' }, 403);

    const summary = await buildSpaceSummary(supabase, space_id);

    const groqKey = Deno.env.get('GROQ_API_KEY');
    if (!groqKey) return json({ error: 'GROQ_API_KEY não configurada no servidor' }, 500);

    const today = new Date().toISOString().slice(0, 10);
    const systemPrompt = `Você é o assistente financeiro pessoal dentro do app do usuário. Hoje é ${today}.
Responda em português do Brasil, direto e curto (o usuário está no celular).
Use APENAS os dados abaixo — não invente valores.
Se o usuário disser algo como "gastei X no Y", chame propose_transaction em vez de responder em texto.
Nunca diga que já lançou algo — quem lança é o app, depois da confirmação do usuário.

DADOS DO ESPAÇO "${summary.spaceName}" (resumo do mês corrente):
Renda do mês: R$ ${summary.income.toFixed(2)}
Total de despesas: R$ ${summary.totalExpense.toFixed(2)}
Total investido: R$ ${summary.totalInvestment.toFixed(2)}
Despesas por categoria:
${summary.byCategory.map((c) => `  - ${c.name}: R$ ${c.total.toFixed(2)}`).join('\n') || '  (nenhuma)'}
Despesas por atribuição:
${summary.byAttribution.map((a) => `  - ${a.name}: R$ ${a.total.toFixed(2)}`).join('\n') || '  (nenhuma)'}
Fixos/assinaturas ativos:
${summary.recurrences.map((r) => `  - ${r.description}: R$ ${r.amount.toFixed(2)}/mês (dia ${r.day})`).join('\n') || '  (nenhum)'}
Categorias existentes neste Espaço: ${summary.categoryNames.join(', ')}
Membros deste Espaço: ${summary.memberNames.join(', ')}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(Array.isArray(history) ? history.slice(-8) : []),
      { role: 'user', content: message },
    ];

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        tools: [PROPOSE_TOOL],
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 600,
      }),
    });

    if (!groqRes.ok) {
      const text = await groqRes.text();
      return json({ error: `Groq: ${groqRes.status} ${text.slice(0, 200)}` }, 502);
    }

    const groqData = await groqRes.json();
    const choice = groqData.choices?.[0]?.message;
    const toolCall = choice?.tool_calls?.[0];

    if (toolCall?.function?.name === 'propose_transaction') {
      let args: any = {};
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {
        // segue com args vazio; o app trata a falta de campos
      }
      return json({
        type: 'proposal',
        text: choice.content || 'Confere esse lançamento pra mim?',
        proposal: {
          kind: args.kind ?? 'expense',
          amount: args.amount ?? 0,
          category_name: args.category_name ?? '',
          attribution: args.attribution ?? null,
          description: args.description ?? '',
          occurred_at: args.occurred_at ?? today,
        },
      });
    }

    return json({ type: 'answer', text: choice?.content ?? 'Não consegui responder agora.' });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function buildSpaceSummary(supabase: ReturnType<typeof createClient>, spaceId: string) {
  const monthStart = new Date();
  monthStart.setDate(1);
  const from = monthStart.toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);

  const [{ data: space }, { data: txs }, { data: cats }, { data: recs }, { data: members }] = await Promise.all([
    supabase.from('spaces').select('name').eq('id', spaceId).single(),
    supabase.from('v_transactions').select('*').eq('space_id', spaceId).gte('occurred_at', from).lte('occurred_at', to),
    supabase.from('categories').select('id,name').eq('space_id', spaceId).is('archived_at', null),
    supabase.from('recurrences').select('description,amount,day_of_month').eq('space_id', spaceId).eq('active', true),
    supabase.from('space_members').select('user_id, profiles(display_name)').eq('space_id', spaceId),
  ]);

  const catNameById = new Map((cats ?? []).map((c: any) => [c.id, c.name]));
  const memberNameById = new Map((members ?? []).map((m: any) => [m.user_id, m.profiles?.display_name ?? 'Alguém']));

  const byCategoryMap = new Map<string, number>();
  const byAttributionMap = new Map<string, number>();
  let totalExpense = 0;
  let totalInvestment = 0;

  for (const tx of txs ?? []) {
    const amt = tx.effective_amount ?? tx.amount;
    if (tx.kind === 'expense') {
      totalExpense += amt;
      const catName = catNameById.get(tx.category_id) ?? 'Sem categoria';
      byCategoryMap.set(catName, (byCategoryMap.get(catName) ?? 0) + amt);
      const attrName = tx.attributed_to === null ? 'Casa' : (memberNameById.get(tx.attributed_to) ?? 'Alguém');
      byAttributionMap.set(attrName, (byAttributionMap.get(attrName) ?? 0) + amt);
    } else if (tx.kind === 'investment') {
      totalInvestment += amt;
    }
  }

  return {
    spaceName: space?.name ?? 'Espaço',
    income: 0, // renda por membro fica fora do resumo por padrão — evita expor salário sem necessidade
    totalExpense,
    totalInvestment,
    byCategory: [...byCategoryMap.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
    byAttribution: [...byAttributionMap.entries()].map(([name, total]) => ({ name, total })),
    recurrences: (recs ?? []).map((r: any) => ({ description: r.description, amount: r.amount, day: r.day_of_month })),
    categoryNames: (cats ?? []).map((c: any) => c.name),
    memberNames: [...memberNameById.values()],
  };
}

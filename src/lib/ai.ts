import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type AiProposal = {
  kind: 'expense' | 'income' | 'investment';
  amount: number;
  category_name: string;
  attribution: string | null;
  description: string;
  occurred_at: string;
};

export type AiResponse =
  | { type: 'answer'; text: string }
  | { type: 'proposal'; text: string; proposal: AiProposal }
  | { type: 'error'; error: string };

export async function askAi(
  spaceId: string,
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<AiResponse> {
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: { space_id: spaceId, message, history },
  });

  if (error) {
    return { type: 'error', error: await explainEdgeError(error) };
  }
  if (data?.error) {
    return { type: 'error', error: data.error };
  }
  return data as AiResponse;
}

/**
 * supabase-js só dá "Edge Function returned a non-2xx status code" por
 * padrão — inútil pra depurar. O corpo real da resposta (com a mensagem
 * que a própria função devolveu, ex: "GROQ_API_KEY não configurada") vem
 * em `error.context`, um Response bruto que precisa ser lido à parte.
 */
async function explainEdgeError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const status = error.context?.status as number | undefined;

    if (status === 404) {
      return 'A função ai-chat ainda não foi publicada no Supabase — veja supabase/functions/ai-chat/README.md.';
    }

    try {
      const body = await error.context.json();
      if (body?.error) return `${body.error}${status ? ` (HTTP ${status})` : ''}`;
    } catch {
      // corpo não era JSON — segue pro fallback abaixo
    }
    return `Erro do servidor (HTTP ${status ?? '?'}). Confira os logs em supabase.com/dashboard → Edge Functions → ai-chat → Logs.`;
  }

  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'Sem conexão com o servidor de IA.';
  }
  return msg;
}

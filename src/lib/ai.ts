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
    return { type: 'error', error: traduzErroEdge(error.message) };
  }
  if (data?.error) {
    return { type: 'error', error: data.error };
  }
  return data as AiResponse;
}

function traduzErroEdge(msg: string): string {
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'Sem conexão com o servidor de IA.';
  }
  if (msg.includes('404') || msg.includes('not found')) {
    return 'A função ai-chat ainda não foi publicada no Supabase (veja supabase/functions/ai-chat/README.md).';
  }
  return msg;
}

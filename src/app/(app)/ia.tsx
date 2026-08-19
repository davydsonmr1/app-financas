import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radius } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useSpace } from '@/lib/space-context';
import { Body, Button, Card, Chip, Label, Screen, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { askAi, type AiProposal } from '@/lib/ai';
import { getCategories } from '@/lib/queries';
import { enqueueTransaction, generateId } from '@/lib/offline-queue';
import { formatBRL } from '@/lib/dashboard-calc';
import type { Category } from '@/lib/types';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  proposal?: AiProposal;
  saved?: boolean;
};

const SUGESTOES = [
  'Quanto gastei esse mês?',
  'Quais assinaturas eu tenho?',
  'Onde gastei mais que no mês passado?',
];

export default function IaChatScreen() {
  const t = useTheme();
  const { session } = useAuth();
  const { activeSpace, members } = useSpace();
  const listRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (!activeSpace || !session) return;
    (async () => {
      const [{ data }, cats] = await Promise.all([
        supabase
          .from('ai_messages')
          .select('*')
          .eq('space_id', activeSpace.id)
          .eq('user_id', session.user.id)
          .order('created_at')
          .limit(50),
        getCategories(activeSpace.id),
      ]);
      setCategories(cats);
      if (data) {
        setMessages(data.map((m: any) => ({ id: m.id, role: m.role, content: m.content })));
      }
    })();
  }, [activeSpace, session]);

  const persist = async (role: 'user' | 'assistant', content: string) => {
    if (!activeSpace || !session) return;
    await supabase
      .from('ai_messages')
      .insert({ space_id: activeSpace.id, user_id: session.user.id, role, content });
  };

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || !activeSpace || sending) return;
    setInput('');
    const userMsg: ChatMessage = { id: `local-${Date.now()}`, role: 'user', content };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    persist('user', content);

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const res = await askAi(activeSpace.id, content, history);
    setSending(false);

    if (res.type === 'error') {
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: 'assistant', content: `⚠️ ${res.error}` }]);
      return;
    }

    const assistantMsg: ChatMessage = {
      id: `assist-${Date.now()}`,
      role: 'assistant',
      content: res.text,
      proposal: res.type === 'proposal' ? res.proposal : undefined,
    };
    setMessages((prev) => [...prev, assistantMsg]);
    persist('assistant', res.text);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const confirmProposal = async (msgId: string, proposal: AiProposal) => {
    if (!activeSpace || !session) return;

    const category = matchCategory(categories, proposal.category_name, proposal.kind);
    const attributedTo = resolveAttribution(proposal.attribution, members, session.user.id);

    const id = await generateId();
    await enqueueTransaction({
      id,
      space_id: activeSpace.id,
      user_id: session.user.id,
      attributed_to: proposal.kind === 'income' ? null : attributedTo,
      category_id: category?.id ?? null,
      kind: proposal.kind,
      amount: proposal.amount,
      description: proposal.description,
      occurred_at: proposal.occurred_at,
      payment_method: proposal.kind === 'income' ? null : 'pix',
      installment_group_id: null,
      installment_no: null,
      installment_total: null,
      recurrence_id: null,
      competencia: null,
    });

    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, saved: true } : m)));
  };

  const dismissProposal = (msgId: string) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, proposal: undefined } : m)));
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {messages.length === 0 ? (
          <View style={{ padding: spacing.lg, gap: spacing.sm }}>
            <Body style={{ color: t.textMuted }}>Pergunte sobre seus gastos ou lance algo por texto:</Body>
            <View style={{ gap: spacing.xs }}>
              {SUGESTOES.map((s) => (
                <Chip key={s} label={s} selected={false} onPress={() => handleSend(s)} />
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
            renderItem={({ item }) => (
              <View style={{ alignItems: item.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <View
                  style={{
                    maxWidth: '85%',
                    backgroundColor: item.role === 'user' ? t.primary : t.surface,
                    borderWidth: item.role === 'user' ? 0 : 1,
                    borderColor: t.border,
                    borderRadius: radius.lg,
                    padding: spacing.md,
                  }}
                >
                  <Text style={{ color: item.role === 'user' ? t.onPrimary : t.text, fontSize: 14 }}>
                    {item.content}
                  </Text>
                </View>

                {item.proposal && !item.saved ? (
                  <Card style={{ marginTop: spacing.xs, maxWidth: '90%', backgroundColor: t.surfaceAlt }}>
                    <Label>Confirmar lançamento?</Label>
                    <Text style={{ color: t.text, fontSize: 18, fontWeight: '700', marginTop: 4 }}>
                      {formatBRL(item.proposal.amount)}
                    </Text>
                    <Text style={{ color: t.textMuted, fontSize: 13, marginTop: 2 }}>
                      {item.proposal.category_name}
                      {item.proposal.attribution ? ` · ${item.proposal.attribution}` : ''}
                      {' · '}
                      {item.proposal.occurred_at.split('-').reverse().join('/')}
                    </Text>
                    {item.proposal.description ? (
                      <Text style={{ color: t.textMuted, fontSize: 13 }}>{item.proposal.description}</Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                      <Button title="Confirmar" onPress={() => confirmProposal(item.id, item.proposal!)} style={{ flex: 1 }} />
                      <Button title="Descartar" variant="ghost" onPress={() => dismissProposal(item.id)} style={{ flex: 1 }} />
                    </View>
                  </Card>
                ) : null}
                {item.saved ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <Ionicons name="checkmark-circle" size={14} color={t.positive} />
                    <Text style={{ color: t.positive, fontSize: 12 }}>Lançado</Text>
                  </View>
                ) : null}
              </View>
            )}
          />
        )}

        {sending ? (
          <Text style={{ color: t.textMuted, fontSize: 12, paddingHorizontal: spacing.lg }}>pensando…</Text>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            gap: spacing.sm,
            padding: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: t.border,
          }}
        >
          <TextField
            value={input}
            onChangeText={setInput}
            placeholder="Pergunte ou lance um gasto…"
            style={{ flex: 1 }}
            onSubmitEditing={() => handleSend()}
          />
          <Button title="Enviar" onPress={() => handleSend()} loading={sending} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function matchCategory(categories: Category[], name: string, kind: string): Category | undefined {
  const pool = categories.filter((c) => c.kind === kind);
  const needle = name.trim().toLowerCase();
  return (
    pool.find((c) => c.name.toLowerCase() === needle) ??
    pool.find((c) => c.name.toLowerCase().includes(needle) || needle.includes(c.name.toLowerCase())) ??
    pool.find((c) => c.name.toLowerCase() === 'outros')
  );
}

function resolveAttribution(
  attribution: string | null,
  members: { id: string; display_name: string }[],
  currentUserId: string,
): string | null {
  if (!attribution) return currentUserId;
  const needle = attribution.trim().toLowerCase();
  if (needle === 'casa') return null;
  if (needle === 'eu' || needle === 'mim') return currentUserId;
  const found = members.find((m) => m.display_name.toLowerCase() === needle);
  return found ? found.id : currentUserId;
}

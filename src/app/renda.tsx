import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { Body, Button, Card, Divider, Label, Screen, TextField } from '@/components/ui';
import { getIncomes, updateIncome, type Income } from '@/lib/queries';
import { formatBRL } from '@/lib/dashboard-calc';

export default function RendaScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session } = useAuth();

  const [incomes, setIncomes] = useState<Income[]>([]);
  const [label, setLabel] = useState('Salário');
  const [amountStr, setAmountStr] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!session) return;
    const list = await getIncomes(session.user.id);
    setIncomes(list);
    const current = list.find((i) => !i.effective_to);
    if (current) {
      setLabel(current.label);
      setAmountStr(String(current.amount).replace('.', ','));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [session]);

  const handleSave = async () => {
    if (!session) return;
    const normalized = amountStr.replace(/\./g, '').replace(',', '.');
    const amount = parseFloat(normalized);
    if (!Number.isFinite(amount) || amount < 0) return;
    setSaving(true);
    try {
      await updateIncome(session.user.id, label.trim() || 'Salário', amount);
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card>
          <Body style={{ fontSize: 12, color: t.textMuted }}>
            Editar aqui NÃO reescreve o passado: fecha a renda vigente hoje e abre uma nova a
            partir de hoje. Seu histórico mensal continua correto.
          </Body>
        </Card>

        <TextField label="Nome da renda" value={label} onChangeText={setLabel} placeholder="Salário" />
        <TextField
          label="Valor mensal"
          value={amountStr}
          onChangeText={setAmountStr}
          keyboardType="decimal-pad"
          placeholder="0,00"
        />
        <Button title="Salvar" onPress={handleSave} loading={saving} />

        {incomes.length > 0 ? (
          <Card>
            <Label>Histórico</Label>
            <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
              {incomes.map((inc, i) => (
                <View key={inc.id}>
                  {i > 0 ? <Divider /> : null}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      paddingVertical: spacing.xs,
                    }}
                  >
                    <View>
                      <Text style={{ color: t.text, fontSize: 14 }}>{inc.label}</Text>
                      <Text style={{ color: t.textMuted, fontSize: 12 }}>
                        {formatDatePt(inc.effective_from)} — {inc.effective_to ? formatDatePt(inc.effective_to) : 'hoje'}
                      </Text>
                    </View>
                    <Text style={{ color: t.text, fontWeight: '600' }}>{formatBRL(inc.amount)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function formatDatePt(iso: string): string {
  return iso.split('-').reverse().join('/');
}

import { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radius } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useSpace } from '@/lib/space-context';
import { Body, Button, Card, Label, Screen, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import {
  cancelDailyReminder,
  getReminderTime,
  scheduleDailyReminder,
} from '@/lib/notifications';

export default function PerfilScreen() {
  const t = useTheme();
  const router = useRouter();
  const { profile, session, signOut, refreshProfile } = useAuth();
  const { activeSpace, members } = useSpace();

  const [name, setName] = useState(profile?.display_name ?? '');
  const [saving, setSaving] = useState(false);
  const [reminderOn, setReminderOn] = useState(false);
  const [reminderHour, setReminderHour] = useState(20);

  useEffect(() => {
    setName(profile?.display_name ?? '');
  }, [profile]);

  useEffect(() => {
    getReminderTime().then((h) => {
      setReminderOn(h !== null);
      if (h !== null) setReminderHour(h);
    });
  }, []);

  const handleSaveName = async () => {
    if (!session || !name.trim()) return;
    setSaving(true);
    try {
      await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', session.user.id);
      await refreshProfile();
    } finally {
      setSaving(false);
    }
  };

  const toggleReminder = async (value: boolean) => {
    setReminderOn(value);
    if (value) await scheduleDailyReminder(reminderHour);
    else await cancelDailyReminder();
  };

  const myShareSetting = members.find((m) => m.id === session?.user.id);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 60 }}>
        <Card>
          <Label>Nome</Label>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
            <TextField value={name} onChangeText={setName} style={{ flex: 1 }} />
            <Button title="Salvar" onPress={handleSaveName} loading={saving} variant="secondary" />
          </View>
          <Body style={{ marginTop: spacing.sm, fontSize: 12, color: t.textMuted }}>{session?.user.email}</Body>
        </Card>

        <MenuItem icon="cash-outline" title="Renda / salário" subtitle="Editar com histórico" onPress={() => router.push('/renda')} />
        <MenuItem
          icon="layers-outline"
          title="Meus Espaços"
          subtitle={activeSpace ? `Atual: ${activeSpace.name}` : undefined}
          onPress={() => router.push('/espacos')}
        />
        <MenuItem icon="pricetags-outline" title="Categorias" subtitle="Do Espaço atual" onPress={() => router.push('/categorias')} />
        <MenuItem icon="repeat-outline" title="Fixos e assinaturas" onPress={() => router.push('/recorrentes')} />
        <MenuItem icon="pie-chart-outline" title="Orçamentos por categoria" onPress={() => router.push('/orcamentos')} />

        {members.length > 1 && myShareSetting ? (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: '600' }}>Somar minha renda neste Espaço</Text>
                <Body style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                  Desligue se não quiser que os outros membros vejam nem somem seu salário aqui.
                </Body>
              </View>
              <Switch
                value={myShareSetting.share_income}
                onValueChange={async (v) => {
                  if (!activeSpace || !session) return;
                  await supabase
                    .from('space_members')
                    .update({ share_income: v })
                    .eq('space_id', activeSpace.id)
                    .eq('user_id', session.user.id);
                }}
              />
            </View>
          </Card>
        ) : null}

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: '600' }}>Lembrete diário</Text>
              <Body style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                Notificação às {String(reminderHour).padStart(2, '0')}:00 perguntando se você já lançou os gastos de hoje.
              </Body>
            </View>
            <Switch value={reminderOn} onValueChange={toggleReminder} />
          </View>
        </Card>

        <Button
          title="Sair"
          variant="danger"
          onPress={() =>
            Alert.alert('Sair da conta?', undefined, [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Sair', style: 'destructive', onPress: signOut },
            ])
          }
        />
      </ScrollView>
    </Screen>
  );
}

function MenuItem({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <View
      onTouchEnd={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.border,
        borderRadius: radius.md,
        padding: spacing.md,
      }}
    >
      <Ionicons name={icon} size={20} color={t.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontWeight: '600', fontSize: 14 }}>{title}</Text>
        {subtitle ? <Text style={{ color: t.textMuted, fontSize: 12 }}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
    </View>
  );
}

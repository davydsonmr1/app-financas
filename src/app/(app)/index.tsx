import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radius } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useSpace } from '@/lib/space-context';
import { Body, Card, Heading, Label, Screen } from '@/components/ui';
import { getTransactions } from '@/lib/queries';
import { todayISO } from '@/lib/period';

export default function InicioScreen() {
  const t = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const { activeSpace, spaces } = useSpace();
  const [lancouHoje, setLancouHoje] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!activeSpace) return;
      const today = todayISO();
      getTransactions({ spaceId: activeSpace.id, from: today, to: today })
        .then((txs) => setLancouHoje(txs.length > 0))
        .catch(() => setLancouHoje(null));
    }, [activeSpace]),
  );

  const saudacao = useSaudacao();
  const primeiroNome = (profile?.display_name || '').split(' ')[0] || 'você';

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 60 }}>
        <View>
          <Heading style={{ fontSize: 24 }}>{saudacao}, {primeiroNome}</Heading>
          <Body style={{ color: t.textMuted, marginTop: 2 }}>
            {activeSpace ? `Você está no Espaço "${activeSpace.name}"` : 'Carregando seu Espaço…'}
          </Body>
        </View>

        <Card
          style={{
            backgroundColor: lancouHoje ? t.surface : t.surfaceAlt,
            borderColor: lancouHoje ? t.border : t.warn,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons
              name={lancouHoje ? 'checkmark-circle' : 'alert-circle-outline'}
              size={22}
              color={lancouHoje ? t.positive : t.warn}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: '600', fontSize: 14 }}>
                {lancouHoje === null ? 'Verificando…' : lancouHoje ? 'Já lançou algo hoje 🎉' : 'Ainda não lançou nada hoje'}
              </Text>
              <Text style={{ color: t.textMuted, fontSize: 12, marginTop: 2 }}>
                {lancouHoje ? 'Continue assim — é isso que faz o dashboard valer a pena.' : 'Leva menos de 10 segundos. Não deixe acumular.'}
              </Text>
            </View>
          </View>
        </Card>

        <View style={{ gap: spacing.sm }}>
          <QuickAction
            icon="remove-circle"
            iconColor={t.negative}
            title="Lançar despesa"
            subtitle="Mercado, contas, compras…"
            onPress={() => router.push('/despesas')}
          />
          <QuickAction
            icon="add-circle"
            iconColor={t.positive}
            title="Lançar receita ou investimento"
            subtitle="Salário extra, freela, aporte…"
            onPress={() => router.push('/receitas')}
          />
          <QuickAction
            icon="pie-chart"
            iconColor={t.primary}
            title="Ver dashboard"
            subtitle="Resumo do período, gráficos, comparação"
            onPress={() => router.push('/dashboard')}
          />
        </View>

        <Card>
          <Label>Como o app funciona</Label>
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <InfoRow
              icon="layers-outline"
              text={`Cada Espaço é um contexto separado.${spaces.length > 1 ? ` Você está em ${spaces.length} Espaços — troque pelo topo da tela.` : ' Você pode criar outros pela aba Perfil.'}`}
            />
            <InfoRow
              icon="people-outline"
              text="Num Espaço compartilhado, os gastos ficam num caixa único, marcados como Eu, do outro membro, ou Casa."
            />
            <InfoRow
              icon="sparkles-outline"
              text='Na aba IA você pode perguntar "quanto gastei esse mês?" ou lançar direto por texto: "gastei 50 no mercado".'
            />
            <InfoRow
              icon="lock-closed-outline"
              text="Sem integração bancária — tudo é lançado manualmente, por design."
            />
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

function QuickAction({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle: string;
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
      <Ionicons name={icon} size={28} color={iconColor} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontWeight: '600', fontSize: 15 }}>{title}</Text>
        <Text style={{ color: t.textMuted, fontSize: 12 }}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
    </View>
  );
}

function InfoRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
      <Ionicons name={icon} size={16} color={t.textMuted} style={{ marginTop: 2 }} />
      <Text style={{ color: t.textMuted, fontSize: 13, flex: 1, lineHeight: 18 }}>{text}</Text>
    </View>
  );
}

function useSaudacao(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

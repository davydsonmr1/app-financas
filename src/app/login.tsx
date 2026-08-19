import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useTheme, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { Button, Screen, TextField } from '@/components/ui';

export default function LoginScreen() {
  const t = useTheme();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    setLoading(true);
    const err = await signIn(email.trim(), password);
    setLoading(false);
    if (err) setError(traduzErro(err));
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.xl }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ marginBottom: spacing.xxl, alignItems: 'center' }}>
            <Text style={{ fontSize: 40 }}>💰</Text>
            <Text style={{ color: t.text, fontSize: 26, fontWeight: '700', marginTop: spacing.sm }}>
              Finanças
            </Text>
            <Text style={{ color: t.textMuted, fontSize: 14, marginTop: 4 }}>
              Controle pessoal — acesso fechado
            </Text>
          </View>

          <View style={{ gap: spacing.md }}>
            <TextField
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="voce@exemplo.com"
            />
            <TextField
              label="Senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              placeholder="••••••••"
              onSubmitEditing={handleSubmit}
            />

            {error ? <Text style={{ color: t.negative, fontSize: 13 }}>{error}</Text> : null}

            <Button title="Entrar" onPress={handleSubmit} loading={loading} style={{ marginTop: spacing.sm }} />

            <Text style={{ color: t.textMuted, fontSize: 12, textAlign: 'center', marginTop: spacing.lg }}>
              Cadastro fechado — sua conta é criada manualmente pelo dono do app.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function traduzErro(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('Email not confirmed')) return 'E-mail ainda não confirmado.';
  return msg;
}

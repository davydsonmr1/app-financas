import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { Body, Button, Screen, TextField } from '@/components/ui';

export default function SignupScreen() {
  const t = useTheme();
  const router = useRouter();
  const { signUp } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) return setError('Como podemos te chamar?');
    if (!email.trim()) return setError('Informe seu e-mail.');
    if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.');
    if (password !== confirmPassword) return setError('As senhas não coincidem.');

    setLoading(true);
    const { error: signUpError, needsEmailConfirmation } = await signUp(
      email.trim(),
      password,
      name.trim(),
    );
    setLoading(false);

    if (signUpError) {
      setError(traduzErro(signUpError));
      return;
    }
    if (needsEmailConfirmation) {
      setConfirmationSent(true);
      return;
    }
    // Sem confirmação de e-mail exigida: a sessão já existe e o
    // RootNavigator (src/app/_layout.tsx) redireciona sozinho pro app.
  };

  if (confirmationSent) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
          <Text style={{ fontSize: 40, textAlign: 'center' }}>📬</Text>
          <Text style={{ color: t.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
            Confira seu e-mail
          </Text>
          <Body style={{ textAlign: 'center', color: t.textMuted }}>
            Mandamos um link de confirmação para {email}. Depois de confirmar, é só voltar e entrar
            normalmente.
          </Body>
          <Button title="Voltar para o login" onPress={() => router.replace('/login')} variant="secondary" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.xl }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ marginBottom: spacing.xl, alignItems: 'center' }}>
            <Text style={{ fontSize: 34 }}>💰</Text>
            <Text style={{ color: t.text, fontSize: 22, fontWeight: '700', marginTop: spacing.sm }}>
              Criar conta
            </Text>
          </View>

          <View style={{ gap: spacing.md }}>
            <TextField label="Nome" value={name} onChangeText={setName} placeholder="Como te chamam?" />
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
              placeholder="mínimo 6 caracteres"
            />
            <TextField
              label="Confirmar senha"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="repita a senha"
              onSubmitEditing={handleSubmit}
            />

            {error ? <Text style={{ color: t.negative, fontSize: 13 }}>{error}</Text> : null}

            <Button title="Criar conta" onPress={handleSubmit} loading={loading} style={{ marginTop: spacing.sm }} />
            <Button title="Já tenho conta" onPress={() => router.back()} variant="ghost" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function traduzErro(msg: string): string {
  if (msg.includes('already registered') || msg.includes('already exists')) {
    return 'Já existe uma conta com esse e-mail.';
  }
  if (msg.includes('Signups not allowed') || msg.includes('signup is disabled')) {
    return 'Cadastro ainda não está habilitado neste projeto — veja o README.';
  }
  if (msg.includes('Password should be')) return 'A senha é muito fraca — tente uma mais forte.';
  return msg;
}

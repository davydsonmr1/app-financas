import { useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing } from '@/constants/theme';
import { Button } from '@/components/ui';
import { authenticate } from '@/lib/biometric';
import { useAuth } from '@/lib/auth-context';

export function BiometricGate({ onUnlock }: { onUnlock: () => void }) {
  const t = useTheme();
  const { signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [trying, setTrying] = useState(false);

  const handleTry = async () => {
    setError(null);
    setTrying(true);
    const result = await authenticate();
    setTrying(false);
    if (result.ok) onUnlock();
    else if (result.error !== 'user_cancel') setError('Não foi possível confirmar. Tente de novo.');
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
      <Ionicons name="finger-print" size={64} color={t.primary} />
      <Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }}>Finanças bloqueado</Text>
      <Text style={{ color: t.textMuted, fontSize: 13, textAlign: 'center' }}>
        Use sua digital ou o desbloqueio do aparelho para continuar.
      </Text>
      {error ? <Text style={{ color: t.negative, fontSize: 13 }}>{error}</Text> : null}
      <Button title="Desbloquear" onPress={handleTry} loading={trying} style={{ width: '100%', marginTop: spacing.md }} />
      <Button title="Sair da conta" onPress={signOut} variant="ghost" />
    </View>
  );
}

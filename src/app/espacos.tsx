import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme, spacing, radius } from '@/constants/theme';
import { useSpace } from '@/lib/space-context';
import { Body, Button, Card, Label, Screen, TextField } from '@/components/ui';

export default function EspacosScreen() {
  const t = useTheme();
  const router = useRouter();
  const { spaces, activeSpace, setActiveSpaceId, createSpace, joinSpace } = useSpace();

  const [mode, setMode] = useState<'list' | 'create' | 'join'>('list');

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 }}>
        {mode === 'list' && (
          <>
            <View style={{ gap: spacing.sm }}>
              {spaces.map((s) => (
                <View
                  key={s.id}
                  onTouchEnd={() => {
                    setActiveSpaceId(s.id);
                    router.back();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    backgroundColor: t.surface,
                    borderWidth: 1,
                    borderColor: s.id === activeSpace?.id ? t.primary : t.border,
                    borderRadius: radius.md,
                    padding: spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: s.color,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={s.icon as any} size={18} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontWeight: '600', fontSize: 15 }}>{s.name}</Text>
                    <Text style={{ color: t.textMuted, fontSize: 12 }}>
                      {s.is_personal ? 'Pessoal' : s.role === 'owner' ? 'Você criou' : 'Membro'}
                    </Text>
                  </View>
                  {s.id === activeSpace?.id ? (
                    <Ionicons name="checkmark-circle" size={22} color={t.primary} />
                  ) : null}
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="Criar Espaço" onPress={() => setMode('create')} variant="secondary" style={{ flex: 1 }} />
              <Button title="Entrar com código" onPress={() => setMode('join')} variant="secondary" style={{ flex: 1 }} />
            </View>

            {activeSpace && !activeSpace.is_personal ? (
              <Card>
                <Label>Convidar para "{activeSpace.name}"</Label>
                <Body style={{ marginTop: 4, fontSize: 13 }}>
                  Compartilhe o código abaixo e a senha (se você definiu uma) com quem vai entrar.
                </Body>
                <View
                  style={{
                    marginTop: spacing.sm,
                    backgroundColor: t.surfaceAlt,
                    borderRadius: radius.sm,
                    padding: spacing.md,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: t.text, fontWeight: '700', fontSize: 18, letterSpacing: 2 }}>
                    {activeSpace.invite_code}
                  </Text>
                  <Ionicons
                    name="copy-outline"
                    size={20}
                    color={t.primary}
                    onPress={() => Clipboard.setStringAsync(activeSpace.invite_code)}
                  />
                </View>
              </Card>
            ) : null}
          </>
        )}

        {mode === 'create' && <CreateSpaceForm onDone={() => { setMode('list'); router.back(); }} onCancel={() => setMode('list')} createSpace={createSpace} />}
        {mode === 'join' && <JoinSpaceForm onDone={() => { setMode('list'); router.back(); }} onCancel={() => setMode('list')} joinSpace={joinSpace} />}
      </ScrollView>
    </Screen>
  );
}

function CreateSpaceForm({
  onDone,
  onCancel,
  createSpace,
}: {
  onDone: () => void;
  onCancel: () => void;
  createSpace: (name: string, password?: string) => Promise<{ error: string | null }>;
}) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Dê um nome para o Espaço.');
      return;
    }
    setLoading(true);
    const { error } = await createSpace(name.trim(), password.trim() || undefined);
    setLoading(false);
    if (error) setError(error);
    else onDone();
  };

  return (
    <View style={{ gap: spacing.md }}>
      <TextField label="Nome do Espaço" value={name} onChangeText={setName} placeholder="ex: Casa, Viagem…" />
      <TextField
        label="Senha (opcional — só para quem for entrar)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="deixe em branco para não exigir"
      />
      {error ? <Text style={{ color: '#dc2626', fontSize: 13 }}>{error}</Text> : null}
      <Button title="Criar" onPress={handleCreate} loading={loading} />
      <Button title="Cancelar" onPress={onCancel} variant="ghost" />
    </View>
  );
}

function JoinSpaceForm({
  onDone,
  onCancel,
  joinSpace,
}: {
  onDone: () => void;
  onCancel: () => void;
  joinSpace: (code: string, password?: string) => Promise<{ error: string | null }>;
}) {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!code.trim()) {
      setError('Informe o código de convite.');
      return;
    }
    setLoading(true);
    const { error } = await joinSpace(code.trim(), password.trim() || undefined);
    setLoading(false);
    if (error) setError(error);
    else onDone();
  };

  return (
    <View style={{ gap: spacing.md }}>
      <TextField label="Código de convite" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="ex: A1B2C3D4" />
      <TextField label="Senha (se o Espaço tiver)" value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <Text style={{ color: '#dc2626', fontSize: 13 }}>{error}</Text> : null}
      <Button title="Entrar" onPress={handleJoin} loading={loading} />
      <Button title="Cancelar" onPress={onCancel} variant="ghost" />
    </View>
  );
}

import { useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Share, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme, spacing, radius } from '@/constants/theme';
import { useSpace, type SpaceWithRole } from '@/lib/space-context';
import { Body, Button, Card, Screen, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { pickAndUploadImage } from '@/lib/storage';

export default function EspacosScreen() {
  const t = useTheme();
  const router = useRouter();
  const { spaces, activeSpace, setActiveSpaceId, createSpace, joinSpace, refresh } = useSpace();

  const [mode, setMode] = useState<'list' | 'create' | 'join'>('list');
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const handleChangePhoto = async (space: SpaceWithRole) => {
    setUploadingFor(space.id);
    try {
      const { url, error } = await pickAndUploadImage('space-photos', space.id);
      if (error) {
        Alert.alert('Não foi possível enviar a foto', error);
        return;
      }
      if (url) {
        await supabase.from('spaces').update({ photo_url: url }).eq('id', space.id);
        await refresh();
      }
    } finally {
      setUploadingFor(null);
    }
  };

  const handleShare = async (space: SpaceWithRole) => {
    const senha = space.has_password ? ' (peça a senha comigo)' : '';
    await Share.share({
      message: `Entra no meu Espaço "${space.name}" no app Finanças! Código de convite: ${space.invite_code}${senha}`,
    });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 }}>
        {mode === 'list' && (
          <>
            <View style={{ gap: spacing.sm }}>
              {spaces.map((s) => (
                <View
                  key={s.id}
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
                    onTouchEnd={s.role === 'owner' ? () => handleChangePhoto(s) : undefined}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: s.color,
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {uploadingFor === s.id ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : s.photo_url ? (
                      <Image source={{ uri: s.photo_url }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <Ionicons name={s.icon as any} size={19} color="#fff" />
                    )}
                    {s.role === 'owner' && !uploadingFor ? (
                      <View
                        style={{
                          position: 'absolute',
                          bottom: -1,
                          right: -1,
                          backgroundColor: t.primary,
                          borderRadius: 6,
                          width: 14,
                          height: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="camera" size={9} color="#fff" />
                      </View>
                    ) : null}
                  </View>
                  <View
                    style={{ flex: 1 }}
                    onTouchEnd={() => {
                      setActiveSpaceId(s.id);
                      router.back();
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <Text style={{ color: t.text, fontWeight: '600', fontSize: 15 }}>{s.name}</Text>
                      {s.id === activeSpace?.id ? (
                        <Ionicons name="checkmark-circle" size={16} color={t.primary} />
                      ) : null}
                    </View>
                    <Text style={{ color: t.textMuted, fontSize: 12 }}>
                      {s.is_personal ? 'Pessoal' : s.role === 'owner' ? 'Você criou' : 'Membro'}
                    </Text>
                    {!s.is_personal ? (
                      <Text style={{ color: t.textMuted, fontSize: 11, marginTop: 2, letterSpacing: 1 }}>
                        Código: {s.invite_code}
                      </Text>
                    ) : null}
                  </View>
                  {!s.is_personal ? (
                    <View style={{ flexDirection: 'row', gap: spacing.md }}>
                      <Ionicons
                        name="copy-outline"
                        size={19}
                        color={t.textMuted}
                        onPress={() => Clipboard.setStringAsync(s.invite_code)}
                      />
                      <Ionicons
                        name="share-social-outline"
                        size={19}
                        color={t.textMuted}
                        onPress={() => handleShare(s)}
                      />
                    </View>
                  ) : null}
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="Criar Espaço" onPress={() => setMode('create')} variant="secondary" style={{ flex: 1 }} />
              <Button title="Entrar com código" onPress={() => setMode('join')} variant="secondary" style={{ flex: 1 }} />
            </View>
          </>
        )}

        {mode === 'create' && (
          <CreateSpaceForm
            onDone={() => {
              setMode('list');
              router.back();
            }}
            onCancel={() => setMode('list')}
            createSpace={createSpace}
          />
        )}
        {mode === 'join' && (
          <JoinSpaceForm
            onDone={() => {
              setMode('list');
              router.back();
            }}
            onCancel={() => setMode('list')}
            joinSpace={joinSpace}
          />
        )}
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
  createSpace: (name: string, password?: string) => Promise<{ error: string | null; id: string | null }>;
}) {
  const t = useTheme();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Dê um nome para o Espaço.');
      return;
    }
    setLoading(true);
    const { error, id } = await createSpace(name.trim(), password.trim() || undefined);
    setLoading(false);
    if (error) setError(error);
    else setCreatedId(id);
  };

  const handleAddPhoto = async () => {
    if (!createdId) return;
    setUploadingPhoto(true);
    try {
      const { url, error } = await pickAndUploadImage('space-photos', createdId);
      if (error) {
        Alert.alert('Não foi possível enviar a foto', error);
        return;
      }
      if (url) await supabase.from('spaces').update({ photo_url: url }).eq('id', createdId);
      onDone();
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (createdId) {
    return (
      <View style={{ gap: spacing.md, alignItems: 'center' }}>
        <Ionicons name="checkmark-circle" size={40} color={t.positive} />
        <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>"{name}" criado!</Text>
        <Body style={{ textAlign: 'center', color: t.textMuted }}>
          Quer adicionar uma foto de capa pra esse Espaço? Pode fazer isso depois também.
        </Body>
        <Button title="Escolher foto" onPress={handleAddPhoto} loading={uploadingPhoto} style={{ width: '100%' }} />
        <Button title="Pular por agora" onPress={onDone} variant="ghost" style={{ width: '100%' }} />
      </View>
    );
  }

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

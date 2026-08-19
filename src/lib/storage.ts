import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { supabase } from './supabase';

/**
 * Abre o seletor de imagem, faz upload pro Storage e devolve a URL pública.
 * `pathPrefix` vira a pasta: `avatars/{user_id}/...` ou
 * `space-photos/{space_id}/...` — é o que as policies de storage.objects
 * usam pra decidir quem pode escrever (ver migration 004).
 */
export async function pickAndUploadImage(
  bucket: 'avatars' | 'space-photos',
  pathPrefix: string,
): Promise<{ url: string | null; error: string | null }> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { url: null, error: 'Permissão de galeria negada.' };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.[0]) return { url: null, error: null };

  const asset = result.assets[0];
  const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
  const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const path = `${pathPrefix}/${Date.now()}.${ext}`;

  try {
    const bytes = await new File(asset.uri).bytes();
    const { error: uploadErr } = await supabase.storage
      .from(bucket)
      .upload(path, bytes, { contentType, upsert: true });
    if (uploadErr) return { url: null, error: uploadErr.message };

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  } catch (e: any) {
    return { url: null, error: e.message ?? 'Falha ao enviar a imagem.' };
  }
}

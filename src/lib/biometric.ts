import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

/**
 * "Entrar com a digital" não é um método de autenticação contra o Supabase
 * — biometria no celular não prova identidade pra um servidor. É uma trava
 * LOCAL sobre uma sessão que já é válida (mesmo esquema de app de banco):
 * você já fez login uma vez (senha ou Google), a sessão fica salva, e a
 * digital só decide se o conteúdo aparece na tela agora ou não.
 */

const ENABLED_KEY = 'biometric_lock_enabled';

export async function isBiometricSupported(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

export async function isBiometricEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(ENABLED_KEY)) === 'true';
}

export async function setBiometricEnabled(value: boolean): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, value ? 'true' : 'false');
}

export async function authenticate(): Promise<{ ok: boolean; error?: string }> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Desbloquear Finanças',
    cancelLabel: 'Cancelar',
    disableDeviceFallback: false, // permite PIN/padrão do aparelho como alternativa
  });
  if (result.success) return { ok: true };
  return { ok: false, error: result.error };
}

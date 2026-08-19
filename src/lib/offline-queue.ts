import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';
import type { Transaction } from './types';

/**
 * Fila de escrita offline para lançamentos — ESCOPO §4.13.
 *
 * v1: cobre a operação de maior frequência (criar lançamento). O `id` é
 * gerado no CLIENTE (uuid v4), então reenviar o mesmo item nunca duplica —
 * é sempre um upsert por id. Não cobre ainda edição/exclusão offline nem
 * reprocessamento de conflito além de "o servidor manda" (last-write-wins
 * por updated_at, que o próprio Postgres resolve no upsert).
 *
 * Não usamos NetInfo (dependência nativa extra) — tentamos sempre que o app
 * volta ao primeiro plano e depois de cada novo lançamento. Suficiente para
 * 3 usuários; se a experiência mostrar necessidade de detecção ativa de
 * rede, entra depois.
 */

const QUEUE_KEY = 'tx_offline_queue_v1';

export type QueuedTransaction = Transaction & { _queuedAt: string };

type Listener = (queue: QueuedTransaction[]) => void;
const listeners = new Set<Listener>();

async function readQueue(): Promise<QueuedTransaction[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as QueuedTransaction[]) : [];
}

async function writeQueue(queue: QueuedTransaction[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  listeners.forEach((l) => l(queue));
}

export function subscribeQueue(listener: Listener): () => void {
  listeners.add(listener);
  readQueue().then(listener);
  return () => listeners.delete(listener);
}

export async function generateId(): Promise<string> {
  return Crypto.randomUUID();
}

/**
 * Grava otimisticamente e tenta enviar na hora. Se falhar (sem internet),
 * fica na fila local e o lançamento já aparece na UI mesmo assim — quem
 * lança no mercado sem sinal não perde o registro.
 */
export async function enqueueTransaction(
  tx: Omit<Transaction, 'deleted_at'>,
): Promise<{ synced: boolean }> {
  const queued: QueuedTransaction = { ...tx, deleted_at: null, _queuedAt: new Date().toISOString() };
  const queue = await readQueue();
  await writeQueue([...queue, queued]);
  const result = await syncQueue();
  return { synced: !result.remaining.find((q) => q.id === tx.id) };
}

export async function syncQueue(): Promise<{ synced: number; remaining: QueuedTransaction[] }> {
  const queue = await readQueue();
  if (queue.length === 0) return { synced: 0, remaining: [] };

  const remaining: QueuedTransaction[] = [];
  let synced = 0;

  for (const item of queue) {
    const { _queuedAt, ...tx } = item;
    const { error } = await supabase.from('transactions').upsert(tx, { onConflict: 'id' });
    if (error) {
      remaining.push(item);
    } else {
      synced++;
    }
  }

  await writeQueue(remaining);
  return { synced, remaining };
}

let appStateSub: { remove: () => void } | null = null;

export function startOfflineSyncWatcher() {
  if (appStateSub) return;
  appStateSub = AppState.addEventListener('change', (state) => {
    if (state === 'active') syncQueue().catch(() => {});
  });
  syncQueue().catch(() => {});
}

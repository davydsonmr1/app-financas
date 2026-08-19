import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth-context';
import type { MemberRole, Profile, Space } from './types';

export type SpaceWithRole = Space & { role: MemberRole };
export type MemberWithProfile = Profile & { role: MemberRole; share_income: boolean };

type SpaceState = {
  loading: boolean;
  spaces: SpaceWithRole[];
  activeSpace: SpaceWithRole | null;
  members: MemberWithProfile[];
  setActiveSpaceId: (id: string) => void;
  refresh: () => Promise<void>;
  createSpace: (name: string, password?: string) => Promise<{ error: string | null; id: string | null }>;
  joinSpace: (inviteCode: string, password?: string) => Promise<{ error: string | null }>;
};

const SpaceContext = createContext<SpaceState | null>(null);
const STORAGE_KEY = 'active_space_id';

export function SpaceProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [loading, setLoading] = useState(true);
  const [spaces, setSpaces] = useState<SpaceWithRole[]>([]);
  const [activeSpaceId, setActiveSpaceIdState] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);

  const setActiveSpaceId = useCallback((id: string) => {
    setActiveSpaceIdState(id);
    AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('space_members')
      .select('role, spaces(*)')
      .eq('user_id', userId);

    if (!error && data) {
      const list = data
        .filter((row: any) => row.spaces)
        .map((row: any) => ({ ...(row.spaces as Space), role: row.role as MemberRole }))
        .sort((a: SpaceWithRole, b: SpaceWithRole) => {
          if (a.is_personal !== b.is_personal) return a.is_personal ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      setSpaces(list);

      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const stillValid = list.find((s) => s.id === stored);
      if (stillValid) {
        setActiveSpaceIdState(stored!);
      } else if (list.length > 0 && !list.find((s) => s.id === activeSpaceId)) {
        setActiveSpaceId(list[0].id);
      }
    }
    setLoading(false);
  }, [userId, activeSpaceId, setActiveSpaceId]);

  useEffect(() => {
    if (userId) refresh();
    else {
      setSpaces([]);
      setActiveSpaceIdState(null);
      setMembers([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!activeSpaceId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('space_members')
        .select('role, share_income, profiles(*)')
        .eq('space_id', activeSpaceId);
      if (!cancelled && data) {
        setMembers(
          data
            .filter((row: any) => row.profiles)
            .map((row: any) => ({
              ...(row.profiles as Profile),
              role: row.role as MemberRole,
              share_income: row.share_income as boolean,
            })),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSpaceId]);

  const activeSpace = useMemo(
    () => spaces.find((s) => s.id === activeSpaceId) ?? null,
    [spaces, activeSpaceId],
  );

  const value: SpaceState = {
    loading,
    spaces,
    activeSpace,
    members,
    setActiveSpaceId,
    refresh,
    createSpace: async (name, password) => {
      const { data, error } = await supabase.rpc('create_space', {
        p_name: name,
        p_password: password || null,
      });
      if (error) return { error: error.message, id: null };
      await refresh();
      if (data) setActiveSpaceId(data as string);
      return { error: null, id: (data as string) ?? null };
    },
    joinSpace: async (inviteCode, password) => {
      const { data, error } = await supabase.rpc('join_space', {
        p_invite_code: inviteCode,
        p_password: password || null,
      });
      if (error) return { error: translateJoinError(error.message) };
      await refresh();
      if (data) setActiveSpaceId(data as string);
      return { error: null };
    },
  };

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

function translateJoinError(message: string): string {
  if (message.includes('senha incorreta')) return 'Senha incorreta.';
  if (message.includes('convite invalido')) return 'Código de convite não encontrado.';
  return message;
}

export function useSpace(): SpaceState {
  const ctx = useContext(SpaceContext);
  if (!ctx) throw new Error('useSpace precisa estar dentro de <SpaceProvider>');
  return ctx;
}

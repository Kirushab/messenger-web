import { supabase } from '@/lib/supabase';

type HmsAction = 'create-room' | 'app-token';

type HmsInvokeResponse = {
  id?: string;
  token?: string;
  error?: string | null;
};

async function invokeHms(body: Record<string, unknown> & { action: HmsAction }): Promise<HmsInvokeResponse> {
  const { data, error } = await supabase.functions.invoke<HmsInvokeResponse>('hms-token', { body });
  if (error) return { error: error.message || 'hms function error' };
  if (data?.error) return { error: data.error };
  return data || { error: 'empty hms response' };
}

export async function generateAuthToken(roomId: string, _userId: string, role = 'host') {
  const data = await invokeHms({ action: 'app-token', roomId, role });
  if (!data.token) throw new Error(data.error || 'Не удалось получить токен звонка');
  return data.token;
}

export async function createRoom(): Promise<{ id: string; error: string | null }> {
  const data = await invokeHms({ action: 'create-room' });
  return { id: data.id || '', error: data.error || null };
}

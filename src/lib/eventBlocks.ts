import { supabase } from '@/lib/supabase';

export interface BlockItem {
  id: string;
  event_id: string;
  block_kind: string;
  position: number;
  data: Record<string, any>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlockResponse {
  id: string;
  item_id: string;
  user_id: string;
  response_kind: string;
  data: Record<string, any> | null;
  created_at: string;
}

export async function fetchBlockItems(eventId: string, blockKind: string): Promise<BlockItem[]> {
  const { data, error } = await supabase
    .from('event_block_items')
    .select('*')
    .eq('event_id', eventId)
    .eq('block_kind', blockKind)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) { console.error('fetchBlockItems:', error); return []; }
  return (data || []) as BlockItem[];
}

export async function addBlockItem(eventId: string, blockKind: string, data: Record<string, any>, position?: number): Promise<BlockItem | null> {
  const { data: row, error } = await supabase
    .from('event_block_items')
    .insert({ event_id: eventId, block_kind: blockKind, data, position: position ?? 0 })
    .select()
    .single();
  if (error) { console.error('addBlockItem:', error); return null; }
  return row as BlockItem;
}

export async function updateBlockItem(itemId: string, patch: Partial<{ data: Record<string, any>; position: number }>): Promise<boolean> {
  const { error } = await supabase
    .from('event_block_items')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', itemId);
  if (error) { console.error('updateBlockItem:', error); return false; }
  return true;
}

export async function deleteBlockItem(itemId: string): Promise<boolean> {
  const { error } = await supabase.from('event_block_items').delete().eq('id', itemId);
  if (error) { console.error('deleteBlockItem:', error); return false; }
  return true;
}

export async function fetchResponses(itemIds: string[]): Promise<BlockResponse[]> {
  if (!itemIds.length) return [];
  const { data, error } = await supabase
    .from('event_block_responses')
    .select('*')
    .in('item_id', itemIds);
  if (error) { console.error('fetchResponses:', error); return []; }
  return (data || []) as BlockResponse[];
}

export async function setResponse(itemId: string, responseKind: string, data?: Record<string, any>): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase
    .from('event_block_responses')
    .upsert({ item_id: itemId, user_id: user.id, response_kind: responseKind, data: data ?? null }, { onConflict: 'item_id,user_id,response_kind' });
  if (error) { console.error('setResponse:', error); return false; }
  return true;
}

export async function removeResponse(itemId: string, responseKind: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase
    .from('event_block_responses')
    .delete()
    .eq('item_id', itemId)
    .eq('user_id', user.id)
    .eq('response_kind', responseKind);
  if (error) { console.error('removeResponse:', error); return false; }
  return true;
}

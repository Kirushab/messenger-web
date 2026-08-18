import { supabase } from './supabase';
export async function uploadFile(convId: string, file: File, onProgress?: (p: number) => void) {
  const path = convId + '/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  onProgress?.(30);
  const { error } = await supabase.storage.from('chat-files').upload(path, file, { contentType: file.type });
  if (error) return { url: '', error: error.message };
  onProgress?.(90);
  const { data } = supabase.storage.from('chat-files').getPublicUrl(path);
  onProgress?.(100);
  return { url: data.publicUrl, error: null };
}
export async function uploadMapPointPhoto(userId: string, file: File) {
  const path = userId + '/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const { error } = await supabase.storage.from('map-point-photos').upload(path, file, { contentType: file.type });
  if (error) return { url: '', error: error.message };
  const { data } = supabase.storage.from('map-point-photos').getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}
export function formatFileSize(b: number): string {
  if (!b) return '0 Б';
  const k=1024, s=['Б','КБ','МБ','ГБ'], i=Math.floor(Math.log(b)/Math.log(k));
  return parseFloat((b/Math.pow(k,i)).toFixed(1))+' '+s[i];
}

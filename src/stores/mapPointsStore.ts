import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface MapPoint {
  id: string;
  created_by: string;
  title: string;
  icon: string | null;
  lng: number;
  lat: number;
  visibility: 'all' | 'custom';
  allowed_ids: string[];
  category: string | null;
  photo_url: string | null;
  note: string | null;
  created_at: string;
}

// Категории точек: иконка + цвет пина. Читаемость карты с одного взгляда.
export interface PointCategory { key: string; label: string; icon: string; color: string; }
export const POINT_CATEGORIES: PointCategory[] = [
  { key: 'place', label: 'Место',    icon: 'place', color: '#10B981' },
  { key: 'food',  label: 'Еда',      icon: 'food',  color: '#F59E0B' },
  { key: 'bar',   label: 'Бар',      icon: 'bar',   color: '#A855F7' },
  { key: 'home',  label: 'Дом',      icon: 'home',  color: '#3B82F6' },
  { key: 'park',  label: 'Парк',     icon: 'park',  color: '#22C55E' },
  { key: 'shop',  label: 'Шопинг',   icon: 'shop',  color: '#EC4899' },
  { key: 'fun',   label: 'Тусовка',  icon: 'fun',   color: '#EF4444' },
  { key: 'sport', label: 'Спорт',    icon: 'sport', color: '#14B8A6' },
];
export const DEFAULT_POINT_COLOR = '#10B981';
export function categoryColor(cat: string | null): string {
  return POINT_CATEGORIES.find(c => c.key === cat)?.color ?? DEFAULT_POINT_COLOR;
}

interface State {
  points: MapPoint[];
  load: () => Promise<void>;
  create: (p: {
    created_by: string; title: string; icon: string | null;
    lng: number; lat: number; visibility: 'all' | 'custom'; allowed_ids: string[]; category: string | null;
    photo_url: string | null; note: string | null;
  }) => Promise<{ error: string | null }>;
  update: (id: string, p: {
    title: string; icon: string | null; visibility: 'all' | 'custom'; allowed_ids: string[]; category: string | null;
    photo_url: string | null; note: string | null;
  }) => Promise<{ error: string | null }>;
  remove: (id: string) => Promise<{ error: string | null }>;
}

export const useMapPointsStore = create<State>((set, get) => ({
  points: [],

  load: async () => {
    const { data, error } = await supabase
      .from('map_points')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return;
    set({ points: (data || []) as MapPoint[] });
  },

  create: async (p) => {
    const { data, error } = await supabase
      .from('map_points')
      .insert({
        created_by: p.created_by,
        title: p.title,
        icon: p.icon,
        lng: p.lng,
        lat: p.lat,
        visibility: p.visibility,
        allowed_ids: p.visibility === 'custom' ? p.allowed_ids : [],
        category: p.category,
        photo_url: p.photo_url,
        note: p.note,
      })
      .select()
      .single();
    if (error) return { error: error.message };
    if (data) set({ points: [data as MapPoint, ...get().points] });
    return { error: null };
  },

  update: async (id, p) => {
    const { data, error } = await supabase
      .from('map_points')
      .update({
        title: p.title,
        icon: p.icon,
        visibility: p.visibility,
        allowed_ids: p.visibility === 'custom' ? p.allowed_ids : [],
        category: p.category,
        photo_url: p.photo_url,
        note: p.note,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) return { error: error.message };
    if (data) set({ points: get().points.map(pt => pt.id === id ? (data as MapPoint) : pt) });
    return { error: null };
  },

  remove: async (id) => {
    const { error } = await supabase.from('map_points').delete().eq('id', id);
    if (error) return { error: error.message };
    set({ points: get().points.filter(p => p.id !== id) });
    return { error: null };
  },
}));

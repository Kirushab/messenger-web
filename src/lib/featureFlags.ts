// Централизованные фиче-флаги.
// Исторически флаги — булевы поля на профиле пользователя (поля *_access).
// Этот модуль — единая точка правды: список флагов + проверка. Новые флаги
// добавляйте СЮДА и проверяйте через hasFlag(user, '<flag>'), а не разбрасывайте
// прямые обращения user.xxx_access по компонентам. См. docs/CONVENTIONS.md.

export const FEATURE_FLAGS = {
  tinder:  'tinder_access',     // мини-приложение «Тиндер» (ставки-знакомства)
  fedya:   'fedya_access',      // спец-раздел «Для Феди»
  voiceFx: 'voice_fx_access',   // голосовые эффекты в звонках/записи
  gmat:    'gmat_access',       // обучение: тест MBA / GMAT
  notes:   'notes_access',      // обучение: тренажёр нот
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

type FlagUser = Record<string, any> | null | undefined;

/** Включён ли флаг у пользователя. */
export function hasFlag(user: FlagUser, flag: FeatureFlag): boolean {
  if (!user) return false;
  return Boolean(user[FEATURE_FLAGS[flag]]);
}

/** Все включённые флаги пользователя (для отладки/админки). */
export function activeFlags(user: FlagUser): FeatureFlag[] {
  return (Object.keys(FEATURE_FLAGS) as FeatureFlag[]).filter(f => hasFlag(user, f));
}

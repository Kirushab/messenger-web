-- 087: колонки доступа к фичам (Доступы / Тиндер).
-- Код ссылается на users.fedya_access и users.tinder_access, но миграции 081/082
-- в репозитории не было — поэтому вкладка «Доступы» и Тиндер-виджет падали с
-- "column users.fedya_access does not exist". Добавляем недостающие колонки.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS fedya_access  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tinder_access boolean NOT NULL DEFAULT false;

-- Обновляем кэш схемы PostgREST, чтобы новые колонки сразу стали видны API.
NOTIFY pgrst, 'reload schema';

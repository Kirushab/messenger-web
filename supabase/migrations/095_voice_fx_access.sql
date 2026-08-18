-- 095_voice_fx_access.sql
-- Флаг доступа к переключателю эффектов голоса в звонке (управляется из админки).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS voice_fx_access BOOLEAN NOT NULL DEFAULT FALSE;

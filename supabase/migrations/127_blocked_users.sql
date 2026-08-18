-- 127: Блокировка пользователей
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_blocker ON public.blocked_users (blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_blocked ON public.blocked_users (blocked_id);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Видно обеим сторонам (чтобы можно было реализовать запрет на стороне получателя),
-- но изменять может только тот, кто блокирует.
DROP POLICY IF EXISTS blocked_users_select ON public.blocked_users;
CREATE POLICY blocked_users_select ON public.blocked_users FOR SELECT USING (
  blocker_id = auth.uid() OR blocked_id = auth.uid()
);

DROP POLICY IF EXISTS blocked_users_insert ON public.blocked_users;
CREATE POLICY blocked_users_insert ON public.blocked_users FOR INSERT WITH CHECK (
  blocker_id = auth.uid()
);

DROP POLICY IF EXISTS blocked_users_delete ON public.blocked_users;
CREATE POLICY blocked_users_delete ON public.blocked_users FOR DELETE USING (
  blocker_id = auth.uid()
);

-- DONE

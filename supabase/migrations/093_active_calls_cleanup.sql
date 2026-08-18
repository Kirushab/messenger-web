-- 093_active_calls_cleanup.sql
-- Переход со старой версии 092 (single-row active_calls) на heartbeat-модель.
-- Безопасно для свежих установок: DROP ... IF EXISTS ничего не ломает.

DROP FUNCTION IF EXISTS public.join_active_call(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.leave_active_call(UUID);
DROP TABLE IF EXISTS public.active_calls CASCADE;

-- Новая модель определена в 092_active_calls.sql (active_call_participants + heartbeat_call/leave_call).
-- Если 092 ещё не применялась в её новой версии — выполните её после этого файла.

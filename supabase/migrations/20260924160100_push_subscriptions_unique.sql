-- O upsert da API precisa de um índice único comum (o PostgREST não infere índice parcial).
-- Linhas antigas com user_id nulo continuam permitidas: NULL nunca conflita em índice único.
drop index if exists public.push_subscriptions_user_endpoint_idx;
create unique index if not exists push_subscriptions_user_endpoint_idx
  on public.push_subscriptions (user_id, endpoint);

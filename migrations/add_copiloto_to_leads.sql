-- Copiloto do atendimento humano: a IA le a conversa e grava a leitura do funil aqui (lib/sdr/copiloto.ts).
alter table public.leads add column if not exists copiloto jsonb;

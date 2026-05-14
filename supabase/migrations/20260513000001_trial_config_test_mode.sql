ALTER TABLE trial_configs
  ADD COLUMN IF NOT EXISTS test_mode boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS test_phone text;

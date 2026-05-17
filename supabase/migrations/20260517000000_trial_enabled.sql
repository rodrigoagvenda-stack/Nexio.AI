-- Add trial_enabled flag to companies table
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS trial_enabled boolean NOT NULL DEFAULT false;

-- Add canvas_config column to follow_sequences
-- Stores ReactFlow node positions + edge topology so the canvas survives tab switches and page reloads.
-- JSONB with DEFAULT NULL — backward-compatible (existing rows get NULL, fall back to auto-layout).
ALTER TABLE follow_sequences
  ADD COLUMN IF NOT EXISTS canvas_config JSONB DEFAULT NULL;

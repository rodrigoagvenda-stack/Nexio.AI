-- Add closed_at column to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_closed_at ON leads(closed_at);

-- Update existing leads that are already closed to have a closed_at date
-- (using created_at as fallback for existing data)
UPDATE leads 
SET closed_at = updated_at 
WHERE status = 'Fechado' AND closed_at IS NULL;

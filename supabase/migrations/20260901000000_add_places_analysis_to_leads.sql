ALTER TABLE leads ADD COLUMN IF NOT EXISTS places_analysis JSONB;
COMMENT ON COLUMN leads.places_analysis IS 'Análise Google Places (score/gaps/summary) : feature exclusiva atrás de company.features.places_analysis, gerada em lib/sdr/extraction.ts durante o Orbit.';

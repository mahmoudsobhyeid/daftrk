-- Invoice appearance settings: free-form design options that have no dedicated
-- column yet — text alignment and per-section visibility/alignment.
-- Existing `design_*` columns on `companies` keep their current responsibilities
-- (logo size/position, font size, table style, page margin, QR/signature).
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS design_layout jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.companies.design_layout IS
  'Invoice appearance extras: { "textAlign": "auto|start|center|end", "sections": { "<key>": { "visible": bool, "align": "start|center|end" } } }';

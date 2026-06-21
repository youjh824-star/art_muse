ALTER TABLE attendance ADD COLUMN IF NOT EXISTS checked_out_at timestamptz;

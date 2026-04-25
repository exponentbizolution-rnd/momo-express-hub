-- Ensure unique key constraint for upserts on system_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'system_settings_key_unique'
  ) THEN
    ALTER TABLE public.system_settings
      ADD CONSTRAINT system_settings_key_unique UNIQUE (key);
  END IF;
END $$;
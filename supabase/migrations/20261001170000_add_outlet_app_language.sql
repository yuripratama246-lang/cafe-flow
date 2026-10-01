ALTER TABLE public.outlet_settings
  ADD COLUMN IF NOT EXISTS app_language text NOT NULL DEFAULT 'id';

ALTER TABLE public.outlet_settings
  DROP CONSTRAINT IF EXISTS outlet_settings_app_language_check;

ALTER TABLE public.outlet_settings
  ADD CONSTRAINT outlet_settings_app_language_check
  CHECK (app_language IN ('en', 'id', 'zh', 'th'));

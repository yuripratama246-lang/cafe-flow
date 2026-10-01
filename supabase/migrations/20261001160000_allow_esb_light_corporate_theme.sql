ALTER TABLE public.outlet_settings
  DROP CONSTRAINT IF EXISTS outlet_settings_global_theme_check;

ALTER TABLE public.outlet_settings
  ADD CONSTRAINT outlet_settings_global_theme_check
  CHECK (global_theme = ANY (ARRAY[
    'premium-espresso',
    'emerald-matcha',
    'burgundy-roastery',
    'smoked-oakwood',
    'midnight-cyber',
    'lavender-haze',
    'matte-carbon',
    'scandinavian-clean',
    'sakura-bakery',
    'citrus-juice',
    'soft-sage',
    'minimalist-oatmilk',
    'roasted-hojicha',
    'dusk-taro',
    'esb-light-corporate'
  ]::text[]));

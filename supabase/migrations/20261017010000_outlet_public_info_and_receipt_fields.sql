ALTER TABLE public.outlet_settings
  ADD COLUMN IF NOT EXISTS opening_hours text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS instagram text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS receipt_note text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS receipt_footer text NOT NULL DEFAULT 'Terima kasih sudah berkunjung.';

CREATE OR REPLACE FUNCTION public.get_public_outlet_info()
RETURNS TABLE (
  name text, address text, phone text, opening_hours text, instagram text,
  receipt_note text, receipt_footer text, tax_rate numeric, service_rate numeric,
  tax_enabled boolean, service_enabled boolean, cash_enabled boolean,
  card_enabled boolean, qris_enabled boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT os.name::text, os.address::text, os.phone::text,
    COALESCE(os.opening_hours, ''), COALESCE(os.instagram, ''),
    COALESCE(os.receipt_note, ''), COALESCE(os.receipt_footer, 'Terima kasih sudah berkunjung.'),
    os.tax_rate::numeric, os.service_rate::numeric, os.tax_enabled,
    os.service_enabled, os.cash_enabled, os.card_enabled, os.qris_enabled
  FROM public.outlet_settings os
  ORDER BY os.updated_at DESC NULLS LAST, os.created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_outlet_info() TO anon, authenticated;

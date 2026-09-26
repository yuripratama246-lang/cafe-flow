CREATE TABLE IF NOT EXISTS public.product_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active product add-ons" ON public.product_addons;
CREATE POLICY "Public can view active product add-ons"
  ON public.product_addons FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated users manage product add-ons" ON public.product_addons;
CREATE POLICY "Authenticated users manage product add-ons"
  ON public.product_addons FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS product_addons_product_active_idx
  ON public.product_addons (product_id, is_active);
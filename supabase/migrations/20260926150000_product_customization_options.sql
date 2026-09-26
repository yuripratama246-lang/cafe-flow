CREATE TABLE IF NOT EXISTS public.product_customization_options (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
 group_key text NOT NULL CHECK (group_key IN ('sugar','ice','size')),
 name text NOT NULL CHECK (length(trim(name)) > 0),
 price_delta numeric(12,2) NOT NULL DEFAULT 0 CHECK (price_delta >= 0),
 is_active boolean NOT NULL DEFAULT true,
 sort_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_customization_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view active product customization options" ON public.product_customization_options;
CREATE POLICY "Public can view active product customization options" ON public.product_customization_options FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Authenticated users manage product customization options" ON public.product_customization_options;
CREATE POLICY "Authenticated users manage product customization options" ON public.product_customization_options FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE INDEX IF NOT EXISTS product_customization_options_product_group_idx ON public.product_customization_options(product_id, group_key, is_active, sort_order);
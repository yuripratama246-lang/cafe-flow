-- Atomic inventory adjustments and immutable cost snapshots for new order items.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS cost_price_snapshot numeric;

CREATE OR REPLACE FUNCTION public.capture_order_item_cost_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cost_price_snapshot IS NULL AND NEW.product_id IS NOT NULL THEN
    SELECT p.cost_price INTO NEW.cost_price_snapshot
    FROM public.products p WHERE p.id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_item_cost_snapshot ON public.order_items;
CREATE TRIGGER order_item_cost_snapshot
BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.capture_order_item_cost_snapshot();

CREATE OR REPLACE FUNCTION public.adjust_product_stock(
  p_product_id uuid,
  p_delta integer,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_product public.products%rowtype;
  v_next integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesi login tidak ditemukan'; END IF;
  IF NOT public.has_permission('inventory') THEN
    RAISE EXCEPTION 'Akun tidak punya izin inventory';
  END IF;
  IF p_product_id IS NULL OR p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION 'Produk dan perubahan stok tidak valid';
  END IF;

  SELECT coalesce(sp.owner_id, v_uid) INTO v_owner
  FROM public.staff_profiles sp WHERE sp.user_id = v_uid;
  v_owner := coalesce(v_owner, v_uid);

  SELECT * INTO v_product FROM public.products
  WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produk tidak ditemukan'; END IF;

  v_next := coalesce(v_product.stock, 0) + p_delta;
  IF v_next < 0 THEN RAISE EXCEPTION 'Stok tidak boleh negatif'; END IF;

  UPDATE public.products SET stock = v_next WHERE id = p_product_id;
  INSERT INTO public.inventory_movements
    (product_id, owner_id, type, quantity, note, created_by)
  VALUES
    (p_product_id, v_owner, CASE WHEN p_delta > 0 THEN 'purchase' ELSE 'adjustment' END,
     p_delta, nullif(trim(p_note), ''), v_uid);

  RETURN jsonb_build_object('product_id', p_product_id, 'previous_stock', v_product.stock, 'stock', v_next);
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_product_stock(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(uuid, integer, text) TO authenticated;

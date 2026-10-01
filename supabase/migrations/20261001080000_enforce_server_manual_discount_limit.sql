CREATE OR REPLACE FUNCTION public.create_pos_order(
  p_order jsonb,
  p_items jsonb,
  p_payment jsonb DEFAULT NULL::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_order public.orders%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_promotion public.promotions%rowtype;
  v_key uuid := nullif(p_order->>'idempotency_key','')::uuid;
  v_promotion_id uuid := nullif(p_order->>'promotion_id','')::uuid;
  v_subtotal numeric := 0;
  v_manual numeric := coalesce(nullif(p_order->>'discount','')::numeric,0);
  v_promo numeric := 0;
  v_discount numeric := 0;
  v_service numeric := 0;
  v_tax numeric := 0;
  v_total numeric := 0;
  v_base numeric := 0;
  v_service_rate numeric := 0;
  v_tax_rate numeric := 0;
  v_service_enabled boolean := false;
  v_tax_enabled boolean := false;
  v_qty integer;
  v_product_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesi login tidak ditemukan'; END IF;
  IF NOT public.has_permission('orders') OR NOT public.has_permission('payments') THEN
    RAISE EXCEPTION 'Akun tidak punya izin transaksi';
  END IF;
  IF v_key IS NULL THEN RAISE EXCEPTION 'Idempotency key wajib diisi'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Pesanan harus memiliki minimal satu item';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_key::text, 0));
  SELECT * INTO v_order FROM public.orders WHERE idempotency_key = v_key;
  IF FOUND THEN RETURN jsonb_build_object('order',to_jsonb(v_order),'idempotent_replay',true); END IF;

  SELECT coalesce(sp.owner_id,v_uid) INTO v_owner
  FROM public.staff_profiles sp WHERE sp.user_id=v_uid;
  v_owner := coalesce(v_owner,v_uid);

  SELECT coalesce(os.service_rate,0), coalesce(os.tax_rate,0),
         coalesce(os.service_enabled,false), coalesce(os.tax_enabled,false)
    INTO v_service_rate,v_tax_rate,v_service_enabled,v_tax_enabled
  FROM public.outlet_settings os WHERE os.owner_id=v_owner LIMIT 1;

  PERFORM p.id FROM public.products p
    WHERE p.id IN (
      SELECT DISTINCT (x->>'product_id')::uuid
      FROM jsonb_array_elements(p_items) x
      WHERE nullif(x->>'product_id','') IS NOT NULL
    )
    ORDER BY p.id FOR UPDATE;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_product_id := nullif(v_item->>'product_id','')::uuid;
    v_qty := coalesce((v_item->>'quantity')::integer,0);
    IF v_product_id IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Item atau quantity tidak valid'; END IF;
    SELECT * INTO v_product FROM public.products WHERE id=v_product_id AND is_active=true;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produk tidak ditemukan atau tidak aktif'; END IF;
    v_subtotal := v_subtotal + v_product.price * v_qty;
  END LOOP;

  -- Manual discount is a monetary amount, capped server-side at 20% of DB subtotal.
  IF v_manual < 0 THEN RAISE EXCEPTION 'Diskon manual tidak boleh negatif'; END IF;
  IF v_manual > round(v_subtotal * 0.20,2) THEN
    RAISE EXCEPTION 'Diskon manual melebihi batas 20%% dari subtotal';
  END IF;

  IF v_promotion_id IS NOT NULL THEN
    SELECT * INTO v_promotion FROM public.promotions p
    WHERE p.id=v_promotion_id AND p.active
      AND (p.owner_id=v_owner OR p.owner_id IS NULL)
      AND (p.starts_at IS NULL OR p.starts_at<=now())
      AND (p.ends_at IS NULL OR p.ends_at>=now());
    IF NOT FOUND THEN RAISE EXCEPTION 'Voucher tidak tersedia atau sudah tidak berlaku'; END IF;

    IF v_promotion.scope='product' THEN
      SELECT coalesce(sum(pr.price * (x->>'quantity')::integer),0)
      INTO v_base
      FROM jsonb_array_elements(p_items) x
      JOIN public.products pr ON pr.id=(x->>'product_id')::uuid
      WHERE pr.id=v_promotion.product_id;
    ELSE
      v_base := v_subtotal;
    END IF;
    IF v_promotion.scope='product' AND v_base<=0 THEN
      RAISE EXCEPTION 'Voucher hanya berlaku untuk produk tertentu';
    END IF;
    IF v_base < coalesce(v_promotion.min_purchase,0) THEN
      RAISE EXCEPTION 'Belum memenuhi minimum voucher';
    END IF;
    v_promo := CASE WHEN v_promotion.type='percentage'
      THEN least(v_base,v_base*v_promotion.value/100)
      ELSE least(v_base,v_promotion.value) END;
  END IF;

  v_discount := least(v_subtotal,v_manual+v_promo);
  v_service := CASE WHEN v_service_enabled THEN round((v_subtotal-v_discount)*v_service_rate/100) ELSE 0 END;
  v_tax := CASE WHEN v_tax_enabled THEN round(((v_subtotal-v_discount)+v_service)*v_tax_rate/100) ELSE 0 END;
  v_total := greatest((v_subtotal-v_discount)+v_service+v_tax,0);

  INSERT INTO public.orders(
    idempotency_key,source,status,table_id,customer_name,notes,subtotal,discount,tax,total,
    is_paid,payment_method,payment_status,promotion_id
  ) VALUES (
    v_key,'pos','new',nullif(p_order->>'table_id','')::uuid,
    nullif(p_order->>'customer_name',''),nullif(p_order->>'notes',''),
    v_subtotal,v_discount,v_service+v_tax,v_total,false,
    nullif(p_order->>'payment_method',''),'paid',v_promotion_id
  ) RETURNING * INTO v_order;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_product_id := nullif(v_item->>'product_id','')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    SELECT * INTO v_product FROM public.products WHERE id=v_product_id;
    INSERT INTO public.order_items(order_id,product_id,product_name,unit_price,quantity,note,line_total)
    VALUES(v_order.id,v_product_id,v_product.name,v_product.price,v_qty,nullif(v_item->>'note',''),v_product.price*v_qty);
  END LOOP;

  IF p_payment IS NOT NULL THEN
    INSERT INTO public.payments(order_id,method,amount,cash_received,change_amount)
    VALUES(
      v_order.id,coalesce(p_payment->>'method',p_order->>'payment_method'),v_total,
      nullif(p_payment->>'cash_received','')::numeric,
      CASE WHEN coalesce(p_payment->>'method',p_order->>'payment_method')='cash'
        THEN greatest(coalesce(nullif(p_payment->>'cash_received','')::numeric,v_total)-v_total,0)
        ELSE NULL END
    );
  END IF;

  UPDATE public.orders SET status='completed',is_paid=true,payment_status='paid',updated_at=now()
  WHERE id=v_order.id RETURNING * INTO v_order;
  RETURN jsonb_build_object('order',to_jsonb(v_order),'idempotent_replay',false);
END;
$$;
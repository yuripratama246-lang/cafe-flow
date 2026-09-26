-- Selectable single-voucher support for Cafe Flow.
ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'cart',
  ADD COLUMN IF NOT EXISTS product_id uuid NULL REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS promotion_id uuid NULL REFERENCES public.promotions(id) ON DELETE SET NULL;
ALTER TABLE public.promotions DROP CONSTRAINT IF EXISTS promotions_scope_check;
ALTER TABLE public.promotions ADD CONSTRAINT promotions_scope_check CHECK (scope IN ('cart','product'));
DROP FUNCTION IF EXISTS public.get_active_public_promotions();
CREATE FUNCTION public.get_active_public_promotions()
RETURNS TABLE(id uuid,name text,type text,value numeric,min_purchase numeric,active boolean,starts_at timestamptz,ends_at timestamptz,scope text,product_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
 SELECT p.id,p.name,p.type,p.value,p.min_purchase,p.active,p.starts_at,p.ends_at,p.scope,p.product_id
 FROM public.promotions p
 WHERE p.active=true
 AND (p.owner_id=(SELECT os.owner_id FROM public.outlet_settings os ORDER BY os.created_at DESC LIMIT 1) OR p.owner_id IS NULL)
 AND (p.starts_at IS NULL OR p.starts_at<=now()) AND (p.ends_at IS NULL OR p.ends_at>=now());
$$;
GRANT EXECUTE ON FUNCTION public.get_active_public_promotions() TO anon,authenticated;

-- QR checkout: no discount unless one eligible promotion ID is explicitly supplied.
CREATE OR REPLACE FUNCTION public.create_qr_order(p_order jsonb,p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
 v_order public.orders%rowtype; v_item jsonb; v_owner uuid;
 v_promotion public.promotions%rowtype; v_promotion_id uuid:=nullif(p_order->>'promotion_id','')::uuid;
 v_subtotal numeric:=greatest(coalesce((p_order->>'subtotal')::numeric,0),0); v_base numeric:=0; v_discount numeric:=0;
 v_service numeric:=0; v_tax numeric:=0; v_total numeric:=0; v_service_rate numeric:=0; v_tax_rate numeric:=0;
 v_service_enabled boolean:=false; v_tax_enabled boolean:=false;
BEGIN
 IF coalesce(p_order->>'source','')<>'qr' THEN RAISE EXCEPTION 'Sumber pesanan tidak valid'; END IF;
 IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)=0 THEN RAISE EXCEPTION 'Pesanan harus memiliki minimal satu item'; END IF;
 SELECT os.owner_id,coalesce(os.service_rate,0),coalesce(os.tax_rate,0),coalesce(os.service_enabled,false),coalesce(os.tax_enabled,false)
 INTO v_owner,v_service_rate,v_tax_rate,v_service_enabled,v_tax_enabled FROM public.outlet_settings os ORDER BY os.created_at DESC LIMIT 1;
 IF v_promotion_id IS NOT NULL THEN
  SELECT * INTO v_promotion FROM public.promotions p WHERE p.id=v_promotion_id AND p.active
   AND (p.owner_id=v_owner OR p.owner_id IS NULL) AND (p.starts_at IS NULL OR p.starts_at<=now()) AND (p.ends_at IS NULL OR p.ends_at>=now());
  IF NOT FOUND THEN RAISE EXCEPTION 'Voucher tidak tersedia atau sudah tidak berlaku'; END IF;
  IF v_promotion.scope='product' THEN
   SELECT coalesce(sum(coalesce((x->>'unit_price')::numeric,0)*coalesce((x->>'quantity')::integer,0)),0) INTO v_base
   FROM jsonb_array_elements(p_items) x WHERE nullif(x->>'product_id','')::uuid=v_promotion.product_id;
  ELSE v_base:=v_subtotal; END IF;
  IF v_base<coalesce(v_promotion.min_purchase,0) THEN RAISE EXCEPTION 'Belum memenuhi minimum voucher'; END IF;
  v_discount:=CASE WHEN v_promotion.type='percentage' THEN least(v_base,v_base*v_promotion.value/100) ELSE least(v_base,v_promotion.value) END;
 END IF;
 v_service:=CASE WHEN v_service_enabled THEN round((v_subtotal-v_discount)*v_service_rate/100) ELSE 0 END;
 v_tax:=CASE WHEN v_tax_enabled THEN round(((v_subtotal-v_discount)+v_service)*v_tax_rate/100) ELSE 0 END;
 v_total:=greatest((v_subtotal-v_discount)+v_service+v_tax,0);
 INSERT INTO public.orders(order_no,source,status,table_id,customer_name,notes,subtotal,discount,tax,total,is_paid,payment_method,payment_status,promotion_id)
 VALUES(nextval('public.orders_order_no_seq'),'qr','new',nullif(p_order->>'table_id','')::uuid,nullif(p_order->>'customer_name',''),nullif(p_order->>'notes',''),
 v_subtotal,v_discount,v_service+v_tax,v_total,false,nullif(p_order->>'payment_method',''),coalesce(nullif(p_order->>'payment_status',''),'unpaid'),v_promotion_id)
 RETURNING * INTO v_order;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  INSERT INTO public.order_items(order_id,product_id,product_name,unit_price,quantity,note,line_total)
  VALUES(v_order.id,nullif(v_item->>'product_id','')::uuid,coalesce(v_item->>'product_name',''),coalesce((v_item->>'unit_price')::numeric,0),
  coalesce((v_item->>'quantity')::integer,0),nullif(v_item->>'note',''),coalesce((v_item->>'unit_price')::numeric,0)*coalesce((v_item->>'quantity')::integer,0));
 END LOOP;
 RETURN jsonb_build_object('order',to_jsonb(v_order));
END; $$;

-- POS checkout preserves manual discount and adds at most the explicitly selected voucher.
CREATE OR REPLACE FUNCTION public.create_pos_order(p_order jsonb,p_items jsonb,p_payment jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
 v_uid uuid:=auth.uid(); v_owner uuid; v_order public.orders%rowtype; v_item jsonb;
 v_promotion public.promotions%rowtype; v_promotion_id uuid:=nullif(p_order->>'promotion_id','')::uuid;
 v_subtotal numeric:=greatest(coalesce((p_order->>'subtotal')::numeric,0),0); v_manual numeric:=greatest(coalesce((p_order->>'discount')::numeric,0),0);
 v_base numeric:=0; v_promo numeric:=0; v_discount numeric:=0; v_service numeric:=0; v_tax numeric:=0; v_total numeric:=0;
 v_service_rate numeric:=0; v_tax_rate numeric:=0; v_service_enabled boolean:=false; v_tax_enabled boolean:=false;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesi login tidak ditemukan'; END IF;
 IF NOT public.has_permission('orders') OR NOT public.has_permission('payments') THEN RAISE EXCEPTION 'Akun tidak punya izin transaksi'; END IF;
 SELECT coalesce(sp.owner_id,v_uid) INTO v_owner FROM public.staff_profiles sp WHERE sp.user_id=v_uid; v_owner:=coalesce(v_owner,v_uid);
 SELECT coalesce(os.service_rate,0),coalesce(os.tax_rate,0),coalesce(os.service_enabled,false),coalesce(os.tax_enabled,false)
 INTO v_service_rate,v_tax_rate,v_service_enabled,v_tax_enabled FROM public.outlet_settings os WHERE os.owner_id=v_owner LIMIT 1;
 IF v_promotion_id IS NOT NULL THEN
  SELECT * INTO v_promotion FROM public.promotions p WHERE p.id=v_promotion_id AND p.active
   AND (p.owner_id=v_owner OR p.owner_id IS NULL) AND (p.starts_at IS NULL OR p.starts_at<=now()) AND (p.ends_at IS NULL OR p.ends_at>=now());
  IF NOT FOUND THEN RAISE EXCEPTION 'Voucher tidak tersedia atau sudah tidak berlaku'; END IF;
  IF v_promotion.scope='product' THEN
   SELECT coalesce(sum(coalesce((x->>'unit_price')::numeric,0)*coalesce((x->>'quantity')::integer,0)),0) INTO v_base
   FROM jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) x WHERE nullif(x->>'product_id','')::uuid=v_promotion.product_id;
  ELSE v_base:=v_subtotal; END IF;
  IF v_base<coalesce(v_promotion.min_purchase,0) THEN RAISE EXCEPTION 'Belum memenuhi minimum voucher'; END IF;
  v_promo:=CASE WHEN v_promotion.type='percentage' THEN least(v_base,v_base*v_promotion.value/100) ELSE least(v_base,v_promotion.value) END;
 END IF;
 v_discount:=least(v_subtotal,v_manual+v_promo);
 v_service:=CASE WHEN v_service_enabled THEN round((v_subtotal-v_discount)*v_service_rate/100) ELSE 0 END;
 v_tax:=CASE WHEN v_tax_enabled THEN round(((v_subtotal-v_discount)+v_service)*v_tax_rate/100) ELSE 0 END;
 v_total:=greatest((v_subtotal-v_discount)+v_service+v_tax,0);
 INSERT INTO public.orders(source,status,table_id,customer_name,notes,subtotal,discount,tax,total,is_paid,payment_method,payment_status,promotion_id)
 VALUES(coalesce(p_order->>'source','pos'),'new',nullif(p_order->>'table_id','')::uuid,nullif(p_order->>'customer_name',''),nullif(p_order->>'notes',''),
 v_subtotal,v_discount,v_service+v_tax,v_total,false,nullif(p_order->>'payment_method',''),'paid',v_promotion_id) RETURNING * INTO v_order;
 FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) LOOP
  INSERT INTO public.order_items(order_id,product_id,product_name,unit_price,quantity,note,line_total)
  VALUES(v_order.id,nullif(v_item->>'product_id','')::uuid,v_item->>'product_name',coalesce((v_item->>'unit_price')::numeric,0),
  coalesce((v_item->>'quantity')::integer,0),nullif(v_item->>'note',''),coalesce((v_item->>'line_total')::numeric,coalesce((v_item->>'unit_price')::numeric,0)*coalesce((v_item->>'quantity')::integer,0)));
 END LOOP;
 IF p_payment IS NOT NULL THEN
  INSERT INTO public.payments(order_id,method,amount,cash_received,change_amount)
  VALUES(v_order.id,p_payment->>'method',v_total,nullif(p_payment->>'cash_received','')::numeric,
   CASE WHEN p_payment->>'method'='cash' THEN greatest(coalesce(nullif(p_payment->>'cash_received','')::numeric,v_total)-v_total,0) ELSE NULL END);
 END IF;
 UPDATE public.orders SET status='completed',is_paid=true,payment_status='paid',updated_at=now() WHERE id=v_order.id RETURNING * INTO v_order;
 RETURN jsonb_build_object('order',to_jsonb(v_order));
END; $$;

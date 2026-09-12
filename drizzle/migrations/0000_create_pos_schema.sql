-- Categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.categories FOR SELECT TO anon USING (true);
CREATE POLICY "categories staff all" ON public.categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  image_url text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  stock int NOT NULL DEFAULT 0,
  low_stock_threshold int NOT NULL DEFAULT 5,
  show_on_menu boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products public read" ON public.products FOR SELECT TO anon USING (show_on_menu AND is_active);
CREATE POLICY "products staff all" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tables (dine-in)
CREATE TABLE public.restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.restaurant_tables TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_tables TO authenticated;
GRANT ALL ON public.restaurant_tables TO service_role;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tables public read" ON public.restaurant_tables FOR SELECT TO anon USING (true);
CREATE POLICY "tables staff all" ON public.restaurant_tables FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Orders
CREATE SEQUENCE public.order_number_seq START 1001;
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no int NOT NULL DEFAULT nextval('public.order_number_seq'),
  source text NOT NULL DEFAULT 'pos',
  status text NOT NULL DEFAULT 'new',
  table_id uuid REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  customer_name text,
  notes text,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  is_paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders public read" ON public.orders FOR SELECT TO anon USING (true);
CREATE POLICY "orders public create" ON public.orders FOR INSERT TO anon WITH CHECK (source = 'qr' AND is_paid = false AND status = 'new');
CREATE POLICY "orders staff all" ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Order items
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  quantity int NOT NULL DEFAULT 1,
  note text,
  line_total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order items public read" ON public.order_items FOR SELECT TO anon USING (true);
CREATE POLICY "order items public create" ON public.order_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "order items staff all" ON public.order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Payments
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  method text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  cash_received numeric(12,2),
  change_amount numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments staff all" ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Auto stock deduction
CREATE OR REPLACE FUNCTION public.deduct_stock_on_order_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.products
      SET stock = GREATEST(stock - NEW.quantity, 0)
      WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_deduct_stock
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_on_order_item();

-- Restore stock on cancel
CREATE OR REPLACE FUNCTION public.restore_stock_on_cancel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    UPDATE public.products p
      SET stock = p.stock + oi.quantity
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id AND oi.product_id = p.id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_restore_stock
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.restore_stock_on_cancel();

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;

-- Sample data
INSERT INTO public.categories (id, name, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111101','Kopi',1),
  ('11111111-1111-1111-1111-111111111102','Non-Kopi',2),
  ('11111111-1111-1111-1111-111111111103','Makanan',3),
  ('11111111-1111-1111-1111-111111111104','Snack',4),
  ('11111111-1111-1111-1111-111111111105','Dessert',5);

INSERT INTO public.products (name, description, price, category_id, stock, low_stock_threshold, image_url) VALUES
  ('Espresso','Single shot arabika', 18000,'11111111-1111-1111-1111-111111111101', 40, 8, null),
  ('Americano','Espresso + air', 22000,'11111111-1111-1111-1111-111111111101', 35, 8, null),
  ('Cappuccino','Espresso + susu steam', 28000,'11111111-1111-1111-1111-111111111101', 30, 8, null),
  ('Caffe Latte','Lembut dan creamy', 30000,'11111111-1111-1111-1111-111111111101', 28, 8, null),
  ('Kopi Susu Gula Aren','Favorit pelanggan', 25000,'11111111-1111-1111-1111-111111111101', 4, 8, null),
  ('Matcha Latte','Matcha premium', 32000,'11111111-1111-1111-1111-111111111102', 20, 5, null),
  ('Chocolate','Cokelat panas/dingin', 27000,'11111111-1111-1111-1111-111111111102', 22, 5, null),
  ('Lemon Tea','Teh segar lemon', 20000,'11111111-1111-1111-1111-111111111102', 25, 5, null),
  ('Nasi Goreng Spesial','Dengan telur mata sapi', 38000,'11111111-1111-1111-1111-111111111103', 15, 4, null),
  ('Mie Goreng Ayam','Pedas manis', 35000,'11111111-1111-1111-1111-111111111103', 14, 4, null),
  ('Chicken Katsu Rice','Saus teriyaki', 45000,'11111111-1111-1111-1111-111111111103', 3, 4, null),
  ('French Fries','Saus keju', 25000,'11111111-1111-1111-1111-111111111104', 30, 6, null),
  ('Pisang Goreng Keju','Topping keju susu', 22000,'11111111-1111-1111-1111-111111111104', 18, 6, null),
  ('Croissant Butter','Renyah dan gurih', 24000,'11111111-1111-1111-1111-111111111104', 12, 6, null),
  ('Cheesecake Slice','New York style', 35000,'11111111-1111-1111-1111-111111111105', 10, 3, null),
  ('Brownies Ice Cream','Hangat dengan vanilla', 38000,'11111111-1111-1111-1111-111111111105', 9, 3, null);

INSERT INTO public.restaurant_tables (name, code) VALUES
  ('Meja 1','M1'), ('Meja 2','M2'), ('Meja 3','M3'), ('Meja 4','M4'), ('Meja 5','M5'), ('Takeaway','TA');

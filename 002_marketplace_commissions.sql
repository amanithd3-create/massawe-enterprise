-- MASSAWE ENTERPRISE marketplace extension
-- Matches the live Supabase schema: businesses.owner_id and products.business_id.
-- Existing store products remain Massawe-owned when business_id is NULL.

CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text,
  email text,
  phone text,
  location text,
  logo_url text,
  website text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','suspended')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view approved businesses" ON public.businesses;
CREATE POLICY "Anyone can view approved businesses"
ON public.businesses FOR SELECT TO anon, authenticated
USING (status = 'approved' OR owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can register businesses" ON public.businesses;
CREATE POLICY "Users can register businesses"
ON public.businesses FOR INSERT TO authenticated
WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Owners can update businesses" ON public.businesses;
CREATE POLICY "Owners can update businesses"
ON public.businesses FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid()))
WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "staff manage businesses" ON public.businesses;
CREATE POLICY "staff manage businesses"
ON public.businesses FOR ALL TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS products_business_id_idx ON public.products(business_id);

DROP POLICY IF EXISTS "business owners view own products" ON public.products;
CREATE POLICY "business owners view own products"
ON public.products FOR SELECT TO authenticated
USING (
  business_id IN (
    SELECT b.id FROM public.businesses b
    WHERE b.owner_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "business owners manage own products" ON public.products;
CREATE POLICY "business owners manage own products"
ON public.products FOR ALL TO authenticated
USING (
  business_id IN (
    SELECT b.id FROM public.businesses b
    WHERE b.owner_id = (SELECT auth.uid()) AND b.status = 'approved'
  )
)
WITH CHECK (
  business_id IN (
    SELECT b.id FROM public.businesses b
    WHERE b.owner_id = (SELECT auth.uid()) AND b.status = 'approved'
  )
);

CREATE TABLE IF NOT EXISTS public.order_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL UNIQUE REFERENCES public.order_items(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  sale_amount numeric(14,2) NOT NULL CHECK (sale_amount > 0),
  commission_rate numeric(5,2) NOT NULL DEFAULT 5.00 CHECK (commission_rate = 5.00),
  commission_amount numeric(14,2)
    GENERATED ALWAYS AS (round(sale_amount * commission_rate / 100, 2)) STORED,
  currency text NOT NULL DEFAULT 'TZS' CHECK (currency IN ('TZS','USD')),
  status text NOT NULL DEFAULT 'earned' CHECK (status IN ('earned','reversed','paid')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_commissions_business_idx ON public.order_commissions(business_id);
CREATE INDEX IF NOT EXISTS order_commissions_order_idx ON public.order_commissions(order_id);
ALTER TABLE public.order_commissions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.order_commissions TO authenticated;

DROP POLICY IF EXISTS "staff read order commissions" ON public.order_commissions;
CREATE POLICY "staff read order commissions"
ON public.order_commissions FOR SELECT TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS "business owners read own commissions" ON public.order_commissions;
CREATE POLICY "business owners read own commissions"
ON public.order_commissions FOR SELECT TO authenticated
USING (
  business_id IN (
    SELECT b.id FROM public.businesses b
    WHERE b.owner_id = (SELECT auth.uid())
  )
);

-- The trigger runs only when the trusted backend changes orders.payment_status to paid.
-- Never mark an order paid from browser input; do so only after a verified gateway webhook.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.sync_order_commissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    INSERT INTO public.order_commissions
      (order_id, order_item_id, business_id, sale_amount, commission_rate, currency, status)
    SELECT NEW.id, oi.id, p.business_id, oi.line_total_tzs, 5.00, 'TZS', 'earned'
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = NEW.id
      AND p.business_id IS NOT NULL
      AND oi.line_total_tzs > 0
    ON CONFLICT (order_item_id) DO UPDATE SET status = 'earned';
  ELSIF NEW.payment_status = 'refunded' AND OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    UPDATE public.order_commissions
       SET status = 'reversed'
     WHERE order_id = NEW.id AND status = 'earned';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.sync_order_commissions() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS orders_sync_commissions ON public.orders;
CREATE TRIGGER orders_sync_commissions
AFTER UPDATE OF payment_status ON public.orders
FOR EACH ROW
WHEN (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
EXECUTE FUNCTION private.sync_order_commissions();

-- Explicit owner bootstrap for the existing Auth account.
UPDATE public.profiles p
SET role = 'owner'
FROM auth.users u
WHERE p.id = u.id
  AND lower(u.email) = lower('amanithd3@gmail.com');

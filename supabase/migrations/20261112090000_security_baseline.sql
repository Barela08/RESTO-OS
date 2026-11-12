-- RESTO OS security baseline
-- Review against the live schema before applying. This migration is intentionally
-- not auto-applied by the application. Run only after a verified recovery point.
-- Internal tables below receive explicit deny-by-default API policies until
-- purpose-built staff/customer policies are implemented and tested.

BEGIN;

-- 1) Explicit deny-by-default policies for tables that previously had no policy.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'audit_logs',
    'customer_otp_codes',
    'customers',
    'inventory_movements',
    'kitchen_stations',
    'kitchen_ticket_items',
    'login_rate_limits',
    'loyalty_rewards',
    'loyalty_stamps',
    'menu_item_addons',
    'notification_delivery_logs',
    'notifications',
    'order_item_addons',
    'order_status_history',
    'qr_generation_logs',
    'qr_scan_logs',
    'recipe_ingredients',
    'recipes',
    'refunds',
    'role_permissions',
    'staff_roles',
    'suppliers',
    'waiter_assignments'
  ]
  LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = t
           AND policyname = 'deny_direct_api_until_scoped'
       )
    THEN
      EXECUTE format(
        'CREATE POLICY deny_direct_api_until_scoped ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
        t
      );
    END IF;
  END LOOP;
END
$$;

-- 2) Pin safe search_path for externally callable SECURITY DEFINER routines.
ALTER FUNCTION public.get_current_user_role()
  SET search_path = pg_catalog, public, auth, extensions, pg_temp;
ALTER FUNCTION public.generate_daily_qr_tokens(character varying)
  SET search_path = pg_catalog, public, extensions, pg_temp;
ALTER FUNCTION public.confirm_cash_payment(uuid, uuid, numeric, text)
  SET search_path = pg_catalog, public, auth, extensions, pg_temp;
ALTER FUNCTION public.generate_permanent_table_qr(character varying, uuid)
  SET search_path = pg_catalog, public, extensions, pg_temp;
ALTER FUNCTION public.server_calculate_order_totals(jsonb, numeric, numeric)
  SET search_path = pg_catalog, public, extensions, pg_temp;
ALTER FUNCTION public.get_table_daily_collection_summary(character varying, date)
  SET search_path = pg_catalog, public, auth, extensions, pg_temp;
ALTER FUNCTION public.settle_table_bill_and_close_session(character varying, uuid, uuid, numeric, character varying)
  SET search_path = pg_catalog, public, auth, extensions, pg_temp;
ALTER FUNCTION public.mark_table_cleaned(character varying, uuid)
  SET search_path = pg_catalog, public, auth, extensions, pg_temp;

-- QR verification is intentionally callable by guests who possess a physical
-- table QR. It validates the token in the database and returns only that table's
-- session context. All management/payment RPCs are closed until rewritten with
-- auth.uid()-based role checks (they currently trust caller-supplied staff IDs).
REVOKE ALL ON FUNCTION public.confirm_cash_payment(uuid, uuid, numeric, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_daily_qr_tokens(character varying)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_permanent_table_qr(character varying, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_table_daily_collection_summary(character varying, date)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_table_bill_and_close_session(character varying, uuid, uuid, numeric, character varying)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_table_cleaned(character varying, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.server_calculate_order_totals(jsonb, numeric, numeric)
  FROM PUBLIC, anon, authenticated;

-- The role helper is used by authenticated RLS expressions only.
REVOKE ALL ON FUNCTION public.get_current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;

-- Public QR scan remains available to guests; all other functions above are
-- intentionally not callable until their authorization contract is hardened.
REVOKE ALL ON FUNCTION public.verify_table_qr_token(text, text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_table_qr_token(text, text, text)
  TO anon, authenticated;

COMMIT;

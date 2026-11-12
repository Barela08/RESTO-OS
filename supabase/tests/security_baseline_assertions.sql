-- Assertions for the security-baseline migration, on disposable CI PostgreSQL only.
DO $$
DECLARE missing_count integer;
DECLARE fn record;
BEGIN
  SELECT count(*) INTO missing_count
  FROM unnest(ARRAY[
    'audit_logs','customer_otp_codes','customers','inventory_movements',
    'kitchen_stations','kitchen_ticket_items','login_rate_limits','loyalty_rewards',
    'loyalty_stamps','menu_item_addons','notification_delivery_logs','notifications',
    'order_item_addons','order_status_history','qr_generation_logs','qr_scan_logs',
    'recipe_ingredients','recipes','refunds','role_permissions','staff_roles',
    'suppliers','waiter_assignments'
  ]) AS t(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname='public' AND p.tablename=t.name
      AND p.policyname='deny_direct_api_until_scoped'
  );
  IF missing_count <> 0 THEN
    RAISE EXCEPTION 'Expected deny policy missing on % tables', missing_count;
  END IF;

  IF has_function_privilege('anon','public.confirm_cash_payment(uuid,uuid,numeric,text)','EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute confirm_cash_payment';
  END IF;
  IF has_function_privilege('authenticated','public.settle_table_bill_and_close_session(character varying,uuid,uuid,numeric,character varying)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can execute untrusted settlement RPC';
  END IF;
  IF has_function_privilege('anon','public.rls_auto_enable()','EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute rls_auto_enable';
  END IF;
  IF NOT has_function_privilege('anon','public.verify_table_qr_token(text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'guest QR verification must remain executable by anon';
  END IF;
  IF NOT has_function_privilege('authenticated','public.get_current_user_role()','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated role helper grant missing';
  END IF;
  IF has_function_privilege('anon','public.get_current_user_role()','EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute authenticated role helper';
  END IF;

  FOR fn IN SELECT p.proname, p.proconfig
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.proname IN (
        'get_current_user_role','generate_daily_qr_tokens','confirm_cash_payment',
        'generate_permanent_table_qr','server_calculate_order_totals',
        'get_table_daily_collection_summary','settle_table_bill_and_close_session',
        'mark_table_cleaned'
      )
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM unnest(COALESCE(fn.proconfig, ARRAY[]::text[])) AS c
      WHERE c LIKE 'search_path=%'
    ) THEN
      RAISE EXCEPTION 'Function % has no pinned search_path', fn.proname;
    END IF;
  END LOOP;
END $$;

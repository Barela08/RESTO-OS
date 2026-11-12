-- Disposable PostgreSQL fixture for CI only. Never run against production.
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'audit_logs','customer_otp_codes','customers','inventory_movements',
    'kitchen_stations','kitchen_ticket_items','login_rate_limits','loyalty_rewards',
    'loyalty_stamps','menu_item_addons','notification_delivery_logs','notifications',
    'order_item_addons','order_status_history','qr_generation_logs','qr_scan_logs',
    'recipe_ingredients','recipes','refunds','role_permissions','staff_roles',
    'suppliers','waiter_assignments'
  ] LOOP
    EXECUTE format('CREATE TABLE public.%I (id bigint generated always as identity primary key)', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

CREATE FUNCTION public.get_current_user_role() RETURNS text
LANGUAGE sql SECURITY DEFINER AS $$ SELECT 'owner'::text $$;
CREATE FUNCTION public.generate_daily_qr_tokens(varchar) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN NULL; END $$;
CREATE FUNCTION public.confirm_cash_payment(uuid, uuid, numeric, text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN NULL; END $$;
CREATE FUNCTION public.generate_permanent_table_qr(varchar, uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN NULL; END $$;
CREATE FUNCTION public.server_calculate_order_totals(jsonb, numeric, numeric) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.get_table_daily_collection_summary(varchar, date) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.settle_table_bill_and_close_session(varchar, uuid, uuid, numeric, varchar) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN NULL; END $$;
CREATE FUNCTION public.mark_table_cleaned(varchar, uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN NULL; END $$;
CREATE FUNCTION public.rls_auto_enable() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN NULL; END $$;
CREATE FUNCTION public.verify_table_qr_token(text, text, text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER AS $$ SELECT '{}'::jsonb $$;

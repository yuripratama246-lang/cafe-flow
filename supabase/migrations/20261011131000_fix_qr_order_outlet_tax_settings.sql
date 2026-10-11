DO $migration$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'create_qr_order'
    AND pg_get_function_identity_arguments(p.oid) = 'p_order jsonb, p_items jsonb';

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'Function public.create_qr_order(jsonb, jsonb) not found';
  END IF;

  IF position('ORDER BY os.created_at DESC LIMIT 1' in v_definition) = 0 THEN
    RAISE EXCEPTION 'Expected outlet settings selection was not found; refusing unsafe replacement';
  END IF;

  v_definition := replace(
    v_definition,
    'ORDER BY os.created_at DESC LIMIT 1',
    'ORDER BY os.updated_at DESC NULLS LAST, os.created_at DESC LIMIT 1'
  );
  EXECUTE v_definition;
END
$migration$;
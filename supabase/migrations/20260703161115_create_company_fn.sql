
CREATE OR REPLACE FUNCTION public.create_company(
  p_name         text,
  p_name_ar      text,
  p_business_type text,
  p_country      text,
  p_phone        text,
  p_currency     text,
  p_language     text,
  p_timezone     text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_user_id    uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  INSERT INTO public.companies (
    name, name_ar, business_type, country, phone,
    currency, language, timezone, owner_id
  ) VALUES (
    p_name, p_name_ar, p_business_type, p_country, p_phone,
    p_currency, p_language, p_timezone, v_user_id
  ) RETURNING id INTO v_company_id;

  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (v_company_id, v_user_id, 'owner');

  RETURN v_company_id;
END;
$$;

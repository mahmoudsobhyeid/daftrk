
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='companies' AND column_name='commercial_registration') THEN
    ALTER TABLE public.companies ADD COLUMN commercial_registration text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='companies' AND column_name='invoice_prefix') THEN
    ALTER TABLE public.companies ADD COLUMN invoice_prefix text NOT NULL DEFAULT 'INV';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='companies' AND column_name='invoice_footer') THEN
    ALTER TABLE public.companies ADD COLUMN invoice_footer text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='companies' AND column_name='invoice_theme') THEN
    ALTER TABLE public.companies ADD COLUMN invoice_theme text NOT NULL DEFAULT 'classic';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='companies' AND column_name='primary_color') THEN
    ALTER TABLE public.companies ADD COLUMN primary_color text NOT NULL DEFAULT '#2563eb';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_public_invoice(p_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result json;
BEGIN
  SELECT json_build_object(
    'id', i.id, 'company_id', i.company_id, 'customer_id', i.customer_id,
    'number', i.number, 'status', i.status,
    'issue_date', i.issue_date, 'due_date', i.due_date,
    'subtotal', i.subtotal, 'tax_total', i.tax_total,
    'discount_total', COALESCE(i.discount_total, 0),
    'total', i.total,
    'notes', i.notes, 'terms', i.terms,
    'template', COALESCE(i.template, 'classic'),
    'share_token', i.share_token, 'created_at', i.created_at,
    'company', json_build_object(
      'id', co.id, 'name', co.name, 'name_ar', co.name_ar,
      'address', co.address, 'phone', co.phone, 'email', co.email,
      'tax_number', co.tax_number, 'logo_path', co.logo_path, 'currency', co.currency,
      'primary_color', COALESCE(co.primary_color, '#2563eb'),
      'invoice_footer', co.invoice_footer
    ),
    'customer', CASE WHEN c.id IS NULL THEN NULL ELSE json_build_object(
      'id', c.id, 'name', c.name, 'name_ar', c.name_ar,
      'address', c.address, 'phone', c.phone, 'email', c.email, 'tax_number', c.tax_number
    ) END,
    'items', COALESCE((
      SELECT json_agg(json_build_object(
        'id', ii.id, 'description', ii.description,
        'quantity', ii.quantity, 'unit_price', ii.unit_price,
        'discount', COALESCE(ii.discount, 0),
        'tax_rate', ii.tax_rate, 'line_total', ii.line_total
      ) ORDER BY ii.created_at)
      FROM public.invoice_items ii WHERE ii.invoice_id = i.id
    ), '[]'::json)
  ) INTO v_result
  FROM public.invoices i
  LEFT JOIN public.customers c ON c.id = i.customer_id
  LEFT JOIN public.companies co ON co.id = i.company_id
  WHERE i.share_token = p_token;

  RETURN v_result;
END;
$$;

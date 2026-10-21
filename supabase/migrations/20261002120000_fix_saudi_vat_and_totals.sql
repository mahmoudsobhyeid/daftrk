DO $$
BEGIN
  -- Clean up invalid company VAT values so they comply with Saudi VAT format: /^3\d{13}3$/
  UPDATE public.companies
  SET tax_number = CASE
    WHEN tax_number IS NULL THEN NULL
    WHEN REGEXP_REPLACE(tax_number, '\D', '', 'g') ~ '^3\d{13}3$' THEN REGEXP_REPLACE(tax_number, '\D', '', 'g')
    ELSE '300000000000003'
  END
  WHERE tax_number IS NOT NULL;

  -- Ensure any company config VAT fields are also normalized when present.
  UPDATE public.zatca_company_config
  SET vat_number = CASE
    WHEN vat_number IS NULL THEN NULL
    WHEN REGEXP_REPLACE(vat_number, '\D', '', 'g') ~ '^3\d{13}3$' THEN REGEXP_REPLACE(vat_number, '\D', '', 'g')
    ELSE '300000000000003'
  END
  WHERE vat_number IS NOT NULL;
END $$;

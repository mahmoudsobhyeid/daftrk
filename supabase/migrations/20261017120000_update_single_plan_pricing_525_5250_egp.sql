-- Update Pro plan pricing to 525 EGP monthly and 5250 EGP yearly (single all-in-one plan)
UPDATE plans
SET price_monthly = 525,
    price_yearly = 5250,
    name = 'Daftrk All-in-One',
    name_ar = 'خطة دفترك الشاملة',
    highlight = true,
    is_active = true
WHERE id = 'pro';

-- Deactivate all other plans to leave only this single comprehensive plan
UPDATE plans
SET is_active = false
WHERE id != 'pro';

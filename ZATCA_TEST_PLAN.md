# ZATCA Integration - Comprehensive Test Plan

## Test Environment Setup

**Requirements:**
- Test company with valid tax number (15 digits starting/ending with 3)
- National address filled out completely
- ZATCA sandbox credentials (when available)
- 2-3 test users with different company access

---

## Test Scenarios

### 1. QR Code Auto-Generation ✅

**Scenario**: Create new invoice, verify QR code appears immediately

**Steps**:
1. Log in to test account
2. Go to Invoices → Create New Invoice
3. Select customer, add items (min 2 line items)
4. Click Save
5. Wait for save confirmation
6. Return to invoice preview/view
7. **Verify**: QR code visible in preview (150x150px minimum)
8. **Verify**: QR code not showing "No QR" placeholder

**Expected Result**: QR code visible and scannable

**Actual Result**: [To be filled after testing]

**Pass/Fail**: [ ] Pass [ ] Fail

---

### 2. QR Code in Print View ✅

**Scenario**: Verify QR code displays when printing invoice

**Steps**:
1. Open created invoice
2. Click Print button (or Ctrl+P)
3. Select invoice template from dropdown
4. **Verify**: QR code appears in print preview
5. Print to PDF
6. Open PDF, zoom in on QR area
7. **Verify**: QR code crisp and scannable

**Expected Result**: QR visible in all 4 templates (Classic, Modern, Minimal, Saudi Professional)

**Actual Result**: [To be filled after testing]

**Pass/Fail**: [ ] Pass [ ] Fail

---

### 3. QR Code Scanning ✅

**Scenario**: Scan QR code from mobile device, verify data

**Steps**:
1. Display invoice with QR code on screen
2. Open mobile device camera app or QR scanner
3. Point camera at QR code
4. **Verify**: QR code recognized (typically shows company name, VAT, total)
5. Tap notification (if any) to open data
6. **Verify**: Data is readable (sellerName, VAT number, timestamp, total, VAT total)

**Expected Result**: QR scans without errors

**Actual Result**: [To be filled after testing]

**Pass/Fail**: [ ] Pass [ ] Fail

---

### 4. ZATCA Settings Panel - Onboarding ✅

**Scenario**: Access ZATCA settings, verify all UI elements present

**Steps**:
1. Go to Settings → ZATCA tab
2. **Verify**: Status card shows "Not Configured"
3. **Verify**: Device Configuration section visible with:
   - Device Name input
   - Environment selector (Sandbox/Production)
   - Device Status info (empty initially)
4. **Verify**: OTP & Onboarding section visible with:
   - "Enter OTP" button (disabled)
   - Explanatory text
5. **Verify**: Certificate Management section (hidden until connected)
6. **Verify**: Audit Log section visible
7. **Verify**: All icons and colors render correctly

**Expected Result**: All UI elements present and functional

**Actual Result**: [To be filled after testing]

**Pass/Fail**: [ ] Pass [ ] Fail

---

### 5. OTP Input Masking ✅

**Scenario**: Enter OTP, verify it's masked and cleared after submission

**Steps**:
1. Go to Settings → ZATCA tab
2. Click "Generate CSR" button (generates mock CSR for testing)
3. Click "Enter OTP" button
4. **Verify**: Modal opens with OTP input field
5. **Verify**: Input field is type="password" (shows dots)
6. Type "123456" in OTP field
7. **Verify**: Only dots visible, no actual digits
8. Click eye icon to toggle show/hide
9. **Verify**: Text revealed (shows "123456")
10. Click eye icon again
11. **Verify**: Masked again (shows dots)
12. Click "Cancel" button
13. **Verify**: OTP field is cleared, modal closes
14. **Verify**: No OTP visible in browser console or network requests

**Expected Result**: OTP masked, no leakage in logs/network/console

**Actual Result**: [To be filled after testing]

**Pass/Fail**: [ ] Pass [ ] Fail

---

### 6. Invoice Type Detection ✅

**Scenario**: Create simplified and standard invoices, verify correct type code

**Steps**:
1. Create invoice as "Simplified" (B2C)
2. Issue ZATCA → **Verify**: `invoice_type_code` = '388' or appropriate for simplified
3. Create invoice as "Standard" (B2B)
4. Issue ZATCA → **Verify**: `invoice_type_code` = correct value
5. Query database: `SELECT invoice_type, invoice_type_code, invoice_subtype FROM invoices`
6. **Verify**: All 3 fields populated correctly

**Expected Result**: Invoice types correctly encoded

**Actual Result**: [To be filled after testing]

**Pass/Fail**: [ ] Pass [ ] Fail

---

### 7. VAT Calculations ✅

**Scenario**: Verify VAT is calculated correctly for different scenarios

**Steps**:
1. Create invoice with line item: $100, tax_rate=15% (Standard)
   - **Verify**: VAT = $15, Total = $115
2. Create invoice with line item: $100, tax_rate=0% (Zero-rated)
   - **Verify**: VAT = $0, Total = $100
3. Create invoice with discount: $100, discount=10%, tax=15%
   - **Verify**: Net = $90, VAT = $13.50, Total = $103.50
4. Issue all invoices to ZATCA
5. Query `invoice_items`: **Verify** `vat_amount`, `net_amount`, `gross_amount` correct

**Expected Result**: All VAT scenarios calculated correctly

**Actual Result**: [To be filled after testing]

**Pass/Fail**: [ ] Pass [ ] Fail

---

### 8. Audit Logging ✅

**Scenario**: Verify audit logs record ZATCA operations safely

**Steps**:
1. Perform CSR generation
2. Query `zatca_audit_log` table
3. **Verify**: Entry exists with action='csr_generated'
4. **Verify**: `details` JSON contains safe info (no private key, no OTP)
5. **Verify**: `created_at` is recent timestamp
6. **Verify**: `performed_by` is current user
7. Perform OTP verification (even if fails)
8. **Verify**: Log entry exists
9. **Verify**: `error_message` is safe (no OTP, no raw error traces)
10. Check database logs for OTP text
11. **Verify**: OTP not present anywhere in logs

**Expected Result**: Audit trail clean, no secrets exposed

**Actual Result**: [To be filled after testing]

**Pass/Fail**: [ ] Pass [ ] Fail

---

### 9. Tenant Isolation ✅

**Scenario**: Verify Company A cannot access Company B's ZATCA data

**Setup**: 
- Create 2 test companies: CompanyA & CompanyB
- Create users: UserA (owner of CompanyA), UserB (owner of CompanyB)

**Steps**:
1. Log in as UserA
2. Go to Settings → ZATCA tab
3. Create CSR for CompanyA (mock for testing)
4. Note the `id` from `zatca_company_config` table for CompanyA
5. Log out, log in as UserB
6. Try to access CompanyA's ZATCA config via:
   - Direct URL navigation (if available)
   - API query to `zatca_company_config` filtering by CompanyA id
7. **Verify**: Access denied (403 or 404)
8. Go to Settings → ZATCA for CompanyB
9. **Verify**: Only CompanyB's settings visible
10. Query `zatca_audit_log` as UserB
11. **Verify**: Only CompanyB's audit logs visible (RLS filters)
12. Try SQL injection: `SELECT * FROM zatca_company_config` as UserB
13. **Verify**: Only CompanyB's row returned (RLS enforced)

**Expected Result**: Perfect tenant isolation

**Actual Result**: [To be filled after testing]

**Pass/Fail**: [ ] Pass [ ] Fail

---

### 10. Invoice Locking ✅

**Scenario**: Verify issued invoices cannot be edited

**Steps**:
1. Create invoice
2. Issue to ZATCA (mock issuance)
3. Query `invoices`: **Verify** `is_locked = true`
4. Try to edit invoice via UI
5. **Verify**: Edit button disabled or error message shown
6. Try to delete line items
7. **Verify**: Cannot modify items
8. Try to change invoice date/total/customer
9. **Verify**: Changes blocked or reverted

**Expected Result**: Issued invoices immutable

**Actual Result**: [To be filled after testing]

**Pass/Fail**: [ ] Pass [ ] Fail

---

### 11. ICV Chain Tracking ✅

**Scenario**: Verify Invoice Counter Value increments correctly

**Steps**:
1. Check `zatca_icv_sequence` table for test company
2. Note initial ICV value
3. Create & issue 3 invoices to ZATCA
4. Query `invoices` for these 3:
   - **Verify**: ICV values are sequential (e.g., 1, 2, 3)
   - **Verify**: Each has unique `zatca_hash`
   - **Verify**: Each has previous invoice's hash in `zatca_prev_hash`
5. Check `zatca_icv_sequence`:
   - **Verify**: ICV incremented to 3
   - **Verify**: `prev_hash` matches last invoice's hash

**Expected Result**: ICV chain maintained correctly

**Actual Result**: [To be filled after testing]

**Pass/Fail**: [ ] Pass [ ] Fail

---

### 12. Network & Security ✅

**Scenario**: Verify no credentials/secrets leaked in network traffic

**Steps**:
1. Open Developer Tools → Network tab
2. Perform ZATCA operations (CSR, OTP, etc.)
3. Examine all HTTP requests/responses
4. **Verify**: No `privateKey` in request/response bodies
5. **Verify**: No `otp` in request/response bodies
6. **Verify**: No `csrData` in response (CSR only downloaded via file)
7. Check Response headers
8. **Verify**: No sensitive info in X-* headers
9. Inspect WebSocket connections (if any)
10. **Verify**: No secrets transmitted

**Expected Result**: Clean network traffic

**Actual Result**: [To be filled after testing]

**Pass/Fail**: [ ] Pass [ ] Fail

---

### 13. Error Handling ✅

**Scenario**: Verify graceful error handling for failures

**Steps**:
1. Disconnect internet, try CSR generation
2. **Verify**: Error message shown (not tech jargon)
3. **Verify**: No stack trace exposed
4. Reconnect internet, try again
5. **Verify**: Retry succeeds or shows helpful message
6. Try invalid OTP (e.g., "111111")
7. **Verify**: Error message "Invalid OTP" (not raw API error)
8. Try expired OTP
9. **Verify**: Error message "OTP Expired" (if tracked)
10. Simulate server error (mock or staging)
11. **Verify**: Generic error + suggestion to try again

**Expected Result**: User-friendly error messages

**Actual Result**: [To be filled after testing]

**Pass/Fail**: [ ] Pass [ ] Fail

---

## Test Sign-Off

| Test # | Scenario | Status | Notes |
|--------|----------|--------|-------|
| 1 | QR Auto-Generation | [  ] | |
| 2 | QR in Print View | [  ] | |
| 3 | QR Code Scanning | [  ] | |
| 4 | Settings Panel UI | [  ] | |
| 5 | OTP Masking | [  ] | |
| 6 | Invoice Type Detection | [  ] | |
| 7 | VAT Calculations | [  ] | |
| 8 | Audit Logging | [  ] | |
| 9 | Tenant Isolation | [  ] | |
| 10 | Invoice Locking | [  ] | |
| 11 | ICV Chain Tracking | [  ] | |
| 12 | Network Security | [  ] | |
| 13 | Error Handling | [  ] | |

**Overall Result**: [  ] All Pass [  ] Some Fail [  ] Blocked

**Tested By**: _______________  
**Date**: _______________  
**Environment**: [ ] Sandbox [ ] Staging [ ] Production  

**Sign-Off**:
- Developer: _________________ ✓  
- QA: _________________ ✓  
- Product: _________________ ✓  

---

## Production Deployment Approval

**Is this ready for production?**  
[ ] Yes - All tests passed, code reviewed, no blockers  
[ ] No - Issues found (see notes below)  
[ ] Conditional - Yes, with limitations (see notes below)  

**Notes**:
_______________________________________________________________________________

**Approved By**: _________________ Date: _______________

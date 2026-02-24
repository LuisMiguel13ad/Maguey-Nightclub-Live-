-- ============================================
-- Tighten payment_failures RLS policies
-- ============================================
-- Previously, any authenticated user could view ALL payment failures,
-- exposing Stripe IDs, customer emails, and payment amounts.
-- Now restricted to service_role only (accessed via Edge Functions / dashboard).
-- Owner dashboard reads payment data through authenticated Edge Functions
-- that use the service_role key, not direct client queries.

-- Drop overly permissive authenticated policies
DROP POLICY IF EXISTS "payment_failures_select_authenticated" ON payment_failures;
DROP POLICY IF EXISTS "payment_failures_update_authenticated" ON payment_failures;

-- Revoke direct authenticated access
REVOKE SELECT, UPDATE ON payment_failures FROM authenticated;

-- Service role retains full access (already exists, but ensure it's there)
DROP POLICY IF EXISTS "payment_failures_service_all" ON payment_failures;
CREATE POLICY "payment_failures_service_all" ON payment_failures
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Service role can insert from webhook handlers (already exists, but ensure it's there)
DROP POLICY IF EXISTS "payment_failures_insert_service" ON payment_failures;
CREATE POLICY "payment_failures_insert_service" ON payment_failures
  FOR INSERT TO service_role
  WITH CHECK (true);

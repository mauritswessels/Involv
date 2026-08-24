-- ============================================================
-- Admin RLS policies
-- ============================================================

-- Admins can read ALL opportunities regardless of status
-- (existing policy only exposes status = 'active' to everyone)
CREATE POLICY "Admins can read all opportunities"
  ON opportunities FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can update any profile (e.g. change a user's role)
-- The existing policy only allows users to update their own row.
CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

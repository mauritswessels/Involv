-- ============================================================
-- Migration: create profiles table
-- Stores the Involv-specific user profile for every auth user.
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id                  UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT        NOT NULL,
  email               TEXT        NOT NULL,
  role                TEXT        NOT NULL DEFAULT 'student'
                                  CHECK (role IN ('student', 'teacher', 'organizer', 'admin')),
  photo_url           TEXT,
  grade               TEXT        DEFAULT '',
  bio                 TEXT        DEFAULT '',
  interests           TEXT[]      DEFAULT '{}',
  career_goals        TEXT[]      DEFAULT '{}',
  skills              TEXT[]      DEFAULT '{}',
  availability        TEXT[]      DEFAULT '{}',
  preferred_categories TEXT[]     DEFAULT '{}',
  onboarding_complete BOOLEAN     DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Auto-update updated_at ──────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Row Level Security ──────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read any profile
-- (needed so organisers can see applicant names, etc.)
CREATE POLICY "Authenticated users can read profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can only insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Only admins can delete profiles (via service role in practice)
CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- Opportunities table
-- ============================================================

CREATE TABLE IF NOT EXISTS opportunities (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  title                TEXT        NOT NULL,
  category             TEXT        NOT NULL,
  short_description    TEXT        NOT NULL DEFAULT '',
  full_description     TEXT        NOT NULL DEFAULT '',
  organizer_name       TEXT        NOT NULL DEFAULT '',
  organizer_role       TEXT        NOT NULL DEFAULT '',
  organizer_email      TEXT        NOT NULL DEFAULT '',
  location_type        TEXT        NOT NULL DEFAULT 'On-campus',
  location_text        TEXT        NOT NULL DEFAULT '',
  dates                TEXT        NOT NULL DEFAULT '',
  time_commitment      TEXT        NOT NULL DEFAULT '',
  duration_type        TEXT        NOT NULL DEFAULT 'One-time',
  skill_level          TEXT        NOT NULL DEFAULT 'Beginner',
  impact_type          TEXT        NOT NULL DEFAULT 'Direct',
  skills_required      TEXT[]      NOT NULL DEFAULT '{}',
  min_grade_or_age     TEXT        NOT NULL DEFAULT '',
  language_requirements TEXT[]     NOT NULL DEFAULT '{}',
  positions_available  INTEGER     NOT NULL DEFAULT 1,
  application_deadline DATE        NOT NULL,
  start_date           DATE,
  skills_gained        TEXT[]      NOT NULL DEFAULT '{}',
  cv_relevance         TEXT        NOT NULL DEFAULT '',
  impact_description   TEXT        NOT NULL DEFAULT '',
  tags                 TEXT[]      NOT NULL DEFAULT '{}',
  featured             BOOLEAN     NOT NULL DEFAULT false,
  applicants_count     INTEGER     NOT NULL DEFAULT 0,
  status               TEXT        NOT NULL DEFAULT 'active'
                                   CHECK (status IN ('active','draft','closed','archived')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

-- Anyone (even unauthenticated) can read active opportunities
CREATE POLICY "Anyone can read active opportunities"
  ON opportunities FOR SELECT
  USING (status = 'active');

-- Authenticated users can create opportunities
CREATE POLICY "Authenticated users can create opportunities"
  ON opportunities FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Owners and admins can update their opportunities
CREATE POLICY "Owners can update their opportunities"
  ON opportunities FOR UPDATE
  TO authenticated
  USING (
    organizer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Owners and admins can delete their opportunities
CREATE POLICY "Owners can delete their opportunities"
  ON opportunities FOR DELETE
  TO authenticated
  USING (
    organizer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ============================================================
-- Applications table
-- ============================================================

CREATE TABLE IF NOT EXISTS applications (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id      UUID        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  opportunity_title   TEXT        NOT NULL DEFAULT '',
  applicant_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  applicant_name      TEXT        NOT NULL DEFAULT '',
  applicant_email     TEXT        NOT NULL DEFAULT '',
  organizer_id        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  grade               TEXT        NOT NULL DEFAULT '',
  motivation          TEXT        NOT NULL DEFAULT '',
  relevant_experience TEXT        NOT NULL DEFAULT '',
  availability        TEXT        NOT NULL DEFAULT '',
  status              TEXT        NOT NULL DEFAULT 'Pending'
                                  CHECK (status IN ('Pending','Under Review','Accepted','Rejected')),
  submitted_date      DATE        NOT NULL DEFAULT CURRENT_DATE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (opportunity_id, applicant_id)
);

CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Students can read their own applications
CREATE POLICY "Students can read own applications"
  ON applications FOR SELECT
  TO authenticated
  USING (
    applicant_id = auth.uid()
    OR organizer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Students can submit applications for themselves
CREATE POLICY "Students can create applications"
  ON applications FOR INSERT
  TO authenticated
  WITH CHECK (applicant_id = auth.uid());

-- Organizers can update status of applications for their opportunities
CREATE POLICY "Organizers can update application status"
  ON applications FOR UPDATE
  TO authenticated
  USING (
    organizer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ============================================================
-- Saved opportunities table
-- ============================================================

CREATE TABLE IF NOT EXISTS saved_opportunities (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id  UUID        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, opportunity_id)
);

ALTER TABLE saved_opportunities ENABLE ROW LEVEL SECURITY;

-- Users can only access their own saved opportunities
CREATE POLICY "Users manage own saved opportunities"
  ON saved_opportunities FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

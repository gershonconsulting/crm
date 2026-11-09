-- Additive change only. Apply once against a backed-up CRM database.
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_subject text;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_subject_unique ON users (google_subject);

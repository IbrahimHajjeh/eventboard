-- Run once on an existing database (safe to run twice).
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio    VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age    SMALLINT CHECK (age BETWEEN 13 AND 120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(6) CHECK (gender IN ('male', 'female'));

CREATE TABLE IF NOT EXISTS photos (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path       TEXT NOT NULL,
  caption    VARCHAR(200) NOT NULL DEFAULT '',
  visibility VARCHAR(7) NOT NULL DEFAULT 'friends' CHECK (visibility IN ('public', 'friends')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_photos_user ON photos(user_id, created_at DESC);

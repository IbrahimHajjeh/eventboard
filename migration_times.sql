-- Run once on an existing database: adds a finish time to every event.
ALTER TABLE events ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
UPDATE events SET ends_at = starts_at + interval '2 hours' WHERE ends_at IS NULL;   -- existing events get a 2-hour length
ALTER TABLE events ALTER COLUMN ends_at SET NOT NULL;
ALTER TABLE events ADD CONSTRAINT events_end_after_start CHECK (ends_at > starts_at);

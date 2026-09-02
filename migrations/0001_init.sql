-- One row per sync space. The space id is the SHA-256 of the personal code, so
-- the raw code is never stored and cannot be read back out of the database.
CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  bytes INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS spaces_updated_at ON spaces (updated_at);

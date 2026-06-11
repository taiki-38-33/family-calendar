-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  startTime TEXT,
  endTime TEXT,
  memo TEXT,
  createdBy TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

-- Create index for faster queries by date
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

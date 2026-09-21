-- Documents the schema that already existed in the TripFlow database
-- before the migration system was introduced (created by hand during
-- the early prototype phase).
--
-- Every statement uses IF NOT EXISTS, so:
--   - Running this against the current database is a safe no-op
--     (all four tables already exist with this exact structure).
--   - Running it against a fresh/empty database bootstraps the same
--     schema from scratch.
--
-- Column types, lengths, constraint names and ON DELETE behavior below
-- were read directly from the live database, not guessed.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_email_key UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title VARCHAR(150) NOT NULL,
  destination VARCHAR(150) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_trips_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS trip_days (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL,
  day_number INTEGER NOT NULL,
  date DATE NOT NULL,
  CONSTRAINT fk_trip_days_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT unique_trip_day UNIQUE (trip_id, day_number)
);

CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  trip_day_id INTEGER NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  location VARCHAR(255),
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_activities_trip_day FOREIGN KEY (trip_day_id) REFERENCES trip_days(id) ON DELETE CASCADE
);

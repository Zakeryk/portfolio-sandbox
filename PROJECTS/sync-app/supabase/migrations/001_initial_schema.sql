-- SYNC app initial schema
-- creates users, friendships, sync_requests tables
-- includes RLS policies for security

-- enable uuid extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- custom types
CREATE TYPE friendship_source AS ENUM ('contact', 'link');
CREATE TYPE sync_status AS ENUM ('seeking', 'matched', 'expired');
CREATE TYPE signal_type AS ENUM ('call', 'ping');

-- users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT username_format CHECK (username ~ '^[a-z0-9_]{3,20}$')
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_username ON users(username) WHERE username IS NOT NULL;

-- friendships table (mutual required)
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source friendship_source NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

CREATE INDEX idx_friendships_user ON friendships(user_id);
CREATE INDEX idx_friendships_friend ON friendships(friend_id);

-- sync_requests table (calls + pings)
CREATE TABLE sync_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type signal_type NOT NULL DEFAULT 'call',
  status sync_status DEFAULT 'seeking',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  matched_at TIMESTAMPTZ,
  CHECK (from_user_id != to_user_id),
  CHECK (expires_at > created_at)
);

CREATE INDEX idx_sync_requests_active ON sync_requests(to_user_id, type, status, expires_at)
  WHERE status = 'seeking';
CREATE INDEX idx_sync_requests_from ON sync_requests(from_user_id, type, status);

-- presence table (optional - can use supabase presence instead)
CREATE TABLE presence (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT false,
  last_heartbeat TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_presence_online ON presence(is_online, last_heartbeat);

-- RLS (row level security) policies

-- enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE presence ENABLE ROW LEVEL SECURITY;

-- users policies
CREATE POLICY "users can view their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "users can view friends' profiles"
  ON users FOR SELECT
  USING (
    id IN (
      SELECT friend_id FROM friendships WHERE user_id = auth.uid()
    )
  );

-- friendships policies
CREATE POLICY "users can view their friendships"
  ON friendships FOR SELECT
  USING (user_id = auth.uid() OR friend_id = auth.uid());

CREATE POLICY "users can create friendships"
  ON friendships FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can delete their friendships"
  ON friendships FOR DELETE
  USING (user_id = auth.uid());

-- sync_requests policies
CREATE POLICY "users can create sync requests"
  ON sync_requests FOR INSERT
  WITH CHECK (from_user_id = auth.uid());

CREATE POLICY "users can view their sent requests"
  ON sync_requests FOR SELECT
  USING (from_user_id = auth.uid());

CREATE POLICY "users can view requests sent to them"
  ON sync_requests FOR SELECT
  USING (to_user_id = auth.uid());

CREATE POLICY "users can update requests they're part of"
  ON sync_requests FOR UPDATE
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- presence policies
CREATE POLICY "users can view friends' presence"
  ON presence FOR SELECT
  USING (
    user_id IN (
      SELECT friend_id FROM friendships WHERE user_id = auth.uid()
    ) OR user_id = auth.uid()
  );

CREATE POLICY "users can update their own presence"
  ON presence FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can update their own presence"
  ON presence FOR UPDATE
  USING (user_id = auth.uid());

-- helper functions

-- function to check if two users are friends
CREATE OR REPLACE FUNCTION are_friends(user_a UUID, user_b UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships
    WHERE (user_id = user_a AND friend_id = user_b)
       OR (user_id = user_b AND friend_id = user_a)
  );
$$ LANGUAGE SQL STABLE;

-- function to clean up expired requests (run via cron or trigger)
CREATE OR REPLACE FUNCTION cleanup_expired_requests()
RETURNS void AS $$
  UPDATE sync_requests
  SET status = 'expired'
  WHERE status = 'seeking'
    AND expires_at < now();
$$ LANGUAGE SQL;

-- function to auto-update last_seen_at on user activity
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET last_seen_at = now()
  WHERE id = NEW.from_user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- trigger to update last_seen when user creates sync_request
CREATE TRIGGER update_user_last_seen
  AFTER INSERT ON sync_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_last_seen();

-- seed data (optional - for testing)
-- uncomment to add test users

-- INSERT INTO users (phone, display_name) VALUES
--   ('+11234567890', 'Alice'),
--   ('+10987654321', 'Bob');

-- INSERT INTO friendships (user_id, friend_id, source)
-- SELECT
--   u1.id, u2.id, 'contact'
-- FROM users u1, users u2
-- WHERE u1.phone = '+11234567890' AND u2.phone = '+10987654321';

-- INSERT INTO friendships (user_id, friend_id, source)
-- SELECT
--   u1.id, u2.id, 'contact'
-- FROM users u1, users u2
-- WHERE u1.phone = '+10987654321' AND u2.phone = '+11234567890';

-- ═══════════════════════════════════════════════════════
-- MindRush Arena — Supabase Database Setup
-- Safe to re-run
-- ═══════════════════════════════════════════════════════

-- ── 1. PROFILES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username     text        UNIQUE,
  xp           integer     NOT NULL DEFAULT 0,
  level        integer     NOT NULL DEFAULT 1,
  rank         text        NOT NULL DEFAULT 'Bronze',
  streak       integer     NOT NULL DEFAULT 0,
  last_login   date,
  total_games  integer     NOT NULL DEFAULT 0,
  best_score   integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Authenticated users: full read, own write
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- Anonymous (logged-out) visitors can read profiles for leaderboard
DROP POLICY IF EXISTS "profiles_select_anon" ON public.profiles;
CREATE POLICY "profiles_select_anon" ON public.profiles FOR SELECT TO anon USING (true);


-- ── 2. SCORES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scores (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  username   text,
  game_type  text        NOT NULL,
  score      integer     NOT NULL DEFAULT 0,
  xp_earned  integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- Authenticated users: full read, own write
DROP POLICY IF EXISTS "scores_select" ON public.scores;
CREATE POLICY "scores_select" ON public.scores FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "scores_insert" ON public.scores;
CREATE POLICY "scores_insert" ON public.scores FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Anonymous visitors can read scores for leaderboard
DROP POLICY IF EXISTS "scores_select_anon" ON public.scores;
CREATE POLICY "scores_select_anon" ON public.scores FOR SELECT TO anon USING (true);


-- Score value constraints — prevent cheating via direct API calls
ALTER TABLE public.scores DROP CONSTRAINT IF EXISTS scores_score_range;
ALTER TABLE public.scores ADD CONSTRAINT scores_score_range CHECK (score >= 0 AND score <= 50000);
ALTER TABLE public.scores DROP CONSTRAINT IF EXISTS scores_xp_range;
ALTER TABLE public.scores ADD CONSTRAINT scores_xp_range CHECK (xp_earned >= 0 AND xp_earned <= 10010);
ALTER TABLE public.scores DROP CONSTRAINT IF EXISTS scores_game_type_valid;
ALTER TABLE public.scores ADD CONSTRAINT scores_game_type_valid CHECK (game_type IN ('reaction', 'memory', 'logic', 'strategy'));


-- ── 3. ACHIEVEMENTS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.achievements (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id text        NOT NULL,
  unlocked_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "achievements_select" ON public.achievements;
CREATE POLICY "achievements_select" ON public.achievements FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "achievements_insert" ON public.achievements;
CREATE POLICY "achievements_insert" ON public.achievements FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());


-- ── 4. DAILY REWARDS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_rewards (
  id           uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid  REFERENCES auth.users(id) ON DELETE CASCADE,
  claimed_date date  NOT NULL,
  xp_awarded   integer NOT NULL DEFAULT 0,
  UNIQUE(user_id, claimed_date)
);

ALTER TABLE public.daily_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_select" ON public.daily_rewards;
CREATE POLICY "daily_select" ON public.daily_rewards FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "daily_insert" ON public.daily_rewards;
CREATE POLICY "daily_insert" ON public.daily_rewards FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());


-- ── 5. AUTO-CREATE PROFILE ON SIGNUP ────────────────────
-- Handles duplicate usernames by appending a number suffix
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  base_uname  text;
  final_uname text;
  counter     int := 0;
BEGIN
  base_uname  := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'username'), ''),
    split_part(NEW.email, '@', 1)
  );
  final_uname := base_uname;

  -- If username is taken, append 1, 2, 3... until unique
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_uname) LOOP
    counter     := counter + 1;
    final_uname := base_uname || counter::text;
  END LOOP;

  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, final_uname)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── 6. PROFILE INTEGRITY TRIGGER ────────────────────────
-- Prevents leaderboard cheating via direct API calls:
--   • XP can never decrease
--   • XP can only increase by at most 10,010 per update (max possible from one game)
--   • rank is always recomputed from XP — cannot be set manually
CREATE OR REPLACE FUNCTION public.enforce_profile_integrity()
RETURNS trigger AS $$
BEGIN
  -- Block XP from going backwards
  IF NEW.xp < OLD.xp THEN
    RAISE EXCEPTION 'XP cannot decrease';
  END IF;

  -- Block impossible XP jumps (max earned per game = floor(50000/5)+10 = 10010)
  IF NEW.xp - OLD.xp > 10010 THEN
    RAISE EXCEPTION 'XP gain exceeds maximum for a single game session';
  END IF;

  -- Always compute rank from XP — ignores whatever the client sent
  NEW.rank := CASE
    WHEN NEW.xp >= 30000 THEN 'Legend'
    WHEN NEW.xp >= 15000 THEN 'Master'
    WHEN NEW.xp >= 7500  THEN 'Diamond'
    WHEN NEW.xp >= 3500  THEN 'Platinum'
    WHEN NEW.xp >= 1500  THEN 'Gold'
    WHEN NEW.xp >= 500   THEN 'Silver'
    ELSE 'Bronze'
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_profile_integrity ON public.profiles;
CREATE TRIGGER trg_profile_integrity
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_integrity();


-- ── 6. INDEXES ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_scores_game_type  ON public.scores(game_type);
CREATE INDEX IF NOT EXISTS idx_scores_score      ON public.scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_user_id    ON public.scores(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_xp       ON public.profiles(xp DESC);


-- ── 7. GRANTS ────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL   ON public.profiles      TO authenticated;
GRANT ALL   ON public.scores        TO authenticated;
GRANT ALL   ON public.achievements  TO authenticated;
GRANT ALL   ON public.daily_rewards TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.scores   TO anon;

// Database Schema for ClearHead
// All tables for local encrypted SQLite storage

export const DATABASE_NAME = 'clearhead.db';

// SQL statements for table creation
export const CREATE_TABLES_SQL = `
-- Thoughts table for thinking engine
CREATE TABLE IF NOT EXISTS thoughts (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK(mode IN ('logical', 'brutal', 'reflective', 'action')),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Study topics for learning engine
CREATE TABLE IF NOT EXISTS study_topics (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  time_spent_minutes INTEGER NOT NULL DEFAULT 0,
  confidence_level INTEGER NOT NULL DEFAULT 50 CHECK(confidence_level >= 0 AND confidence_level <= 100),
  integrity_percent INTEGER NOT NULL DEFAULT 100,
  decay_state TEXT NOT NULL DEFAULT 'fresh' CHECK(decay_state IN ('fresh', 'unstable', 'decaying', 'neglected')),
  last_reviewed_at INTEGER,
  next_review_at INTEGER,
  review_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Revision history for spaced repetition
CREATE TABLE IF NOT EXISTS revisions (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES study_topics(id) ON DELETE CASCADE,
  scheduled_at INTEGER NOT NULL,
  completed_at INTEGER,
  was_missed INTEGER NOT NULL DEFAULT 0,
  confidence_before INTEGER,
  confidence_after INTEGER,
  created_at INTEGER NOT NULL
);

-- Tasks for cost-based planner
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  time_estimate_minutes INTEGER NOT NULL,
  decay_cost INTEGER NOT NULL DEFAULT 1,
  is_recovery INTEGER NOT NULL DEFAULT 0,
  original_task_id TEXT REFERENCES tasks(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'skipped')),
  scheduled_date TEXT,
  priority INTEGER CHECK(priority >= 1 AND priority <= 3),
  completed_at INTEGER,
  skipped_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Time blocks for planner
CREATE TABLE IF NOT EXISTS time_blocks (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  is_locked INTEGER NOT NULL DEFAULT 0,
  was_missed INTEGER NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Timeline entries (unified log)
CREATE TABLE IF NOT EXISTS timeline_entries (
  id TEXT PRIMARY KEY,
  entry_type TEXT NOT NULL CHECK(entry_type IN ('problem', 'study_session', 'missed_revision', 'planner_failure', 'thought')),
  reference_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  was_avoided INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Insights cache (weekly generated)
CREATE TABLE IF NOT EXISTS insights (
  id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL,
  week_end TEXT NOT NULL,
  insights_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Settings and preferences
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_thoughts_mode ON thoughts(mode);
CREATE INDEX IF NOT EXISTS idx_thoughts_created ON thoughts(created_at);
CREATE INDEX IF NOT EXISTS idx_topics_decay ON study_topics(decay_state);
CREATE INDEX IF NOT EXISTS idx_topics_next_review ON study_topics(next_review_at);
CREATE INDEX IF NOT EXISTS idx_revisions_topic ON revisions(topic_id);
CREATE INDEX IF NOT EXISTS idx_revisions_scheduled ON revisions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_blocks_date ON time_blocks(date);
CREATE INDEX IF NOT EXISTS idx_timeline_type ON timeline_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_timeline_created ON timeline_entries(created_at);
`;

// Types matching database schema
export interface Thought {
  id: string;
  mode: 'logical' | 'brutal' | 'reflective' | 'action';
  question: string;
  answer: string;
  created_at: number;
  updated_at: number;
}

export interface StudyTopic {
  id: string;
  topic: string;
  time_spent_minutes: number;
  confidence_level: number;
  integrity_percent: number;
  decay_state: 'fresh' | 'unstable' | 'decaying' | 'neglected';
  last_reviewed_at: number | null;
  next_review_at: number | null;
  review_count: number;
  created_at: number;
  updated_at: number;
}

export interface Revision {
  id: string;
  topic_id: string;
  scheduled_at: number;
  completed_at: number | null;
  was_missed: boolean;
  confidence_before: number | null;
  confidence_after: number | null;
  created_at: number;
}

export interface Task {
  id: string;
  name: string;
  time_estimate_minutes: number;
  decay_cost: number;
  is_recovery: boolean;
  original_task_id: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  scheduled_date: string | null;
  priority: 1 | 2 | 3 | null;
  completed_at: number | null;
  skipped_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface TimeBlock {
  id: string;
  task_id: string | null;
  start_time: number;
  end_time: number;
  is_locked: boolean;
  was_missed: boolean;
  date: string;
  created_at: number;
  updated_at: number;
}

export interface TimelineEntry {
  id: string;
  entry_type: 'problem' | 'study_session' | 'missed_revision' | 'planner_failure' | 'thought';
  reference_id: string | null;
  title: string;
  description: string | null;
  was_avoided: boolean;
  created_at: number;
}

export interface Insight {
  id: string;
  week_start: string;
  week_end: string;
  insights_json: string;
  created_at: number;
}

-- docs/superpowers/migrations/2026-07-15-chat-envelope-columns.sql
-- Run manually against prod Postgres (no migration framework exists in this repo).
ALTER TABLE communities ADD COLUMN chat_envelope_id text;
ALTER TABLE workgroups ADD COLUMN chat_envelope_id text;

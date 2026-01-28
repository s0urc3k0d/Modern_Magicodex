-- Safe no-op migration to bypass previous FTS cleanup
-- Intentionally left blank to avoid errors on missing FTS auxiliary tables.
SELECT 1;

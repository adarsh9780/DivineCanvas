// Move legacy notes out of likes atomically. Re-running this is safe and cannot restore deleted notes.
export const MIGRATE_NOTES_SQL = `
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS verse_notes (id TEXT PRIMARY KEY NOT NULL, note TEXT NOT NULL);
INSERT OR IGNORE INTO verse_notes (id, note) SELECT id, note FROM saves WHERE note <> '';
UPDATE saves SET note = '' WHERE note <> '';
COMMIT;
`;

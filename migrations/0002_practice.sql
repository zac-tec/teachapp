CREATE TABLE records_v2 (
 id TEXT PRIMARY KEY NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('lesson','topic','project','reflection','practice','leetcode')),
 payload TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 updated TEXT NOT NULL
);
INSERT INTO records_v2 SELECT * FROM records;
DROP TABLE records;
ALTER TABLE records_v2 RENAME TO records;
CREATE TABLE github_connections (user_sub TEXT PRIMARY KEY, login TEXT NOT NULL, token TEXT NOT NULL);
CREATE TABLE github_repos (full_name TEXT PRIMARY KEY, user_sub TEXT NOT NULL);

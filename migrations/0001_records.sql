CREATE TABLE records (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('lesson','topic','project','reflection')),
  payload TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated TEXT NOT NULL
);

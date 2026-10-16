CREATE TABLE IF NOT EXISTS "outbox_events" (
  "id" uuid PRIMARY KEY,
  "event" jsonb NOT NULL,
  "occurred_at" timestamp NOT NULL DEFAULT now(),
  "published_at" timestamp
);

CREATE INDEX IF NOT EXISTS "outbox_events_unpublished_idx"
  ON "outbox_events" ("occurred_at", "id")
  WHERE "published_at" IS NULL;

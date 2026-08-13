ALTER TABLE issue_media
ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_issue_media_issue_role_order
ON issue_media(
  issue_id,
  media_role,
  action_id,
  status,
  sort_order
);

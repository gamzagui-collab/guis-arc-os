ALTER TABLE safety_corrective_action_media
ADD COLUMN content_digest TEXT;

CREATE UNIQUE INDEX uq_safety_action_media_digest
ON safety_corrective_action_media(action_id, media_role, content_digest)
WHERE content_digest IS NOT NULL AND status = 'ACTIVE';

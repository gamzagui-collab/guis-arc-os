PRAGMA foreign_keys = OFF;

ALTER TABLE safety_corrective_actions ADD COLUMN completion_note TEXT;
ALTER TABLE safety_corrective_actions ADD COLUMN evidence_exception_reason TEXT;

CREATE TABLE safety_corrective_action_media_v2 (
 id TEXT PRIMARY KEY,
 action_id TEXT NOT NULL REFERENCES safety_corrective_actions(id),
 safety_case_id TEXT NOT NULL REFERENCES safety_cases(id),
 site_id TEXT NOT NULL REFERENCES sites(id),
 media_role TEXT NOT NULL CHECK(media_role IN ('BEFORE','AFTER','EVIDENCE','DOCUMENT','RECHECK')),
 source_type TEXT CHECK(source_type IS NULL OR source_type IN ('ISSUE_MEDIA','CONSTRUCTION_MEDIA','SAFETY_MEDIA')),
 source_media_id TEXT,
 original_key TEXT,
 thumbnail_key TEXT,
 original_name TEXT,
 mime_type TEXT,
 description TEXT,
 location_id TEXT REFERENCES site_locations(id),
 sort_order INTEGER NOT NULL DEFAULT 0,
 uploaded_by_user_id TEXT NOT NULL REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','DELETED')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(source_media_id IS NOT NULL OR (original_key IS NOT NULL AND thumbnail_key IS NOT NULL)),
 UNIQUE(action_id,source_type,source_media_id,media_role)
);

INSERT INTO safety_corrective_action_media_v2
(id,action_id,safety_case_id,site_id,media_role,source_type,source_media_id,original_key,thumbnail_key,original_name,mime_type,description,uploaded_by_user_id,status,created_at)
SELECT id,action_id,safety_case_id,site_id,media_role,source_type,source_media_id,original_key,thumbnail_key,original_name,mime_type,description,
 COALESCE(uploaded_by_user_id,(SELECT created_by_user_id FROM safety_corrective_actions WHERE id=action_id)),status,created_at
FROM safety_corrective_action_media;

DROP TABLE safety_corrective_action_media;
ALTER TABLE safety_corrective_action_media_v2 RENAME TO safety_corrective_action_media;

CREATE INDEX idx_safety_action_media_action ON safety_corrective_action_media(action_id,status,media_role,sort_order);
CREATE INDEX idx_safety_action_media_source ON safety_corrective_action_media(source_type,source_media_id,status);

ALTER TABLE periodic_task_instances ADD COLUMN scheduled_period TEXT;
ALTER TABLE periodic_task_instances ADD COLUMN recurrence_type TEXT CHECK(recurrence_type IS NULL OR recurrence_type IN ('DAILY','WEEKLY','MONTHLY','QUARTERLY','SEMIANNUAL','YEARLY','SPECIFIC_DATE','PROCESS_BEFORE','PROCESS_AFTER','MANUAL'));
ALTER TABLE periodic_task_instances ADD COLUMN generated_by TEXT NOT NULL DEFAULT 'ON_DEMAND' CHECK(generated_by IN ('ON_DEMAND','CATCH_UP','MANUAL'));

UPDATE periodic_task_instances
SET recurrence_type=(SELECT recurrence_type FROM periodic_task_definitions WHERE id=definition_id),
    scheduled_period=CASE
      WHEN (SELECT recurrence_type FROM periodic_task_definitions WHERE id=definition_id)='MONTHLY' THEN substr(scheduled_date_kst,1,7)
      WHEN (SELECT recurrence_type FROM periodic_task_definitions WHERE id=definition_id)='WEEKLY' THEN scheduled_date_kst
      ELSE scheduled_date_kst
    END
WHERE recurrence_type IS NULL OR scheduled_period IS NULL;

CREATE UNIQUE INDEX uq_periodic_instance_period ON periodic_task_instances(definition_id,scheduled_period);
CREATE INDEX idx_periodic_instances_recurrence ON periodic_task_instances(site_id,recurrence_type,scheduled_date_kst,status);

PRAGMA foreign_keys = ON;

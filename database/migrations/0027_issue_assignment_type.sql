ALTER TABLE issue_items ADD COLUMN assignment_type TEXT NOT NULL DEFAULT 'UNASSIGNED'
  CHECK(assignment_type IN ('CONTRACTOR','DIRECT','UNASSIGNED'));

UPDATE issue_items
SET assignment_type='CONTRACTOR'
WHERE contractor_company_id IS NOT NULL;

CREATE INDEX idx_issue_items_site_assignment_type
  ON issue_items(site_id,assignment_type,status,updated_at DESC);

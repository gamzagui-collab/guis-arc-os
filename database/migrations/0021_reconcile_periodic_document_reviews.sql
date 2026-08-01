-- Reconcile document review metadata left inconsistent by earlier periodic UI retries.
UPDATE periodic_task_documents
SET review_result = 'APPROVED',
    approved_by_user_id = (
      SELECT reviewed_by_user_id
      FROM periodic_task_instances
      WHERE periodic_task_instances.id = periodic_task_documents.task_instance_id
    ),
    approved_at = COALESCE(
      approved_at,
      (
        SELECT reviewed_at
        FROM periodic_task_instances
        WHERE periodic_task_instances.id = periodic_task_documents.task_instance_id
      )
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE task_instance_id IN (
  SELECT id
  FROM periodic_task_instances
  WHERE status = 'COMPLETED'
)
AND COALESCE(review_result, '') <> 'APPROVED';

UPDATE periodic_task_documents
SET review_result = 'REVISION_REQUESTED',
    approved_by_user_id = NULL,
    approved_at = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE task_instance_id IN (
  SELECT id
  FROM periodic_task_instances
  WHERE status = 'REVISION_REQUESTED'
)
AND COALESCE(review_result, '') <> 'REVISION_REQUESTED';

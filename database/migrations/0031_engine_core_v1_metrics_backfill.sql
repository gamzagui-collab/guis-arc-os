UPDATE engine_metrics
SET execution_count=evaluation_count,
    total_execution_time_ms=duration_ms_total,
    last_execution_time_ms=CASE WHEN evaluation_count>0 THEN CAST(duration_ms_total/evaluation_count AS INTEGER) ELSE NULL END,
    last_evaluated_at=updated_at
WHERE execution_count=0 AND evaluation_count>0;

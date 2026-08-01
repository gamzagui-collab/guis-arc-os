PRAGMA foreign_keys = ON;

DELETE FROM user_site_roles
WHERE status = 'ACTIVE'
  AND rowid NOT IN (
    SELECT MIN(rowid)
    FROM user_site_roles
    WHERE status = 'ACTIVE'
    GROUP BY user_id, role_id, site_id
  );

CREATE UNIQUE INDEX idx_user_site_roles_active_unique
ON user_site_roles(user_id, role_id, site_id)
WHERE status = 'ACTIVE';

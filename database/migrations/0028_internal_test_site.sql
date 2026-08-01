PRAGMA foreign_keys = ON;

ALTER TABLE sites ADD COLUMN purpose TEXT NOT NULL DEFAULT 'OPERATIONAL'
CHECK(purpose IN ('OPERATIONAL','INTERNAL_TEST'));

UPDATE sites
SET purpose='INTERNAL_TEST'
WHERE id IN ('e2e-v021-site-a','e2e-v021-site-b');

CREATE INDEX idx_sites_purpose_status ON sites(purpose,status);

CREATE TRIGGER memberships_site_purpose_insert_guard
BEFORE INSERT ON memberships
WHEN NEW.site_id IS NOT NULL
 AND EXISTS (
  SELECT 1
  FROM memberships existing
  JOIN sites existing_site ON existing_site.id=existing.site_id
  JOIN sites target_site ON target_site.id=NEW.site_id
  WHERE existing.user_id=NEW.user_id
    AND existing.status='ACTIVE'
    AND existing_site.purpose<>target_site.purpose
 )
 AND NOT EXISTS (
  SELECT 1
  FROM user_site_roles usr
  JOIN roles r ON r.id=usr.role_id
  WHERE usr.user_id=NEW.user_id
    AND usr.status='ACTIVE'
    AND r.code IN ('PLATFORM_OWNER','INTEGRATED_OWNER')
 )
BEGIN
 SELECT RAISE(ABORT,'MEMBERSHIP_SITE_PURPOSE_CONFLICT');
END;

CREATE TRIGGER memberships_site_purpose_update_guard
BEFORE UPDATE OF site_id,status ON memberships
WHEN NEW.site_id IS NOT NULL
 AND NEW.status='ACTIVE'
 AND EXISTS (
  SELECT 1
  FROM memberships existing
  JOIN sites existing_site ON existing_site.id=existing.site_id
  JOIN sites target_site ON target_site.id=NEW.site_id
  WHERE existing.user_id=NEW.user_id
    AND existing.id<>NEW.id
    AND existing.status='ACTIVE'
    AND existing_site.purpose<>target_site.purpose
 )
 AND NOT EXISTS (
  SELECT 1
  FROM user_site_roles usr
  JOIN roles r ON r.id=usr.role_id
  WHERE usr.user_id=NEW.user_id
    AND usr.status='ACTIVE'
    AND r.code IN ('PLATFORM_OWNER','INTEGRATED_OWNER')
 )
BEGIN
 SELECT RAISE(ABORT,'MEMBERSHIP_SITE_PURPOSE_CONFLICT');
END;

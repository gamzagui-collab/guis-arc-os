# Issue File Storage

Private Issue media is stored in the Integrated Integration R2 binding. D1 stores metadata and ownership references only; image BLOBs are forbidden.

Canonical keys:

- `sites/{siteId}/issues/{issueId}/original/{mediaId}`
- `sites/{siteId}/issues/{issueId}/thumbnail/{mediaId}`
- `sites/{siteId}/issues/{issueId}/action/{mediaId}`

Media reads pass through the authenticated Worker so entitlement, permission and selected-site scope are rechecked. Upload validation restricts content type and size. If database persistence fails after an object write, the Worker removes the orphaned object before returning an error.

## v0.2.2 failure evidence

Integration-only, disabled-by-default failure injection produced HTTP 502 for original upload, thumbnail-after-original upload and action-thumbnail upload. D1 read-back found zero failed Issue rows and zero failed media rows. The partial-object deletion path executed in the deployed Worker; independent remote bucket enumeration was unavailable, so orphan absence is not separately asserted. The injection flag was disabled after the test.

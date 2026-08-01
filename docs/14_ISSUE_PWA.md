# Issue PWA Contract

`/pwa/issues/new` opens the Issue registration experience inside the same Integrated shell and session. The manifest uses standalone display and Issue-specific identity assets.

The service worker caches only public shell assets. Authentication responses, protected APIs, issue records and photos are never cached. Form drafts may remain locally on the device; final submission is network-only and fails closed while offline. Reconnection never silently submits a draft.

The mobile form uses camera/file input, a client-generated thumbnail and explicit user submission. Controls meet the 44px minimum target and layouts must not overflow at 360px, 390px or 412px.

## v0.2.2 validation

The service worker still caches only the application shell and returns `OFFLINE_FINAL_SUBMIT_BLOCKED` for failed API network requests. The create UI checks `navigator.onLine`, preserves only an explicit local draft, and never fabricates an Issue ID or upload completion. Real DevTools network-offline execution was NOT_EXECUTED because the available browser controller had no network-emulation capability.

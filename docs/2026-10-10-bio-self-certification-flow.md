# BIO self-certification: review, attest, receipt

Direct build into the established Caastor Plex/mineral/graphite/cobalt system. User asked to replace the inline panel with a modal and make confirmation deliberate enough to count. No Inter, signature illustration, celebratory gradient, identity/KYC collection, or forced timer.

Research: Refero Aboard Document Review and Approval, flow 834 (three screens), and Fresha Client Waiver Completion, flow 2380 (nine screens). Retrieved full flows and visually inspected Aboard review screen and Fresha signature modal. This adapts review-before-approval and separate confirmation; it does not claim legal e-signature validity.

| Decision | Evidence | Reason |
|---|---|---|
| Single entry action, centered modal | User request; Fresha signature screen | Keep the BIO reading surface free of persistent declarations |
| Section selector with actual BIO content, sources and confidence | Aboard review screen | Place the object being approved beside the explicit review action |
| Seven section acknowledgements before declarations | User's requested meaningful friction; Fresha read/agree/sign sequencing | Require conscious review without repeating a full onboarding questionnaire |
| Show unresolved items and block required gaps | Existing server certification gate | Preserve uncertainty instead of treating a high score as verified truth |
| Signed-in identity and exact BIO version visible | Fresha signature identity preview; existing authenticated attestation schema | Explain what and whose confirmation is recorded, without collecting another name |
| Three unchecked declarations followed by explicit confirm action | Existing product policy; Fresha agreement step | No default consent; state briefing versus production consequences |
| Timestamped receipt, same-version checks, transactional record/unlock | Fresha completed timestamp; version-bound product contract | Make success trustworthy and reject stale approval |
| Plex UI type, hairline dividers, cobalt action/focus, mineral surface | Existing design system and prior Refero Workflow/Cron research | Maintain product visual consistency |

References: https://refero.design/flows/834 ; https://refero.design/pages/18fe2fd1-02f5-4d57-abf4-fd33a61f4017 ; https://refero.design/flows/2380 ; https://refero.design/pages/17fd7357-ad61-4c6e-94fa-c1edcb045a14 .

The standalone self-certify endpoint requires statement version 2, exact BIO ID/version, seven reviewed sections, and strict boolean declarations. Records store reviewed sections and declarations in review_capture alongside the existing actor, timestamp, payload hash, score and statement version. Shared discovery attestation continues to use its existing field review flow; both write an attestation and unlock briefing atomically through a service-only database function. Apply migration 20261010010000_bio_review_attestation.sql before deploying server changes.

Validation: 11 relevant Node tests pass, including stale-version, incomplete-review and strict-boolean regressions; production build and git diff --check pass. Local database transaction test verifies receipt metadata, successful unlock, stale rejection, failed-write rollback, and denied authenticated-role RPC execution; fixtures roll back. Browser QA checked all seven previews, review counter/gate, unchecked declarations, disabled final action, Escape dismissal, fresh unchecked state on reopen, and mobile layout at 390px with no modal/body horizontal overflow. QA did not self-certify the user's BIO. Screenshots: output/discovery-bio/bio-certification-confirm.png and bio-certification-mobile.png.

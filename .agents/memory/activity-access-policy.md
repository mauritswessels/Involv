---
name: Activity group access and rollout boundaries
description: Private project groups, access to historical activities, and independence from school OAuth rollout.
---

An Activity Hub is a private project group: accepted participants may read it, its approved teacher/organiser owner may manage it, and school admins may manage it. A teacher's role alone must not expose every project's participants. Rosters disclose names, not private application details.

**Why:** School activities involve student information; publishing a listing must not make its participant workspace public or disclose applications to unrelated educators.

**How to apply:** Derive membership from current Accepted applications and authority from current role plus ownership, not client-supplied flags or a stale token. Preserve current members' access to closed listings so they can read project history; revoking participation or management must remove the corresponding permissions.

Activity feature rollout must not force activation of the separately deferred school OAuth/signup hook and privileged-role reset.

**Why:** The institution must approve Google sign-in separately, while the user requested incremental backend development to proceed.

**How to apply:** Keep activity database protections independent of signup-hook activation. Do not add a production test-login bypass or weaken verified school identity requirements to make testing easier.

Service-hour claims need independent review: no actor, including an administrator, may review their own claim. Only approved amounts count as credited hours, and a review must reference the exact version displayed to the reviewer.

**Why:** These are school service-learning records, not casual counters. A silent edit after review or an approval of unseen changes would undermine the value of the record.

**How to apply:** Preserve reviewed claims and rejection reasons; resubmission creates a new claim rather than overwriting the decision. Protect activities with hour records from deletion and use close/archive for historical work. Broader corrections, certificates and account-retention policy need explicit workflows rather than ad hoc record edits.

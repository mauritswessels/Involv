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

A verified school member's own service ledger is personal history, independent
of current activity-group membership. Ending membership or closing an activity
must not hide their earned contributions, but must still revoke private group access.

**Why:** Students need an honest long-term record of their service without reopening
former groups or disclosing other students' information.

**How to apply:** Provide narrowly projected, read-only own-ledger access using
the current verified identity. Do not broaden activity table policies, accept a
client-selected student ID, or unlock former rosters, attendance, hubs or chats.

Group-message delivery must recheck current membership on the server, not expose
private payloads through a public broadcast and filter them only in the browser.
The initial rollout uses permission-checked polling so a separate Supabase
Realtime configuration is not required for this backend chunk.

**Why:** Activity development must remain independent of institutional OAuth
approval, and losing membership must remove access to future messages as well
as stored history.

**How to apply:** A later Realtime implementation needs equivalent private
channel authorization and revocation handling before replacing polling. Do not
add simulated presence indicators or claim immediate delivery while polling.

Service-hour corrections are a separate, reason-required management decision,
not a student edit or an exception allowing an admin to approve their own hours.
They may change the current reviewed amount or revoke/reinstate a decision, but
must preserve the original decision and each before/after correction. Existing
decisions at installation are labelled baselines, not reconstructed audit history.

**Why:** The user chose corrections with review history before certificates.
The current total must be correct without hiding who originally approved a claim
or implying that unrecorded earlier changes are known.

**How to apply:** Keep current-value exports distinct from full audit history.
Coordinate corrections and new claims against the same student's daily limit;
separate per-activity limits would let simultaneous changes over-credit a day.
Account-closure/anonymisation policy still requires its separate approval.

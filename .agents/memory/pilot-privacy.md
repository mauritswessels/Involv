---
name: Pilot privacy boundaries
description: Public listing contacts and safe operational diagnostics before student pilots.
---

Keep organiser management contact fields out of public catalogue responses and
change streams. Students use applications and authorised activity groups; retaining
an organiser contact for management does not make it public catalogue content.

**Why:** The user approved privacy/reliability work before inviting a first student
pilot. A UI-only hide would leave direct database reads and secondary definer
snapshots exposed. Publication column filtering should not be assumed to constrain
every Realtime decoder.

**How to apply:** Audit direct reads, definer RPC responses and published row events
together. Do not restore wildcard reads merely to fix a management form; keep the
private management fetch separate from shared listing caches.

Operational logs should use fixed categories and server request IDs, not raw
exceptions, request bodies or URLs, including path segments.

**Why:** Body-parser exception messages can embed submitted text, and URL paths
can contain student identifiers or tokens even after query-string removal.
Automatic request-completion logs and Express's final error handler can bypass
a sanitised custom log statement.

**How to apply:** Check the whole logging path, including partial responses and
automatic exception serializers. This does not retroactively purge historical logs.

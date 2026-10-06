---
name: ISZL school membership and trusted roles
description: User-approved school access scope and handling of privileged accounts.
---

Only verified emails with the exact domain `iszl.ch` may use signed-in Involv features. New users must start as students; administrators approve teacher and organiser privileges. Do not infer privileges from an email address or allow self-selection.

**Why:** The user explicitly requested ISZL-only access and chose fresh administrator approval for existing teachers/organisers. They confirmed a school account already has administrator access.

**How to apply:** Preserve school administrators during access changes. Existing teacher/organiser privileges require fresh approval, not automatic grandfathering. Keep database identity checks authoritative; Google’s domain hint and editable profile metadata are not proof of membership. Work on remaining backend features in separate chunks, not a broad rewrite.

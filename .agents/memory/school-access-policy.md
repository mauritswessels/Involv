---
name: ISZL school membership and trusted roles
description: User-approved school access scope and handling of privileged accounts.
---

Only verified emails with the exact domain `iszl.ch` may use signed-in Involv features. New users must start as students; administrators approve teacher and organiser privileges. Do not infer privileges from an email address or allow self-selection.

**Why:** The user explicitly requested ISZL-only access and chose fresh administrator approval for existing teachers/organisers. Do not assume a school administrator already exists; hosted account checks did not establish one.

**How to apply:** Preserve school administrators during access changes. Existing teacher/organiser privileges require fresh approval, not automatic grandfathering. Keep database identity checks authoritative; Google’s domain hint and editable profile metadata are not proof of membership. Work on remaining backend features in separate chunks, not a broad rewrite.

School Google Workspace accounts cannot authorize unapproved third-party OAuth apps.

**Why:** The user reported the institution blocks signups to unapproved websites; Google displayed an institutional administrator-review requirement (`access_not_configured`).

**How to apply:** Google sign-in needs institutional app approval. Distinguish this from the separate preview iframe error. Do not weaken school membership checks or manually mark users verified to get around the restriction. Any alternative school-email authentication should be permitted by school policy before school-wide use.

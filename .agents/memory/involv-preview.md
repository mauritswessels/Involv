---
name: Involv preview connectivity
description: How the imported Involv frontend behaves before its external data service is connected.
---

The public Involv pages should remain previewable without Supabase environment variables; authenticated and remote-data features can activate when the variables are supplied.

**Why:** The landing experience uses bundled mock content, so requiring external credentials at module load made the entire app crash before users could inspect the design.

**How to apply:** Keep external service initialization valid but optional, and short-circuit public aggregate requests when the service is not configured.
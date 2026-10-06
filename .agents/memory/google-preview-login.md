---
name: Google login in previews
description: Distinguishing Google iframe restrictions from OAuth audience configuration problems.
---

Google OAuth sign-in must run in a top-level browser page, not inside the embedded preview.

**Why:** The same Supabase-generated Google authorization request returned a normal sign-in page when sent as a document navigation, but Google's generic “403 … you do not have access to this page” when sent as an iframe navigation. That message alone is not evidence of a missing test user or an incorrect OAuth audience.

**How to apply:** When this error appears, check whether sign-in is embedded before changing Google Cloud configuration. Open embedded sign-in in a top-level tab synchronously from the user's click, handle blocked pop-ups explicitly, and preserve normal top-level navigation. A working provider sign-in page does not establish that account consent and callback/session creation have completed.

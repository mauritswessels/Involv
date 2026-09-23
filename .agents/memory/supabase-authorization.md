---
name: Direct Supabase authorization
description: Security rules for apps where the browser communicates directly with Supabase.
---

Treat every client-supplied role, owner ID, and relationship ID as untrusted. Enforce authorization and immutable ownership fields in RLS and database-side guards, not only in React routes or forms.

**Why:** Frontend controls can be bypassed. Same-table subqueries inside RLS policies can also trigger recursive policy evaluation, so protected helper functions are safer for role checks.

**How to apply:** Audit allowed and denied behavior for every role whenever profiles, ownership fields, or organizer/admin capabilities change. Keep browser keys limited to the anonymous key.
# Opening Involv from inside Toddle (LTI 1.3)

Involv is an **LTI 1.3 tool**. Once ISZL's Toddle admin adds it, Involv appears as
a tab in a Toddle course (for example the DP CAS or HSP Service course). Students
and teachers click it and arrive in Involv **already signed in**, with the same
ISZL account and no Google prompt.

Three people each do one part:

| Who | What | Where |
| --- | --- | --- |
| ISZL Toddle admin | Register Involv as a custom LTI 1.3 app | Toddle admin portal |
| You (site owner) | Paste Toddle's details into Vercel | Vercel → Environment Variables |
| You (site owner) | Check two Supabase settings (real site only) | Supabase dashboard |

Replace `involv.me` with your domain if it changes.

## 1. ISZL Toddle admin: add the app

Toddle → **Admin portal → Other settings → Integration → LTI apps → + Add → Add custom app**

- Programme/school: DP (and HSP if used). **LTI version: 1.3.** Name: **Involv**.
- **Initiate login URL:** `https://involv.me/api/lti/login`
- **Launch / redirect URL:** `https://involv.me/api/lti/launch`
- **Keyset URL (tool):** `https://involv.me/api/lti/jwks`
- **Target link URL:** `https://involv.me/dashboard`
- **Icon URL (optional):** `https://involv.me/favicon.png`
- **Custom parameters (optional):** `page=/browse` to open Involv on the opportunities list
  (other options: `/dashboard`, `/portfolio`, `/saved`).
- **Placement type:** **Course**, so it shows in the course navigation.
- **Grade passback:** off. **Roster access:** off. Involv doesn't use them.
- **Advanced → Launch type:** Basic launch. **Privacy level: Public.** This is required:
  it lets Toddle send each person's name and school email, which is how Involv knows who they are.
- Enable it, then add it to the CAS / service course(s).

When the app is saved, Toddle shows its **platform details**. Send these to the site owner:

- Issuer (platform ID) URL
- Login / authorisation URL
- Keyset URL (Toddle's)
- Client ID
- Deployment ID

None of these are secret, but keep them together so nothing gets mixed up.

## 2. Site owner: tell Involv about Toddle (Vercel)

Vercel → your project → **Settings → Environment Variables**. Add these for **Production**:

| Name | Value |
| --- | --- |
| `LTI_ISSUER` | Toddle's Issuer URL, exactly as shown |
| `LTI_CLIENT_ID` | Toddle's Client ID |
| `LTI_AUTH_URL` | Toddle's Login / authorisation URL |
| `LTI_JWKS_URL` | Toddle's Keyset URL |
| `LTI_DEPLOYMENT_IDS` | Toddle's Deployment ID (comma-separate if there are several) |
| `LTI_TOOL_URL` | `https://involv.me` |

For **real accounts** (after switching off demo mode, see [DEMO_MODE.md](./DEMO_MODE.md)) also add:

| Name | Value |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → **service_role** key. **Secret: only ever here, never in code or chat, and never with a `VITE_` prefix.** |

Then **Deployments → ⋯ → Redeploy**.

While the site is in **demo mode** you can leave out the service key. Toddle launches
then open the demo: Toddle teachers get the teacher view and students the student view.
This is a safe way for IT to try the integration before any real data is involved.

## 3. Site owner: Supabase (real site only)

- **Authentication → Providers → Email** must be **enabled**. Toddle sign-in uses a
  one-time email-type token behind the scenes; no emails are sent and the site shows
  no email login form. Keep "Confirm email" on.
- Keep the **Before User Created** hook enabled (see GO_LIVE.md): it still blocks any
  non-@iszl.ch account, whichever way someone arrives.

## What Involv checks on every launch

- The launch was started by the configured Toddle site and client ID.
- The identity token is signed with Toddle's published keys, is unexpired, is for Involv
  (audience), matches the one-time state cookie and nonce, comes from an allowed
  deployment, and is an LTI 1.3 resource launch.
- The person has an **@iszl.ch** email address.
- Redirects only ever go to pages inside Involv.

Toddle roles are **not** turned into Involv permissions: everyone arrives as their normal
Involv account, new accounts start as students, and only an Involv admin can make
someone a teacher or admin.

## If something goes wrong

| Message | Likely cause |
| --- | --- |
| "Toddle connection not set up yet" | The `LTI_*` variables are missing in Vercel, or the site wasn't redeployed after adding them. |
| "Unknown platform" / "Could not verify Toddle" | An `LTI_*` value doesn't exactly match Toddle (watch for trailing slashes). |
| "Toddle did not share your school email" | Privacy level in Toddle isn't **Public**. |
| "Sign-in timed out" | The browser blocked the sign-in cookie inside Toddle's frame (some Safari settings). Open from Toddle again; if it keeps happening, set the app to open in a new window in Toddle. |
| "Toddle sign-in is not fully set up" | Real site without `SUPABASE_SERVICE_ROLE_KEY` in Vercel. |

## For developers

- Server code: `api/_lib/lti.ts`, with endpoints `api/lti/{login,launch,jwks}.ts` (Vercel functions).
- Front end: `src/pages/LtiCompletePage.tsx` (route `/lti/complete`).
- Tests (simulated Toddle platform, no network): `pnpm --filter @workspace/involv test:lti`.
- `vercel.json` allows Toddle to frame the site (`frame-ancestors`) and keeps `/api/*` out of the page rewrite.
- Optional: set `LTI_PRIVATE_KEY` (PKCS#8 PEM) only if Toddle services such as roster access are ever enabled; the key set is empty otherwise.



## Plan: Redirect to Login After Email Confirmation

### Problem
When a user signs up and clicks the email confirmation link, the `emailRedirectTo` is set to `window.location.origin` which lands on `/` and then redirects to `/dashboard`. Since the user now has a valid session after confirming, they skip the login page entirely. The user wants confirmed users to land on the login page instead, so they explicitly sign in.

### Solution

#### 1. Update `Login.tsx` — Change `emailRedirectTo`
Set `emailRedirectTo` to `window.location.origin + '/login'` so the confirmation link sends users back to the login page.

#### 2. Update `Login.tsx` — Handle confirmation callback
When the user arrives at `/login` after clicking the confirmation link, the URL contains auth tokens in the hash. The `onAuthStateChange` listener in `AuthContext` will pick up the session automatically. To prevent auto-login and force the user to sign in manually:
- Detect the `access_token` / `type=signup` in the URL hash on the Login page.
- If detected, call `supabase.auth.signOut()` to clear the auto-created session, show a success toast ("Email confirmed! Please sign in."), and clear the URL hash.

#### 3. Update `AuthContext.tsx` — No changes needed
The existing auth listener will handle the signout gracefully, resetting state to logged-out.

### Files Changed
- **`src/pages/Login.tsx`** — Update `emailRedirectTo` to `/login`, add `useEffect` to detect confirmation callback, sign out, and show toast.


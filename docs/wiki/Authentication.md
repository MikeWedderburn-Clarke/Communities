# Authentication

Authentication is handled by **NextAuth.js v5**.

## Local development — mock auth

Set `MOCK_AUTH=true` in `.env.local` to enable a dev user-picker login page. This lets you switch between seeded test users without any passwords or external identity provider.

```env
MOCK_AUTH=true
```

The seeded users (added by `npm run db:seed`) include a regular user and an admin. The login page shows an admin badge for admin accounts.

## Production — Microsoft Entra External ID

For production, configure Microsoft Entra External ID. Add the following to your environment:

```env
AUTH_MICROSOFT_ENTRA_ID_ID=<your-client-id>
AUTH_MICROSOFT_ENTRA_ID_SECRET=<your-client-secret>
AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://<tenant>.ciamlogin.com/<tenant-id>/v2.0
AUTH_SECRET=<random-secret>
```

See `.env.local.example` for the full list of required variables.

## Event visibility rules

| Viewer | What they can see |
|---|---|
| Public (no login) | Approved event details, attendee count, role distribution |
| Logged-in user | Above + names of attendees who opted in (`showName: true`) |
| Admin | Above + all attendees regardless of `showName`; pending/rejected events |
| Never public | Email addresses, pending/rejected events |

## Auth helper

Use `getCurrentUser()` from `src/lib/auth.ts` to retrieve the current session user in any Server Component or API route:

```ts
import { getCurrentUser } from '@/lib/auth';

const user = await getCurrentUser(); // returns SessionUser | null
```

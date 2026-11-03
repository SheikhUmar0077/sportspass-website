# Sportspass websites

This repository contains the four static Sportspass web experiences:

| Site | Source/build root | Firebase project |
|---|---|---|
| Main public website | `/` | `sportspass-28813` |
| Partner sign-in | `/partner` | `sportspass-28813` |
| Corporate sign-in | `/corporate` | `sportspass-28813` |
| Super Admin dashboard | `/admin` | `sportspass-28813` |

Each Cloudflare Pages project should use this same GitHub repository, the
matching source directory as its root, no build command, and `.` as its output
directory. The partner, corporate, and admin directories include their own
entry point and assets so they can be deployed independently at their respective
subdomains. Main-site business sign-in links point to the Partner and Corporate
custom domains.

Cloudflare Pages project settings, GitHub connections, DNS, and domain
verification are managed outside this repository. No Cloudflare configuration
or deployment is included here.

All web clients use Firebase project `sportspass-28813`. Web Firebase API
configuration is public client configuration, not an Admin SDK credential.
Never place service-account keys or privileged secrets in this repository.

## Login and backend authorization

- Partner and Corporate use Firebase email/password sign-in with no public
  registration. They use browser-session persistence, password visibility
  toggles, and a generic Firebase password reset response.
- After sign-in, `getBusinessDashboardAccess` checks the Firebase-authenticated
  UID against an active business account on the server. An account must be the
  only record for that UID in the requested collection and have `status:
  "active"`.
- The partner account UID is stored as `partners/{partnerId}.adminUid`. The
  corporate administrator UID is stored as `companies/{companyId}.adminUid`.
  Provision these fields only through a trusted operator/backend workflow.
  Partner accounts manage all branches; this implementation creates no staff
  accounts. Corporate employees continue using the customer app.
- The callable does not grant access based on a client role or custom claim.
  Firestore rules have no direct read/write grants for partner or company
  documents, so unimplemented dashboard data features must be added through
  separately authorized backend functions before exposing private data.
- The existing Admin dashboard remains under `admin/`; its trusted Super Admin
  checks and backend integration are kept separate from business login.

Backend source and local emulator instructions are in
[`../sportspass-app/functions/`](../sportspass-app/functions/) and
[`../sportspass-app/README.md`](../sportspass-app/README.md).

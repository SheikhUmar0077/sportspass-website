# Sportspass Super Admin Dashboard

This is the Phase 1 dashboard at the `admin.sportspass.pk` interface. It uses
the shared Firebase project, signs in with Firebase Authentication, and calls
trusted Cloud Functions for privileged reads and updates. It does not offer
administrator registration.

## Implemented

- Email/password sign-in with a short-lived browser session.
- Server-verified `superAdmin` custom claim and active administrator grant.
- Overview counts for partners, inquiries, companies, customers, memberships,
  check-ins, and verified payment revenue.
- Paginated lists for partners, companies, inquiries, customers, memberships,
  check-ins, and provisioned Super Admin accounts.
- Inquiry status updates and internal notes.
- Partner and company activation/suspension with audit records.
- Read-only customer and membership records.
- Responsive layouts, loading/error states, and empty states.

Dashboard data appears when documents exist in the collections and fields
listed below. Missing collections naturally show zero counts or empty lists;
the dashboard does not invent example records. Customer profiles can use the
existing `users/{uid}` documents. The other collections are part of the planned
platform data model and are not populated by this Phase 1 implementation.

| Collection | Fields used by the dashboard |
|---|---|
| `partners` | `status`, `createdAt`, `name`/`businessName`/`displayName`, `email`, `phone`, `address`, `registrationFeePaisa`, `monthlyFeePaisa` |
| `companies` | `status`, `createdAt`, `name`/`companyName`, `email`, `phone`, `address`, `employeeCount`, `monthlyFeePaisa` |
| `partnerInquiries` | `status`, `createdAt`, `firstName`, `lastName`, `email`, `facilityName`, `phone`, `state`, fee fields, `address` |
| `corporateInquiries` | `status`, `createdAt`, `firstName`, `companyName`, `employeeCount`, `email`, `phone`, `address` |
| `users` | Existing user profile fields, with optional `accountStatus` |
| `memberships` | `status`, `createdAt`, `userId`, `planId`, `type`, dates, pass counts, optional `companyId` |
| `checkIns` | `status`, `checkedInAt`, `userId`, `membershipId`, `partnerId`, `branchId`, optional `companyId` |
| `payments` | Verified records have `status: "verified"` and numeric `amountPaisa` |
| `superAdmins` | Created by trusted backend provisioning; `uid`, `email`, `status`, and `createdAt` |

Inquiry statuses are `new`, `contacted`, `under_review`, `approved`, and
`rejected`. Partner and company account statuses used by this dashboard are
`active`, `pending`, and `suspended`. Money fields use integer paisa.

## Local test

Prerequisites: Node.js 22, npm, Firebase CLI, and Python 3 (or another local
static-file server).

1. From the workspace root, open `sportspass-app` and install the Functions
   dependencies:

   ```powershell
   cd .\sportspass-app
   npm.cmd install --prefix functions
   ```

2. Start the Firebase Auth, Firestore, and Functions emulators from
   `sportspass-app`:

   ```powershell
   firebase.cmd emulators:start --only auth,firestore,functions --project sportspass-28813
   ```

3. In a second terminal, from the workspace root, serve the website repository:

   ```powershell
   cd .\sportspass-website
   python -m http.server 5500
   ```

4. Open `http://localhost:5500/admin/?emulator=1`. In the Auth Emulator UI at
   `http://localhost:4000/auth`, create the target test account and a separate
   existing operator account. Mark both accounts' email addresses as verified.
5. In a third terminal, from the workspace root, grant the target emulator
   account the Super Admin claim. Run this in PowerShell with the emulators
   still running:

   ```powershell
   cd .\sportspass-app
   $env:FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099"
   $env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
   $targetUid = "<target-account-uid-shown-in-the-Auth-emulator>"
   $targetEmail = "<target-account-email>"
   $operatorUid = "<operator-account-uid-shown-in-the-Auth-emulator>"
   node.exe .\functions\scripts\super-admin.js grant $targetUid $targetEmail --project sportspass-28813 --operator-uid $operatorUid
   ```

   `--project sportspass-28813` is required; the script rejects other project
   IDs and rejects conflicting `GCLOUD_PROJECT`, `GOOGLE_CLOUD_PROJECT`, or
   `FIREBASE_CONFIG` project settings. The target UID must exist and its email
   must match `$targetEmail`; a grant also requires the target email to be
   verified. `--operator-uid` must be the Firebase Auth UID of the existing,
   verified Super Admin/operator performing the grant—not the target account's
   UID. The script verifies that this operator account exists and has a
   verified email, but does not independently check its Super Admin claim or
   authorization. The emulators use local data and do not deploy or modify
   production Firebase resources.

## Production setup (not performed)

- Enable Email/Password sign-in in Firebase Authentication and add the
  production admin domain to Authorized Domains.
- Create the initial admin account through a trusted operator workflow and
  grant access with the script documented in
  [`../../sportspass-app/README.md`](../../sportspass-app/README.md).
- Deploy and verify the Functions and Firestore composite indexes from the
  `sportspass-app` repository. The existing Firestore rules are unchanged;
  privileged dashboard reads and writes go through the Admin SDK in
  authenticated, claim-checked Functions.
- Configure the Cloudflare Pages project to serve this `admin` directory at
  `admin.sportspass.pk`. Hosting and DNS settings are not in this repository.
- Set up monitoring and review the admin access process before giving access
  to production operators.

The Functions use the Admin SDK, which bypasses Firestore rules. Each callable
therefore checks the caller's custom claim and active `superAdmins` grant
itself, as well as a verified email. The provisioning script requires an
explicit UID/email match and refuses grants to unverified accounts. The
customer client and browser cannot grant or revoke administrator access. Admin
grants are provisioned only with a trusted server-side identity.

This phase does not implement the public inquiry forms, business account
creation, business sign-in, partner/corporate workflows, or customer-side
membership and QR operations. Those remain later phases.

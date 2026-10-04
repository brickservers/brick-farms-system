# BrickFarms DAP Production Readiness Audit

Date: 2026-06-17

## Fixed in the latest pass

- Access tokens now have refresh support, and frontend API requests retry once after a 401.
- Uploads and downloads also retry after refresh, covering Farm Plan CSV import/export.
- Tenant profile now returns the workspace name and logged-in user's display name.
- Farm Plans are available with CSV template download/upload. Uploaded activities create task records.
- Nigeria-aware farm creation has state and LGA dropdowns, while non-Nigeria farms use manual region fields.
- Worker creation uses a controlled role dropdown.
- Flutterwave v4 payment checkout and verification scaffolding is present server-side.
- Finance creation endpoints now default missing timestamps to `now()` instead of inserting null.

## Launch blockers

- Rotate and move all live secrets out of tracked/shared env files. Keep production secrets in `backend/.env.prod.local` or systemd environment only.
- Replace the production `JWT_SECRET` with a new long random value and force all users to log in again after rotation.
- Configure `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_PUBLIC_KEY`, webhook secret, and final live API base in production env.
- Complete Flutterwave webhook signature verification before relying on automatic paid plan activation.
- Confirm the full official Nigeria LGA catalogue. The current frontend data is practical for launch testing, but should be replaced with a verified complete dataset.
- Add tenant URL/domain enforcement so `/tenant-name/...`, subdomains, and custom domains are checked against the authenticated tenant.

## Security and reliability work remaining

- Move refresh tokens from localStorage to httpOnly secure cookies with token rotation and reuse detection.
- Add rate limiting for login, signup, password reset, CSV upload, and payment endpoints.
- Add audit logs for plan changes, user management, farm/plot deletion, payment verification, and settings changes.
- Add webhook idempotency for payment events.
- Add CSP/security headers at Apache or app level.
- Add automated encrypted database backups and restore drills.
- Add production monitoring for API errors, background jobs, mail delivery, SMS delivery, and payment failures.
- Add end-to-end tests for signup/login, tenant isolation, farms, plots, workers, assets, Farm Plans, settings, and payments.
- Add role-based permissions beyond basic tenant isolation, especially for finance, settings, team management, and plan changes.
- Add import validation reports for Farm Plan CSV rows instead of all-or-nothing feedback.

## Notes

- Official Flutterwave docs currently expose v4 charge endpoints such as `POST /charges` and `GET /charges/{id}`. The implementation keeps the API base configurable so live credentials can use the correct live base without code changes.
- The demo account should remain isolated from normal customer data and should not be used to validate paid plan behavior.

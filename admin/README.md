# Private administration

## Deployment prerequisites

`0003_admin.sql` is review-only and was not applied. Review and apply `0002_customer_journey.sql` first, then `0003_admin.sql`, using the owner-controlled database workflow. Add the owner's existing Auth UUID to `public.admins` manually. No browser can add an admin. Until those steps are complete, private pages fail closed and do not display data.

All browser queries use the existing publishable client and the current user's JWT. `public.is_admin()` is SECURITY INVOKER; its membership lookup is itself protected by RLS. Customers retain access to their own journey records from migration 0002; they cannot read inventory, settings, audit records, the notification queue or other customers' records. The owner can manage inventory/settings through Supabase. No new notification provider is introduced.

## Decisions requiring owner review

- Inventory starts at **20 Google and 20 Instagram** as requested; confirm the physical quantities before applying the migration.
- Reports use monthly **payment dates**, including orders that have progressed past `pago`, and São Paulo month boundaries (UTC-03, selectable from 2020 onward).
- Current settings apply a **15%** commission capped at **R$ 800 per month**. The settings table is read each time; historical commission settings are not snapshotted.
- A trusted insert trigger snapshots the approved prices in integer cents (9990 / 17990 / 29990). If earlier orders exist, the backfill uses these prices and must be reviewed against historical transactions. Future product-price changes require updating that insert trigger; existing snapshots are immutable.
- A customer-submitted plate link now remains pending until the owner verifies configuration. Changing an already configured link requests review again. The customer settings screen reads the returned status rather than assuming configuration is complete.
- Customer/address information shown in the detail is read from profiles/addresses; those tables contain current data, not historical delivery snapshots. Order business fields remain their own snapshots.
- Deletion remains manual. Completing a request only records the owner's confirmation; it does not delete data. Request UUIDs and dates survive Auth-account deletion with `user_id = null`. Audit details store status/quantity changes, not customer names or contact information.
- Admins create new orders unpaid and new plates pending. The normal customer RPC remains transactional. No browser can edit original product/quantities/prices, payment/shipping timestamps or admin membership.

## Validation

Run `node --test admin/tests/data.test.cjs` for access-gate, report arithmetic, pagination, CSV and concurrent review checks. These tests do **not** prove live RLS or trigger execution.

After the owner applies the reviewed migrations in a suitable test environment:

1. Verify logged-out and non-admin requests cannot fetch any administrative data; verify customers still see only their own journey.
2. Verify customers cannot update order/deletion/plate statuses, insert admin membership or read audit/settings/inventory/outbox.
3. Pay an order with its exact plate count and sufficient stock. Verify inventory, `paid_at`, audit rows and outbox commit together.
4. Attempt payment with insufficient stock or missing plates. Verify every write rolls back.
5. Attempt all invalid order transitions and repeated payment. Verify rejection and no duplicate stock decrement.
6. Run simultaneous payments against the last available stock. Verify at most one succeeds and stock never becomes negative.
7. Confirm a pending plate, then change its link as the customer. Verify it becomes pending again; a stale owner's reviewed-link update must fail.
8. Complete a deletion request after manual deletion. Verify its retained request and audit entry.
9. Compare a chosen month's report and CSV to paid orders in the database, including records beyond the first 1,000 rows.
10. Exercise all pages, confirmation dialogs, row selection, clipboard, mobile sheet, keyboard focus and dark mode at 390/768/1440px using real authorized data.

No live mutation or migration execution is part of generating these files.

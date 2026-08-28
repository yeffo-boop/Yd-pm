# YeffoHub — Permissions & Visibility Model (Phase 0)

Status: proposed. This document is the authorization contract every server
action, route handler, query, and background job must satisfy; the
authorization test suite introduced in Phase 1 is written directly against
it.

## 1. Roles (MVP)

- **OWNER** — exactly the operator account(s) YeffoDesign creates for
  itself. Full access to everything.
- **CLIENT** — a `ClientContact` linked to a `User`. Access is always scoped
  to a specific `ClientCompany` and, within it, to specific `Project`s.
  There is no "client admin" sub-role in v1: a primary contact and an
  additional contact have the same _capabilities_, differing only in which
  projects they can see (primary: all of their company's projects,
  implicitly; additional: only projects explicitly granted via
  `ProjectMembership`).

No employee/staff roles exist in v1 (explicit scope exclusion).

## 2. Core isolation rule

> A `CLIENT` user's every data access is first narrowed to "projects I have
> access to" (primary-contact implicit set ∪ explicit `ProjectMembership`
> grants), computed from the authenticated session's `ClientContact` row —
> **never** from a client-supplied ID, slug, or query parameter. Every
> service-layer read/write for a client-scoped resource re-derives this set
> and checks the target resource against it, even when the resource ID was
> just handed back by a previous "authorized" response. Guessing another
> company's project slug, file ID, comment ID, or notification ID must
> yield the same 404 a nonexistent ID would — never a 403 that confirms
> existence, and never a redirect or error message that leaks the target's
> name.

This rule is enforced once, in the service/repository layer, and route
handlers/server actions must not attempt their own parallel authorization
logic — a second, subtly different copy of "can this user see this row" is
exactly how isolation bugs happen (see `docs/security.md` §Threat model:
tenant isolation).

## 3. Capability matrix

Legend: **Y** = allowed, **Own** = allowed only within the user's
authorized scope (own company / granted projects), **N** = never, **N (UI+
API)** = enforced identically at both layers, not just hidden in the UI.

| Capability                                               | OWNER                                             | CLIENT                                                                                                                                     |
| -------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| View/manage inquiries & proposals                        | Y                                                 | N                                                                                                                                          |
| View/manage all client companies & contacts              | Y                                                 | N                                                                                                                                          |
| View own company's contacts                              | N/A (sees all)                                    | Own (read; edits limited to own profile)                                                                                                   |
| Grant/revoke additional-contact project access           | Y                                                 | N                                                                                                                                          |
| Create/archive projects                                  | Y                                                 | N                                                                                                                                          |
| View project overview                                    | Y                                                 | Own, **published fields only**                                                                                                             |
| View domain/hosting details                              | Y                                                 | N (never returned in any client-scoped query, response, export, or search index)                                                           |
| Edit phases/milestones/tasks (content, dates, order)     | Y                                                 | N                                                                                                                                          |
| Mark own assigned task complete                          | Y                                                 | Own, only tasks with `assignedClientContactId = self` and `isInternalOnly = false`                                                         |
| View internal-only tasks/notes                           | Y                                                 | N (N in UI **and** API)                                                                                                                    |
| Set milestone/phase/project visibility (draft↔published) | Y                                                 | N                                                                                                                                          |
| View draft (unpublished) phases/milestones/dates         | Y                                                 | N                                                                                                                                          |
| View calculated progress                                 | Y                                                 | Own, published scope only                                                                                                                  |
| Edit/override calculated progress                        | N (not editable by anyone — always derived)       | N                                                                                                                                          |
| Create/edit dependencies                                 | Y                                                 | N                                                                                                                                          |
| Trigger date change / dependency-shift preview & commit  | Y                                                 | N                                                                                                                                          |
| View date-change history                                 | Y                                                 | Own, for published items only                                                                                                              |
| Post project-thread messages                             | Y                                                 | Own project(s)                                                                                                                             |
| Post client-visible comments                             | Y                                                 | Own project(s), on resources they can see                                                                                                  |
| Post/view internal-only comments                         | Y                                                 | N                                                                                                                                          |
| Upload files                                             | Y                                                 | Own project(s), subject to size/MIME limits                                                                                                |
| View/download files                                      | Y                                                 | Own project(s), files with client-visible flag                                                                                             |
| Replace a file (new version)                             | Y                                                 | Own, only on assets where client upload is enabled for that folder/phase                                                                   |
| View file version history                                | Y                                                 | Own, client-visible versions only                                                                                                          |
| Request approval                                         | Y                                                 | N                                                                                                                                          |
| Record approval decision                                 | N (owner requests, doesn't decide their own work) | Own, on requests targeting their project                                                                                                   |
| View approval history                                    | Y                                                 | Own, for their project's requests                                                                                                          |
| Create/edit questionnaires (templates)                   | Y                                                 | N                                                                                                                                          |
| Fill out / submit questionnaire responses                | Y (on behalf of client, rare)                     | Own project(s)                                                                                                                             |
| Review/mark questionnaire responses reviewed             | Y                                                 | N                                                                                                                                          |
| Create/manage support tickets                            | Y (all)                                           | Own project(s)                                                                                                                             |
| Comment on support tickets                               | Y                                                 | Own, on their own tickets                                                                                                                  |
| Manage recurring maintenance templates                   | Y                                                 | N                                                                                                                                          |
| View in-app notifications                                | Y (own)                                           | Y (own)                                                                                                                                    |
| Manage own notification preferences                      | Y                                                 | Y, except essential/security types                                                                                                         |
| View client activity log (owner-only)                    | Y                                                 | N                                                                                                                                          |
| View system/security audit log                           | Y                                                 | N                                                                                                                                          |
| View client-facing shared activity feed                  | Y (all)                                           | Own, published events only                                                                                                                 |
| Configure templates, statuses/labels, reminder defaults  | Y                                                 | N                                                                                                                                          |
| Configure SMTP/integration secrets                       | Y (write-only; never read back to browser)        | N                                                                                                                                          |
| Search                                                   | Y (global)                                        | Own scope only, same visibility rules as direct access — a search result can never surface a draft/internal item or another company's data |

## 4. Publication / visibility model

A single explicit model, not scattered booleans with inconsistent meaning:

- `Project.isPublished` — gates whether the project appears to clients **at
  all**. An unpublished project (e.g., a draft created from an accepted
  proposal, still being scoped) is fully invisible to the client portal,
  search, notifications, and the client activity feed.
- `Phase.visibility` / `Milestone.visibility` / `Task.visibility` —
  `DRAFT | PUBLISHED`, independently settable per item once the parent
  project is published, so the owner can build out a phase privately before
  revealing it.
- `Task.isInternalOnly` — a second, orthogonal flag: even a published task
  can be marked internal-only (visible to the owner only, e.g., "confirm
  invoice sent" — administrative busywork that happens to live in the same
  task list). `isInternalOnly` always wins over `visibility = PUBLISHED`.
- `Comment.visibility` — `CLIENT_VISIBLE | INTERNAL_ONLY`, a real column,
  not a UI filter (§2, §5 both apply here).
- `FileAsset`/`FileVersion` visibility — same two-state model as tasks;
  internal work-in-progress files never appear in a client's file browser,
  search, or notifications.

**Rule:** every query that lists items for a client-facing surface
(dashboard, project view, search, notification fan-out, activity feed,
export) filters on these fields **in the query itself** (`WHERE
visibility = 'PUBLISHED' AND ...`), not by fetching everything and hiding
rows client-side. This is the concrete mechanism behind spec §5's
requirement that draft/internal data can't leak through counters, search,
URLs, notifications, exports, or page source.

## 5. Enforcement points (defense at every layer named in the spec)

Authorization is checked, independently, at:

1. **Service layer** (source of truth — repository queries are always
   pre-scoped to the caller's authorized set; this is what the isolation
   tests exercise directly, without going through HTTP).
2. **Server actions / route handlers** — re-derive the authenticated
   identity from the session on every call (never trust a client-supplied
   role/company/project field in the request body).
3. **Page/layout level** — a client hitting an owner route (or an owner's
   URL pattern with someone else's ID) gets redirected/404'd before any
   data fetch runs, as a defense-in-depth UX measure, not the primary
   control.
4. **Signed URL issuance** (files) — re-checked against current DB state at
   the moment of signing, not cached from an earlier check (`docs/security.md`
   §Files).
5. **Notification fan-out & search indexing** — built from the same
   service-layer scoped queries as direct reads, so they can't drift into a
   separate, unaudited code path.

## 6. Authorization test strategy (introduced Phase 1, extended every

phase that adds a resource type)

- Every new resource type ships with at least: (a) owner can access data
  scoped to itself, (b) client A can access their own authorized data, (c)
  client A **cannot** access client B's equivalent data via direct ID
  guessing on every read/write endpoint that touches it, (d) an
  unauthenticated request is rejected, (e) a disabled/former user's session
  is rejected.
- These tests run against the real service layer and a real (test)
  database — never against a mocked authorization check (per working rule
  "Do not mock away authorization in integration/end-to-end tests").

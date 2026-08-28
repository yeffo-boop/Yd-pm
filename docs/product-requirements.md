# YeffoHub — Product Requirements (MVP)

Status: Phase 0 draft, pending owner approval.

## 1. Product vision

YeffoHub is a self-hosted client and project management application for
YeffoDesign, a website-design business. It replaces ad-hoc email/spreadsheet
project tracking with a single system that manages the full lifecycle of a
website project: inquiry → proposal → onboarding → delivery phases →
deliverable review/approval → launch → post-launch support.

Two experiences ship in v1:

- **Owner/admin workspace** — the operator (currently a single owner, no
  staff/team roles in the MVP) manages inquiries, clients, projects,
  schedules, files, templates, notifications, and support.
- **Client portal** — each client company's contacts see only their own
  published project information: status, timeline, tasks assigned to them,
  files, and approval requests. They communicate, upload content, complete
  assigned tasks, and formally approve or request changes on deliverables.

## 2. Personas

| Persona                   | Description                                                                                                  | Primary goals                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Owner (Yeffo)             | Sole operator of YeffoDesign, `OWNER` role                                                                   | Track every project's health, never miss a deadline or a client message, keep client-facing info accurate, minimize manual coordination |
| Primary client contact    | Main point of contact at a client company, `CLIENT` role, automatic access to all of that company's projects | See progress, respond to requests, upload content, approve deliverables                                                                 |
| Additional client contact | A second/third stakeholder at a client company, `CLIENT` role, access limited to explicitly granted projects | Same actions as primary contact, scoped to granted projects only                                                                        |

Staff/employee roles are explicitly out of scope for v1 (see §3).

## 3. Scope boundaries

### In scope (v1 / MVP)

- Inquiry tracking and follow-up history
- Proposal **status** tracking (not proposal/contract authoring)
- Idempotent conversion of an accepted proposal into a client company,
  primary contact, and a draft project from a reusable template
- Secure invitation-based account creation for clients
- Project → Phase → Milestone → Task hierarchy with dependencies and
  calculated progress roll-up
- Reusable, owner-editable project/phase templates with versioned snapshots
- Draft vs. published visibility on schedule/content data
- Scheduling: month/week calendar, timeline/Gantt-style view, drag reschedule
  with accessible alternative, dependency-shift preview + transaction, date
  history
- In-app notifications + transactional email (deadlines, comments, files,
  approvals, schedule changes), idempotent and retryable
- Project-wide thread + contextual comments, with an enforced internal/client
  visibility distinction
- Phase-based questionnaires for content/info collection (no password fields)
- File management on Google Cloud Storage: folders by phase, tags, search,
  version history, previews (images/PDF), staging-site links
- Immutable, versioned deliverable approvals (approve / request changes)
- Support tickets and recurring maintenance task generation (idempotent)
- Owner dashboards: attention/overdue/upcoming, Kanban, calendar, Gantt,
  searchable project list, archive, future/scheduled projects
- Client dashboard: next actions, upcoming dates, awaiting-input items,
  unread updates, recent activity, per-project progress
- Scoped search (Postgres-native) across clients, projects, phases,
  milestones, tasks, files/tags, inquiries, archived projects
- Owner-only client activity log and system/security audit log; client-facing
  shared activity feed limited to published events
- Owner-configurable templates, statuses/labels, questionnaires, recurring
  support templates, global reminder-timing defaults — all without code
  changes
- Email/password auth with invitations, password reset, rate limiting,
  session invalidation on password change/disable
- Docker Compose deployment, reverse-proxy example, automated Postgres
  backups + documented restore, CI (lint/typecheck/test/build/e2e)

### Explicitly out of scope (v1)

- Invoicing or payment collection inside YeffoHub
- Built-in video meetings
- Employee/team roles or multi-staff permission tiers
- A **live** WooCommerce integration — only internal service interfaces,
  data model stubs, and a documented future design (`docs/integrations/woocommerce-future.md`)
- Electronic-signature-grade legal approvals (approvals are an internal
  audit record, never presented as a signed legal instrument)
- A plaintext credential/secrets vault for client-submitted passwords
- WordPress/WooCommerce SSO implementation (identity-provider boundary is
  isolated and documented, not built)

### Deliberately deferred design questions (safe defaults, revisit later)

These are not implementation blockers; each has a default documented in the
relevant doc and can be changed without an architecture rewrite:

- Exact brand colors/logo/fonts — placeholder design tokens only (see
  `docs/architecture.md` §Theming)
- Production subdomain, VPS distro, SMTP host, GCS project/bucket — requested
  only when the phase that needs them (4, 6, 8) begins
- Whether "email verification" is a distinct step: **default** — invitation
  acceptance (clicking a single-use link mailed to the contact's address) and
  password-reset both double as proof of email ownership; no separate
  verification email is sent in v1. Documented in `docs/decisions/0003-authjs-argon2.md`.

## 4. Feature walkthrough by module

### 4.1 Sales / inquiries

- Create/edit an `Inquiry` with source, contact info, status, notes.
- Log dated follow-ups (conversation history) with next-follow-up date.
- Track a `ProposalRecord` per inquiry: status only (draft/sent/viewed/
  accepted/declined/expired — configurable list), no proposal content
  authoring.
- Marking a proposal **accepted** triggers idempotent conversion: find-or-create
  `ClientCompany`, find-or-create primary `ClientContact`, create a draft
  `Project` from the selected `ProjectTemplate`'s current published version,
  and queue the invitation email. Re-submitting the same accept action is a
  no-op against existing records (unique constraint keyed to the proposal).

### 4.2 Client & contact management

- `ClientCompany` with one primary contact (required) and any number of
  additional contacts.
- Additional contacts get explicit per-project access grants (owner-managed);
  primary contact has implicit access to all of that company's projects.
- Owner can disable a contact's account (revokes sessions immediately).

### 4.3 Project delivery

- Template library (`Discovery → Design → Build → Testing → Launch →
Support` shipped as the default) editable by the owner through the UI.
- Projects are created from a **versioned snapshot** of a template — later
  template edits never retroactively change existing projects.
- Phase → Milestone → Task hierarchy, each independently orderable,
  date-bound, and visibility-flagged (draft/published, and internal-only for
  tasks).
- Dependencies between milestones/tasks with cycle prevention.
- Progress is always derived (task completion → milestone → phase →
  project); never manually overridden, never client-editable. A phase or
  milestone with zero tasks reports 0% until it contains at least one task,
  and is excluded from its parent's weighted average only if explicitly
  marked "no tracked work" by the owner (see `docs/data-model.md`).

### 4.4 Scheduling

- Month and week calendar views; timeline/Gantt-style project view — all
  driven by the same `Phase`/`Milestone`/`Task` date fields (no duplicated
  per-view schedule data).
- Owner drag-and-drop reschedule, with a full keyboard/dialog-based
  alternative (select item → edit dates form).
- Changing a date offers "shift dependent items" with a preview of every
  affected item before committing; the shift + notifications are one
  transaction.
- Every date change (manual or cascaded) is recorded with old/new value,
  actor, timestamp, optional reason.

### 4.5 Communication

- One project-wide thread per project.
- Contextual comments on phases, milestones, tasks, files, support tickets,
  and approval requests, each with an explicit `CLIENT_VISIBLE` /
  `INTERNAL_ONLY` flag enforced at the data layer (not UI-hidden).
- Unread state per user per thread/comment.

### 4.6 Files & deliverables

- Folders per project phase; tags; search by name/tag/uploader.
- New upload of an existing file creates a new `FileVersion`; prior versions
  are retained in storage and in the database, never overwritten.
- In-app preview for images and PDFs; authorized download for everything
  else.
- Staging-site links are versioned the same way as files and support the
  same approval flow.
- Formal approvals target a specific file version or staging-link version:
  `APPROVED` or `CHANGES_REQUESTED` (with required comment), immutable once
  recorded, full history retained. When a newer version is issued, the UI
  clearly marks whether a fresh approval is required for that version.

### 4.7 Questionnaires

- Owner builds phase-based questionnaires (text, textarea, select,
  multi-select, file upload, URL, date, checkbox fields), each optionally
  required with help text.
- Clients save drafts and submit; owner reviews and marks reviewed.
- No password/credential fields; a dedicated help panel explains how to
  share hosting/domain credentials securely outside a plaintext form (see
  `docs/security.md`).

### 4.8 Support & maintenance

- Support tickets (status/priority/subject/description/comments/
  attachments) tied to a project.
- Recurring maintenance templates generate tasks on a schedule; generation is
  idempotent per template+scheduled-occurrence, safe against worker retries.

### 4.9 Notifications

- In-app (read/unread) + email, both driven from the same notification
  event, each with a stable idempotency key.
- Deadline reminders use owner-editable global default offsets (e.g., "7
  days and 1 day before due"); the schema leaves room for a future
  project/item-level override without a migration rewrite.
- Users manage non-essential preferences per notification type; security
  notifications (password reset, new login from invitation, account
  disabled) cannot be muted.

## 5. Route map (App Router, indicative — finalized in Phase 1)

```
/                              → marketing/redirect to /login or /dashboard
/login /forgot-password /reset-password/[token] /invite/[token]

/owner                         → dashboard (attention/overdue/upcoming)
/owner/inquiries               list + detail/edit
/owner/inquiries/[id]
/owner/clients                 client company list
/owner/clients/[id]            company detail: contacts, projects
/owner/projects                filterable/searchable table
/owner/projects/board          Kanban
/owner/projects/calendar       month/week
/owner/projects/timeline       Gantt-style
/owner/projects/archive
/owner/projects/[slug]         project workspace (phases/milestones/tasks,
                                  files, thread, questionnaires, approvals,
                                  internal notes, activity, settings)
/owner/templates                project & questionnaire templates
/owner/support                  tickets + recurring maintenance templates
/owner/settings                 statuses/labels, reminder defaults, SMTP/
                                  integration config (secrets write-only)

/client                         dashboard
/client/projects/[slug]         published project view: phases, milestones,
                                  my tasks, files, thread, questionnaires,
                                  approvals, activity
/client/support                 tickets for my projects
/client/account                 profile, password, notification preferences

/api/...                        server actions preferred; REST-style routes
                                  reserved for webhooks (future WooCommerce),
                                  signed-URL issuance, and health checks
/api/health  /api/ready          liveness/readiness, no secrets
```

## 6. Major UI screens (Phase 0 inventory — wireframes deferred to relevant build phase)

**Owner:** Dashboard · Inquiry list/detail · Client list/detail · Project
table · Project workspace (tabs: Overview, Schedule, Files, Questionnaires,
Approvals, Thread & Comments, Support, Activity, Settings) · Kanban board ·
Calendar (month/week) · Timeline/Gantt · Archive/search · Template editor ·
Questionnaire builder · Support ticket list/detail · Recurring maintenance
templates · Global settings (reminders, statuses/labels, SMTP test) ·
Notification center.

**Client:** Dashboard · Project view (read-scoped version of the owner
workspace tabs, minus internal notes/internal tasks) · My tasks · File
browser with preview · Questionnaire fill-out · Approval decision screen ·
Support ticket list/detail · Account/profile/notification preferences.

**Shared:** Login/forgot/reset/invite-accept screens · 403/404 pages that
never confirm or deny the existence of another tenant's resource.

## 7. Acceptance criteria

The 14 end-to-end scenarios listed in the master specification (§18) are the
authoritative MVP acceptance criteria and are tracked 1:1 as Playwright specs
starting in the phase that implements each flow; the full list is mirrored in
`docs/testing.md` once Phase 1 stands up the test harness.

## 8. Non-functional targets

- ~25 active projects at launch, growing archive; pagination and indexed
  queries throughout, no design that assumes unbounded in-memory lists.
- Responsive from ~360px mobile width up; primary owner workflows usable on
  a phone (approve, comment, check status) even though power editing (Gantt
  drag, template editing) is desktop-optimized.
- WCAG 2.2 AA where practical: keyboard operability, visible focus, labelled
  form controls with associated errors, reduced-motion support, non-drag
  alternatives for all drag interactions.

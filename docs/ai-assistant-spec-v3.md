# PR 7 — Assistant v3: general toolbox, plans, free reads

Read `CLAUDE.md`, `docs/ai-assistant-spec.md` and `docs/ai-assistant-spec-v2.md` first. This PR
builds **on** PRs 1–6, it does not replace them. Keep the streaming, provider, budget, tiers,
proposals/action cards, views, audit and settings exactly as they are; they are the foundation.
Delete only the hand-written tool bodies that the generated toolbox makes redundant, and only
after the generated equivalent passes the same test. Lean PR, important-path tests, no e2e beyond
the existing suites, no committed screenshots.

The rule from the earlier specs still governs everything here: **the model decides what to do;
the server decides whether it is allowed and how much confirmation it takes.** Nothing below adds
a tool that bypasses a route, a capability check, clinic scoping, or the append-only ledger.

Four things are missing today, and they are why the assistant "can't handle every scenario":

1. every tool is hand-written, so every new endpoint is a new tool to write;
2. all ~37 tools are sent on every request, which costs tokens and makes a small model pick
   badly;
3. there is no multi-step plan — a request that needs three writes becomes three separate
   cards or a confused answer;
4. any question nobody wrote a tool for fails, even when the data is one query away.

Fix them in this order. Each part is independently mergeable.

---

## Part 1 — Tools generated from routes

Every controller method already declares its capability key (derived by `CapabilityRegistry`),
its Zod body/query/params schemas, and its HTTP verb. That is a tool definition. Build
`RouteToolRegistry` in `apps/api/src/ai/tools/route-tools.ts` that, at boot, walks the Nest
route map and emits one `AiTool` per route that opts in:

- Opt-in, not opt-out: a route becomes a tool only when its handler carries a new decorator
  `@AiTool({ description, risk?, exclude?: string[] })`. The description is written for the
  model (what it does, when to use it, what it returns); undecorated routes are invisible.
  Decorate every appointments, patients, doctors, schedule, time-off, closures, labs, lab-orders,
  inventory, billing/payments and reports route that a staff member can reach from the UI.
- Never decorate: auth, users/roles/permissions, clinics settings, `ai/**` itself, secrets,
  automation settings, uploads, exports. The registry also **refuses** to register anything
  under those controllers even if decorated, and boot fails with the offending route — the
  assistant can never confirm itself or widen its own access.
- Args schema = merge of the route's params + query + body Zod schemas, named
  `<controller>_<method>` (`appointments_create`, `payments_create`). `force`-style override
  fields are stripped from the model-facing schema (`exclude`), never exposed.
- Execution goes through the **service method the controller calls**, not through HTTP: the
  runner resolves the controller instance and invokes the handler with a synthetic request that
  carries the real `AuthenticatedUser`. Guards run: `ToolRunnerService` already checks the
  capability; the handler's own validation and clinic scoping run as they do for the UI.
- Reads (`GET`) get `risk: null`. Writes get the tier from `AI_ACTION_BASE_TIER` by tool name
  when one exists, else `confirm`; `DELETE` verbs and anything under billing default to
  `typed`. A route with no tier entry and a non-GET verb logs a warning listing it, so nothing
  ships as `auto` by accident.
- The existing hand-written read tools that are pure query wrappers (find_doctors,
  find_labs, find_payments, get_stock_movements, …) are replaced by their generated route
  twins; keep only the ones that compose several services (`get_patient_summary`,
  `get_daily_stats`, `get_financial_summary`, `draft_bulk_message`) and the action tools whose
  sanity checks are not in the route (`cancel_appointments`, `record_payment`,
  `create_appointment` with the `slot_taken` shape). Views (`AiView`) attach by tool name as now.
- Tests: the registry snapshot (tool names + risk) so a new decorated route is a visible diff;
  a decorated route under `users` fails boot; `force` is absent from the generated schema; a
  generated write goes through the same guard as the UI (receptionist without
  `payments.create` gets `not_permitted`, nothing written).

## Part 2 — Two-stage tool loading

With generation the toolbox grows past 50. Do not send it all.

- Group tools by domain in the registry (`appointments`, `patients`, `schedule`, `labs`,
  `inventory`, `billing`, `reports`, `messaging`). Each group has a one-line description.
- Every request carries a small **core set** (≈8): `search_patients`, `get_appointments`,
  `find_doctors`, `get_patient_summary`, `query_data` (Part 4), `draft_bulk_message`, and
  `load_tools`.
- `load_tools({ groups: string[] })` returns the tool definitions of those groups **and** the
  runner adds them to the tool list for the rest of that turn only (the loop already rebuilds
  `tools` per step — make it per-turn state on `AgentService.run`). It never counts as a step
  against `AI_MAX_TOOL_STEPS`. Its result to the model is `{ loaded: [names] }`, not the
  schemas (the schemas go into the `tools` param).
- The prompt lists the groups with their one-liners so the model knows what exists before it
  loads anything. Prompt caching: the group list is stable; keep it in the system prompt above
  the actor context.
- Persist per conversation which groups were loaded (`ai_conversations.loaded_groups jsonb`)
  and preload them on the next turn of the same conversation, so a follow-up question does not
  pay the load step again.
- Tests: a turn with only core tools cannot call `payments_create` until `load_tools` ran;
  loaded groups survive to the next turn of the same conversation and not to a new one; token
  count of the core prompt stays under a fixed ceiling asserted in a test (set it from the
  first measurement; the point is that it does not creep).

## Part 3 — Plans: one card, several steps

- New tool `propose_plan({ title, steps: [{ tool, args, note? }] (1..8) })`, core set, tier
  = the **highest** tier of any step (server-computed; the model does not send tiers). Every
  step's `tool` must be a write tool the actor is permitted to call, its `args` are validated
  against that tool's schema at proposal time, and read tools are refused inside plans (the
  model reads first, then proposes). Any failure returns a typed result naming the step;
  nothing is stored.
- Stored as one `ai_proposals` row, `kind: "plan"`, `payload.steps[]` with each step's resolved
  summary (names not ids, computed server-side as for single actions).
- The card lists the steps in order with their summaries and one تأكيد / إلغاء (typed phrase
  when the plan's tier is `typed`, phrase `تأكيد تنفيذ الخطة`). Steps that need a fresh input
  from the user (a time slot the model left as `null` because the doctor is busy) render as an
  inline field; the card is not confirmable until every field has a value.
- Execution: sequential, **one transaction per step, not one for the plan** — a clinic's day
  should not roll back six moves because the seventh hit `slot_taken`. On a failed step the plan
  stops, the card shows steps done / failed / not run, and offers "continue from step N" which
  re-validates the remaining steps (availability may have changed) before running them.
  Every step writes its own audit row, plus a plan-level row linking them.
- Steps may reference earlier outputs: `args` may contain `{ "$ref": "steps[0].id" }` for the id
  of a row created earlier in the plan (a doctor time-off created in step 1, referenced by a
  reschedule in step 2). Resolve at run time; a dangling ref fails validation at proposal time.
- Prompt: *when a request needs more than one change, read what you need, then call
  `propose_plan` once with every step; never issue the changes as separate actions.* Add one
  worked example in the prompt: the Rasha/Basel case (add doctor hours → find affected
  appointments → reschedule each with a proposed slot from `find_available_slots`, `null`
  where none → add time off), ending in a single `propose_plan`.
- Tests: tier is the max of steps; a read tool inside a plan is refused; a step failing mid-way
  leaves earlier steps committed and later ones unrun; `$ref` resolution; continue-from-N
  re-validates.

## Part 4 — `query_data`: free reads without free access

The escape hatch for questions nobody wrote a tool for ("who hasn't visited in six months",
"which lab is slowest this quarter"). Read-only SQL, but not against the tables.

- Migration: a schema `ai_read` with **views** over the clinic tables. Every view has
  `clinic_id` and exposes only the columns a staff member can see in the UI; medical columns
  (visit notes, treatment details, tooth chart, x-ray paths) are in separate views
  `ai_read.visit_clinical`, `ai_read.treatment_clinical` so they can be gated. Phone numbers are
  exposed masked (`phone_last4`) in every view; the full number never reaches the model here.
- A Postgres role `ai_reader` with `SELECT` on `ai_read.*` only, `statement_timeout = '5s'`,
  `default_transaction_read_only = on`. A second pool in `DatabaseModule` connected as that
  role. The runner sets `SET LOCAL app.clinic_id = $1` per query and every view filters on
  `current_setting('app.clinic_id')::uuid` — clinic scoping is in the view, not in the SQL the
  model writes.
- Tool `query_data({ sql: string, purpose: string })`, capability `reports.list`. Server-side
  checks before running, each with its own error code: single statement; starts with `SELECT`
  or `WITH`; references only `ai_read.` relations (parse with `pgsql-ast-parser`, reject
  anything else including functions that read files or `pg_*`); the clinical views require the
  actor to hold `visits.read` (checked at call time); `LIMIT` injected at 200 if absent and
  clamped if larger. Result shape: `{ columns, rows, truncated }` and a `table` view for the
  page. `purpose` is stored in the audit row so an admin can see why a query ran.
- The prompt gets the view catalogue (view name → columns, one line each) in a stable block
  for caching, and the rule: *prefer a route tool when one fits; use `query_data` for
  aggregation, unusual filters, or joins the tools don't offer; never for writes; show the
  numbers exactly as returned.*
- Tests: a `SELECT * FROM patients` (table, not view) is refused; a second statement is
  refused; clinic scoping holds (rows from another clinic never appear even when the SQL omits
  a filter); clinical view without `visits.read` is refused; `LIMIT` clamping; timeout maps to a
  typed error.

## Part 5 — Smarter, cheaper answers (small changes, real effect)

- **Tool descriptions are the intelligence.** Rewrite every description in the same shape:
  what it does · when to use it · when NOT to (name the alternative) · what it returns. Two
  lines max each. Ambiguity between two tools is a description problem, fix it there, not in
  the prompt.
- **Clarify before acting, not after.** Keep the accuracy rules from v2 and add: before any
  write or plan the model states in one line what it understood ("I'll move Ahmad Khaled's
  Thursday 3pm to Friday 10am") — the card shows the same, so a mismatch is visible before the
  click.
- **Structured tool results stay available.** Store each tool result's compact form on the
  conversation (`ai_messages.role = tool` rows already exist); on the next turn include the
  last 2 tool results verbatim in the history the model sees (not just the assistant prose), so
  "and the one after him?" works. Cap by tokens, drop the oldest first.
- **Reply budget by kind.** When a view was emitted, `max_completion_tokens` for that final
  step drops to 200; a bare answer keeps 800. Same `AI_MAX_OUTPUT_TOKENS` ceiling.
- **Evaluate, don't guess.** Add `apps/api/test/ai-eval.spec.ts`: 25 fixed Arabic/English
  questions covering every group, run against the `log` provider with a scripted "model" that
  replays expected tool choices, asserting the runner's routing and tier outcomes. Not a model
  eval — a regression net for the toolbox. Plus a script `pnpm ai:eval:live` (not in CI) that
  runs the same 25 against the real provider and prints tool chosen vs expected, so a model
  switch (Luna → GPT-6 Luna) can be judged in one run.

---

## Non-goals

Raw table access, any write outside a route, the model choosing tiers, patient-facing chat,
editing the ledger (still reversing rows only), anything under `ai/**`, auth, users, permissions
or secrets as a tool.

## Order and size

Part 4 → Part 2 → Part 1 → Part 3 → Part 5. Part 4 is the biggest win per line and touches
nothing existing; Part 1 is the largest diff and lands once Part 2 keeps the prompt small.
Finish and commit the in-progress extra-hours / `find_available_slots` work before starting.
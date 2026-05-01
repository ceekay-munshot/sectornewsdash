---
name: munshot
description: Wire a MUNS-powered news/chat panel into the current dashboard repo. Invoke when the user types `/munshot` or asks to add live MUNS data (agent run or chat prompt) to a dashboard. Walks chat-vs-agent choice, prompt/agent-id collection, one-time GitHub Action to capture a sample response, parser build from MunsRenderer.tsx (without importing it), Run button + output panel matching the host UI, and final teardown of the bootstrap workflow.
---

# /munshot — wire MUNS into a dashboard

You are inside a user's dashboard repo. Your job is to add a MUNS-powered
button + output panel to it.

## First-turn behaviour (read this before doing anything)

When this skill is invoked, **do not start reconnaissance** (no Reads,
Greps, Bashes) until you've confirmed intent.

- If the user is asking what the skill does, what its phases are, or any
  meta-question — answer in 4–6 bullets summarising Phases 1–6 below,
  then ask one short question: "Want me to start? (chat or agent?)".
  Stop there. No tool calls.
- If the user invoked it with a clear request to wire something in
  ("add munshot agent for X", "wire chat for prompt Y"), skip the meta
  reply and go straight to Phase 1.
- If the invocation is bare (just `/munshot`), say in one sentence what
  the skill does and ask whether they want chat or agent. Stop.

Only start tool calls AFTER the user has expressed a clear intent to
proceed and given you the chat/agent choice.

## The two MUNS endpoints

Both return the **same response shape** — an event-stream body with one
`<ans>...</ans>` block containing a markdown table — so a single parser
handles both.

```
# Agent — pre-baked sector/topic UUIDs, returns a curated table
POST https://devde.muns.io/agents/run
Authorization: Bearer <MUNS_TOKEN>
Content-Type: application/json

{
  "agent_library_id": "<UUID>",
  "metadata": {
    "stock_ticker": "JIOFIN",
    "stock_company_name": "Jio Financial Services Ltd.",
    "context_company_name": "Jio Financial Services Ltd.",
    "stock_country": "INDIA",
    "to_date": "<YYYY-MM-DD>",
    "timezone": "UTC"
  }
}
```

```
# Chat — free-text prompt, returns the same table shape
POST https://devde.muns.io/chat/chat-muns
Authorization: Bearer <MUNS_TOKEN>
Content-Type: application/json

{
  "tasks": ["<your prompt>"],
  "query_context": { "WEB_SEARCH_ENABLED": true, "mode": "fast", "chatHistory": [] },
  "autoAddUpcoming": false,
  "urls": []
}
```

## Phase 1 — Pick the surface

Decide chat vs agent from the user's first message. If still ambiguous,
ask a single concise question. Then collect the inputs:

- **Agent** → ask for the `agent_library_id` UUID, plus any non-default
  metadata (ticker / company / country / to_date).
- **Chat** → ask for the prompt text.

## Phase 2 — Token

Ask for the **MUNS bearer token** unless one is already present in the repo
(grep for `eyJhbGciOi`, `AGENT_ACCESS_TOKEN`, `MUNS_TOKEN`, `Bearer`).

The token is consumer-product-style: hardcoded in source at a single
clearly-marked replaceable export. Do not introduce env var plumbing
unless the repo already uses Vite/Next env vars and the user asks.

## Phase 3 — Bootstrap a sample output via GitHub Actions

You can NOT call the MUNS API from your sandbox (the API rejects the
sandbox source IP with `host_not_allowed`). To see the actual response
so you can build the parser, you MUST get a sample committed to the repo
through GitHub Actions.

1. Slugify the request to a stable filename:
   - Agent: `munshot-outputs/agent-<uuid>.txt`
   - Chat:  `munshot-outputs/chat-<slug-of-prompt-truncated-to-60>.txt`
2. Write `.github/workflows/munshot-fetch.yml` that:
   - Triggers on `workflow_dispatch`
   - Runs on `ubuntu-latest`
   - Curls the chosen endpoint with the bearer token (read from
     `${{ secrets.MUNS_TOKEN }}`) and the body filled in from the user's
     inputs
   - Pipes response (with `-i` so headers are captured) to the slug path
   - Configures git as `github-actions[bot]`, commits and pushes the
     file to the same branch using the auto-provided `GITHUB_TOKEN`
3. Tell the user, in this exact order:
   1. **Add a repo secret** `MUNS_TOKEN` with their bearer token. Either:
      - manual: GitHub UI → Settings → Secrets → Actions → New, OR
      - if they hand you a fine-grained PAT with `secrets: write` on this
        repo, you can do it via `gh secret set MUNS_TOKEN` yourself.
   2. **Push the branch** (you push it for them).
   3. **Open Actions tab → munshot-fetch → Run workflow** on the branch.
   4. Wait for the green check, then `git pull` locally.

   Do not proceed to Phase 4 until the file is on disk.

If the workflow run fails (4xx/5xx in the response or the run itself
errors), surface the exact failure to the user and stop. Common causes:
expired token, wrong agent UUID, missing/misnamed `MUNS_TOKEN` secret.

## Phase 4 — Read the sample, build the parser

Once `munshot-outputs/<slug>.txt` is on disk:

1. Read it. Confirm the body contains a `<ans>...</ans>` block with a
   markdown table inside.
2. Look for `MunsRenderer.tsx` anywhere in the repo (or `transformation_prompt.md`).
   Use it as a **reference only** — read it, identify the parser
   helpers you need, then write a fresh minimal `src/lib/munsParse.ts`
   (or location matching the repo's conventions). **Never `import` from
   `MunsRenderer.tsx`.** When you're done, the repo should contain zero
   references to `MunsRenderer`.

   The minimum useful parser:
   - Locate the markdown separator row (`|---|---|...`) anywhere in the
     body.
   - Header line is the line immediately before — strip any `<ans>`
     prefix and `**` bold markers.
   - Walk forward, accept any pipe-bearing line as a data row. Stop at
     `</ans>`, `</task>`, `<summary>`, or any tag-only line.
   - Tolerate cell-count mismatches: pad short rows, truncate long ones.
3. If the dashboard has an existing `NewsItem` (or analogous) shape,
   write a `munsToNews.ts` mapper from table-row → that shape. Infer
   sentiment from the `Impact` column, theme from `News Type` + headline
   keywords, sourceType from the `Source` column.

## Phase 5 — Add the runtime UI

In the dashboard, add:

1. A small **button** styled to match the existing UI. Read 2–3 of the
   dashboard's existing components first to learn its visual language
   (Tailwind classes, shadcn primitives vs plain, header chips, sentiment
   dots, date format, source-link style).
2. A scrollable **output panel** that renders the parsed rows. If the
   dashboard already has a news/list component, route MUNS rows through
   it so click-to-detail and existing aggregates keep working. If not,
   render a minimal list with: small colored dot · headline · short
   date (e.g. `MAR-27`) · outlink icon button.
3. The button calls the MUNS endpoint **directly from the browser** with
   the hardcoded token. No GitHub middleman, no proxy, no token UI.

Mounting decisions:
- If the dashboard has a clear "current subject" (active sector / ticker /
  page), default to mounting the button **per-subject**, scoped to that
  subject's identity.
- If not, mount it globally (e.g. header) with a single shared output
  panel.
- For multi-subject dashboards with many subjects: build a small
  `SECTOR_AGENTS` (or analogous) map keyed by subject id → agent UUID,
  and add a "Sync all" header button that fans out with a concurrency
  cap of 5.

## Phase 6 — Tear down the bootstrap

Once a successful (HTTP 2xx) response with a parseable table has been
captured, the GitHub Action has done its job:

1. Delete `.github/workflows/munshot-fetch.yml`
2. Delete the `munshot-outputs/` directory
3. Tell the user they may also delete the `MUNS_TOKEN` repo secret if
   they want — it's no longer used by anything in the repo.

Do **not** tear down if any run failed (non-2xx). Leave it in place so
the user can iterate.

## What to ask the user (in order)

Only ask if the answer isn't obvious from their first message or the
repo state.

1. Chat vs agent?
2. Prompt text (chat) **or** agent UUID + metadata overrides (agent)?
3. MUNS bearer token (only if not already in the repo)?
4. Where to mount the button — global vs per-subject — only if the repo
   layout makes both viable?

## Hard rules

- **Never** copy `MunsRenderer.tsx` wholesale. Extract only what you
  need into a fresh small parser file.
- **Never** import `MunsRenderer.tsx` from any file in the repo.
- **Never** leave `munshot-outputs/` or `.github/workflows/munshot-fetch.yml`
  committed once Phase 6 has run cleanly.
- **Never** store the MUNS token in a `.env` example file or anything
  user-visible besides the single hardcoded export. Consumer product.
- **Always** match the existing dashboard's visual style. Read its
  components before writing new ones.
- **Always** put the bearer token in one replaceable spot
  (`src/lib/agentConfig.ts` or similar). One file to swap when it
  expires.
- If the user asks for both endpoints in the same dashboard, share the
  parser and config — don't duplicate.

## Reference: response body shape

Both endpoints return an event-stream body. The parseable bit is between
`<ans>` and `</ans>`:

```
HTTP/2 200
...headers...

<task>
<1>
<tool><s>...</s></tool>
...
<ans>| Date | Investor-Relevant Headline | Source | Segment | News Type | Companies Impacted | Key Datapoint / Event | Why It Matters | Impact | Link |
|---|---|---|---|---|---|---|---|---|---|
| 2026-04-28 | Sigma wins ₹3,800 crore Rolls-Royce contract | ET Defence | Aerospace | Contract win | Sigma, Rolls-Royce | ₹3,800 crore multi-year contract | Long-duration revenue visibility | Positive | https://... |
| ... |</ans>
</1>
</task>
<summary>...optional prose...</summary>
```

Columns vary by agent but the standard set is:
`Date · Investor-Relevant Headline · Source · Segment · News Type ·
Companies Impacted · Key Datapoint / Event · Why It Matters · Impact ·
Link`. Code defensively for missing columns by using fuzzy column-name
matching (e.g. find the column whose lowercase name contains "headline"
or "investor", whichever matches first).

# UNIVERSAL TRANSFORMATION PROMPT: Add MUNS Agents Architecture to Any Lovable Dashboard

Use this prompt to transform a base Lovable dashboard into an evolved MUNS-enabled dashboard, even if the base app has a different layout (with sidebar, top tabs, or no nav at all).

## Objective
- Add dynamic MUNS Agent tabs.
- Allow users to add/remove agents at runtime.
- Each agent tab must provide:
  - `Run` button
  - `Extra User Query` button (toggles textarea)
  - textarea value sent on the next run
  - editable `Ticker` and `Company` inputs used in the model call
- Agent output must remain when switching tabs during the same session.
- Ask for new agent `id` and `name` in UI (and collect `libraryId` for API execution).
- Use a reusable `MunsRenderer.tsx` so it can be copy-pasted into any dashboard.
- Render output with interactive widget UI (not markdown-only rendering).

## Required Inputs
1. `MunsRenderer.tsx` (drop-in renderer/module)
2. This prompt
3. Existing dashboard codebase (base Lovable project)

## Dependencies
Install if missing:

```bash
npm install react-markdown remark-gfm rehype-raw react-plotly.js plotly.js-dist-min pako
npm install -D @types/pako @types/react-plotly.js
```

Ensure shadcn/ui primitives are available for:
- `Card`, `Button`, `Badge`, `Dialog`, `Input`, `Label`, `Textarea`
- `Tabs` (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`)
- `Table` (`Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`)

## Environment and API
Add to `.env`:

```env
VITE_MUNS_API_BASE=https://devde.muns.io
VITE_MUNS_ACCESS_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZWE5ZGMyYi0xZDBmLTQ2MzctOGE2Ny0wM2VhNzFmMGYyY2YiLCJlbWFpbCI6Im5hZGFtc2FsdWphQGdtYWlsLmNvbSIsIm9yZ0lkIjoiMSIsImF1dGhvcml0eSI6InVzZXIiLCJpYXQiOjE3NzU3MTg5NTgsImV4cCI6MTc3NjE1MDk1OH0.Y8WQ1YxM29CJYRUbPsMqR2twkqSy_fquTrPv4Yyk_LU
```

Use this working API shape:

```bash
curl --no-buffer -i -X POST "https://devde.muns.io/agents/run" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_library_id": "f8c08f67-9dc2-4960-9c87-623251f297c1",
    "user_query": "generate as many graphs as possible for visualisation",
    "metadata": {
      "stock_ticker": "JIOFIN",
      "stock_country": "INDIA",
      "to_date": "2026-04-02",
      "timezone": "UTC"
    }
  }'
```

## Integration Rules (Generalized)

### 1) Drop in the renderer
- Copy `MunsRenderer.tsx` into a reusable location, e.g. `src/components/dashboard/MunsRenderer.tsx`.
- Do not hard-couple it to one page structure.

### 2) Connect UI navigation to dynamic agents
Find whichever navigation model the app uses:
- Sidebar list
- Tabs strip
- Route-driven sections
- If none exists, create a local tabs strip in the dashboard body

Then:
- Render dynamic MUNS tabs from agent registry.
- Show add button near tabs/nav.
- Show remove button on each dynamic tab.
- Add dialog/form fields:
  - Agent ID (tab key)
  - Agent Name (tab label)
  - Agent Library ID (MUNS execution ID)

### 3) Render MUNS panel when active tab is a dynamic agent
- In the dashboard content switcher, detect if active section matches an agent `id`.
- If yes, render MUNS panel from `MunsRenderer.tsx`.
- If no, render existing dashboard content unchanged.

### 4) Pass context safely and flexibly
- Identify the dashboard's current subject object (e.g. company, case, patient, record).
- Pass a context object into MUNS panel. Include useful fields if available:
  - `ticker` / `symbol`
  - `companyName` / `name`
  - `country`
  - `id`
  - any extra metadata already in app state

### 5) Session persistence behavior
- Per agent tab, persist in-session state:
  - markdown output
  - raw output
  - error
  - extra user query text
  - whether query textarea is open
  - ticker/company input overrides
- On tab switch, previously loaded output must still display for that tab.

### 6) Interactive output renderer behavior (mandatory)
- Do not stop at markdown parsing.
- Implement a typed rendering pipeline inside the renderer:
  1. Parse output sections (`##`/`###` headings), tables, bullets, and graph blocks.
  2. Classify each section into semantic block types such as:
     - `key_findings`
     - `recommendations`
     - `management_summary` / `kv_table`
     - `status_table`
     - `timeline_table`
     - `ceo_details`
     - `data_table` / fallback unknown
  3. Render block types using widgets first, markdown fallback second.

- Required interactive UI patterns:
  - **Report/Audit split:** use `Report` and `Audit` tabs for output views.
  - **Status badges:** map status-like values (pass/fail/yes/no/etc.) to badge styles.
  - **Timeline cards:** render date-event-detail rows as timeline UI when possible.
  - **Meta grid cards:** render key-value summary rows as compact cards.
  - **Person highlight card:** for CEO/details sections, render name/role/meta card.
  - **Data table renderer:** styled table with row stripes and readable headings.
  - **Markdown fallback:** only for blocks that cannot be confidently typed.

### 7) Output hygiene and tool-noise suppression
- Clean streamed output before rendering.
- Drop obvious tool/log noise lines, including:
  - `PythonRepl:` / repeated `PythonRepl` traces
  - HTTP header lines
  - orchestration/tool tags (`WriteTodos`, `WebSearch`, etc.)
  - raw base64/gzip blobs (for example lines beginning with `H4sI...`)
- Graph payloads should render as charts when possible; non-renderable blobs must not be shown as user-facing prose.

## Expected User Experience
- User can click `Add Agent`.
- UI asks for `Agent ID`, `Agent Name`, and `Agent Library ID`.
- New tab appears instantly.
- User opens tab and sees:
  - Run button
  - Extra User Query button
  - optional query textarea (when toggled)
  - editable ticker/company fields for overriding default context
- Running the tab calls MUNS API and renders cleaned output.
- User can switch tabs and return without losing tab-specific output/query state.
- User can remove a tab from UI.

## Adaptation Notes for Different Base Apps
- If app already uses `AppShell`/`activeSection`: extend existing logic.
- If app uses routes only: create one route section that hosts dynamic tabs + panel.
- If app has no nav: mount `MunsAgentsWorkspace` inline with its own tabs.
- Never delete existing core business features; only augment navigation/content switching.

## Implementation Checklist
- [ ] `MunsRenderer.tsx` added and imports resolved
- [ ] Dependencies installed
- [ ] env values configured (`VITE_MUNS_API_BASE`, `VITE_MUNS_ACCESS_TOKEN`)
- [ ] add/remove dynamic tabs implemented
- [ ] add agent form asks for `id` and `name` (and `libraryId`)
- [ ] run + extra query controls implemented in each agent tab
- [ ] ticker/company override inputs implemented and used in run payload
- [ ] output persists per tab during current session
- [ ] non-agent sections still function exactly as before

## Acceptance Criteria
- Works in base dashboard even if structure differs from reference app.
- Dynamic agents are true tabs/sections, not static cards.
- Add/remove operations update UI immediately.
- Extra user query is sent on next run.
- Ticker and company can be edited per tab and are used in agent calls.
- Switching tabs preserves tab output and query state in-session.
- Renderer is reusable via copy-paste across dashboards.
- Output UI is widget-first (typed blocks + Report/Audit tabs), not plain markdown-only.
- Tool-noise/base64 blobs are suppressed from final displayed report text.

# devbill

**Turn Claude Code usage into an invoice.**

Token counters tell you what you consumed. `devbill` answers the question a
freelancer actually has: *what can I bill for this, and what's left after
costs?*

It reads Claude Code's session logs after they are written — no hooks, no
wrapper, no interference with running sessions, and **it costs you zero extra
tokens**. Everything runs locally on `127.0.0.1`; nothing is uploaded anywhere.

```
session logs → active working time → hourly value → margin → invoice PDF
```

## Why this exists

Every tool in this space (ccusage, claude-code-templates, ccgauge, sniffly,
opcode) answers *how many tokens did I burn and what would the API have cost*.
None of them answer *what do I put on the invoice*. Between those two questions
sit four steps:

1. **Usage → working time.** Tokens are not hours. Timestamps in the log
   reconstruct actual active time once you drop the gaps where the AI waited
   for you. Measured on real data: a 9.1-hour span was 1.6 hours of work — 82%
   was waiting.
2. **Working time → revenue.** Hourly rate per client, discounts, and the work
   assigned to the right job.
3. **Revenue → margin.** The API list price is not your cost. Your subscription
   is, proportionally — and above all, your own working time is.
4. **Margin → invoice.** Sequential numbering, legally required fields,
   immutable issued documents, cancellation instead of deletion.

## Quick start

```bash
git clone https://github.com/RobSpct/devbill.git
cd devbill
cp config.example.json config.json     # Windows: copy config.example.json config.json
npm start                              # http://127.0.0.1:4747
```

Requires **Node 22.5 or newer** (uses the built-in `node:sqlite`), tested on
Node 24. **Zero dependencies** — there is no `npm install` step.

The only setting you must provide is `jsonlDir`, pointing at your Claude Code
session files:

| OS | Path |
|---|---|
| Windows | `%USERPROFILE%\.claude\projects` |
| macOS / Linux | `~/.claude/projects` |

Everything else has working defaults. Issuing invoices additionally requires
your business details under `rechnung.aussteller` — until those are filled in,
invoice creation refuses to run rather than producing an invalid document.

`config.json` is deliberately not tracked by git: it holds your business
address, rates and credentials.

```bash
npm test               # self-check of the calculation logic
node ingest.js         # ingest only, no server
npm run proxy          # only if you also meter local models via Ollama
```

## Works with any issue tracker

**No tracker is required at all.** Jobs can be free-form names — you can book
any session onto `WEBSHOP-RELAUNCH` by hand from the Live tab, and it flows
through reporting and invoicing like anything else.

If you *do* use a tracker, there are two independent layers:

**1. Recognition — already tracker-agnostic.** Job keys are detected from the
git branch name via a configurable regular expression:

```json
"ticketRegex": "([A-Z][A-Z0-9]{1,9}-\\d+)"
```

The default matches Jira (`PROJ-123`), **Linear** (`ENG-123`), Shortcut, YouTrack
and anything else using the `ABC-123` convention — unchanged. For a different
scheme (Trello card IDs, GitHub issue numbers), adjust the regex. The rest of
the pipeline treats the job key as an opaque string and never inspects it.

**2. Push-back — one adapter per tracker.** Writing results *back* into your
tracker as a comment is inherently tracker-specific: every API differs, so an
API key alone is not enough. `jira-sync.js` is the reference implementation and
is ~400 lines. A new adapter needs to expose `run({ db })` and gets wired into
one place in `server.js`. Contributions welcome — Linear and Trello are the
obvious next candidates.

Jira is fully optional: set `jira.enabled: false` and the entire tool works,
with the sync endpoint, background job, deep links and UI elements all disabled.

## What it measures

| Figure | Meaning |
|---|---|
| Tokens | Input, output, cache-read and cache-write, deduplicated per request |
| API equivalent | What the same usage would have cost at API list prices |
| Subscription share | Your actual cost — the plan price spread over measured usage |
| Active time | Working time with idle gaps removed (configurable, default 5 min) |
| Work value | Active time × hourly rate, per client and per job |
| Contribution margin | Work value − direct costs |
| Margin | Contribution margin − (hours × your own cost rate) |

Every figure carries its reference in the label. Not "margin", but "margin —
after direct costs and own time". A missing cost block is invisible otherwise.

### Accuracy

Claude Code writes the same API request to the log **multiple times** (one line
per content block, all carrying identical usage figures). Summing naively
overcounts by more than 100%. `devbill` keeps only the latest state per
`requestId`. Verified against `ccusage` over a full month: **0.02% deviation**
($2076.67 vs $2076.65).

### Local models

Local models (Ollama and anything speaking its API) produce no billing data of
their own. An optional proxy sits between your tool and Ollama and records
usage, which is then billed at a configurable flat rate per million tokens
rather than invented API prices.

## Invoicing

- Sequential numbering per year (`2026-0001`), enforced by a unique constraint
- **Issued invoices are immutable**: positions, issuer and amounts are frozen as
  a JSON snapshot at creation time. Correcting an hourly rate later cannot
  retroactively alter a document you already sent.
- Never deleted, only cancelled — the original is marked void, the correction
  gets its own number with negative amounts
- PDF export via headless Chrome or Edge, no extra dependency
- Quotes have their own separate numbering, so an unaccepted quote never leaves
  a gap in your invoice sequence

**Jurisdiction note:** the invoicing module implements **German** requirements
(§ 14 UStG mandatory fields, § 19 small-business exemption, 19% VAT). VAT rate
and small-business status are configurable, but the required-field logic assumes
German law. If you extend this for another country, please make it configurable
rather than replacing it.

## Language

The user interface, configuration comments and source comments are **German**.
This README is the English entry point. UI translation is on the roadmap —
contributions welcome.

## Optional: run it in the background (Windows)

`integration/autostart.ps1` registers a scheduled task that keeps the server
running and restarts it if it dies. `integration/start-hidden.vbs` starts it
without a console window. Both are optional; `npm start` is enough.

## Roadmap

- English user interface
- Linear and Trello sync adapters
- Screenshots in this README
- Partial billing of long-running jobs across month boundaries

## License

AGPL-3.0. If you modify this and offer it as a service, your changes must be
made public.

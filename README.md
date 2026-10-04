# c2invoice

**Turn Claude Code usage into an invoice.**

Local time tracking, cost analysis and invoicing for freelancers who work with
Claude Code. It reads the session logs, reconstructs actual working time, and
produces an invoice PDF. No cloud, no account, no telemetry.

![Node](https://img.shields.io/badge/node-%3E%3D22.5-brightgreen)
![License](https://img.shields.io/badge/license-AGPL--3.0-blue)
![Dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)

Token counters tell you what you consumed. `c2invoice` answers the question a
freelancer actually has: *what can I bill for this, and what's left after
costs?*

It reads Claude Code's session logs after they are written — no hooks, no
wrapper, no interference with running sessions, and **it costs you zero extra
tokens**. Everything runs locally on `127.0.0.1`; nothing is uploaded anywhere.

```
session logs → active working time → hourly value → margin → invoice PDF
```

## What it looks like

Two cost figures sit side by side on purpose. **API equivalent** is what the
same usage would have cost at API list prices — a reference, not a bill. **Subscription
cost** is what you actually paid for the period shown in the tile: your plan price, spread over the months it covers.
The gap between them is usually large, and it is the reason the margin never
uses the list price.

![Overview: API equivalent at list price next to the subscription cost actually paid, active hours, spend over time and split by model](docs/overview.png)

Per job — the margin bar is scaled against your target margin, so "above or
below what I aimed for" is readable at a glance:

![Job detail: token split, work value, contribution margin and margin with a bar scaled against the target](docs/jobs.png)

Where the tokens actually went — MCP servers and skills as ranked bars. Open a
server to see its individual tools, drawn at the same scale as their parent.
Every bar is a share of the same total, not cost on top of it; this view
changes no billing figure:

![Tools tab: MCP servers as horizontal bars, one expanded to show its individual tools indented below](docs/tools.png)

Live, while you work — sessions can be booked onto a job by hand. The burn
rate is the list price of the last 60 minutes extrapolated to an hour: a
snapshot of how intensive the current session is, not an hourly cost:

![Live tab: running sessions with tokens, API equivalent and a field to assign a job](docs/live.png)

*Screenshots use anonymised project, job and tool names.*

## Why this exists

Every tool in this space (ccusage, claude-code-templates, ccgauge, sniffly,
opcode) answers *how many tokens did I burn and what would the API have cost*.
None of them answer *what do I put on the invoice*. Between those two questions
sit four steps:

1. **Usage → working time.** Tokens are not hours. Only the gaps of up to 5
   minutes between two requests count as working time. Longer gaps — thinking
   it over, a meeting, another project, the end of the day — are dropped and
   never reach the invoice. Measured on real data: of a 9.1-hour span, 1.6
   hours were work. The other 82% is not billed.
2. **Working time → revenue.** Hourly rate per client, discounts, and the work
   assigned to the right job.
3. **Revenue → margin.** The API list price is not your cost. Your subscription
   is, proportionally — and above all, your own working time is.
4. **Margin → invoice.** Sequential numbering, legally required fields,
   immutable issued documents, cancellation instead of deletion.

*Published as `devbill` until version 1.0. Renamed in 1.1 to avoid confusion
with an unrelated commercial product of the same name. Same tool, same repo —
the old GitHub URL redirects here, and nothing in your setup needs changing.*

## Quick start

```bash
git clone https://github.com/RobSpct/c2invoice.git
cd c2invoice
cp config.example.json config.json     # Windows: copy config.example.json config.json
npm start                              # http://127.0.0.1:4747
```

Requires **Node 22.5 or newer** (uses the built-in `node:sqlite`), tested on
Node 24. **Zero dependencies** — there is no `npm install` step.

Session files are read from `~/.claude/projects` by default. That path works
on every platform, so there is normally nothing to set. If your logs live
elsewhere, point `jsonlDir` at them. If the directory cannot be found, the
server says so on startup instead of quietly reporting zeros.

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
| Active time | **Your** working time: a window around each of your own inputs. This is what gets billed |
| Agent time | How long the AI ran per session, including when it worked on its own. Shown, never billed |
| Work value | Active time × hourly rate, per client and per job |
| Contribution margin | Work value − direct costs |
| Margin | Contribution margin − (hours × your own cost rate) |

Every figure carries its reference in the label. Not "margin", but "margin —
after direct costs and own time". A missing cost block is invisible otherwise.

### Billable time is your time, not the AI's

An agent that works alone for forty minutes has not worked forty minutes of
*your* time. Two rules keep the hours on an invoice defensible:

**1. Only the window around your own inputs counts.** An input is a typed
prompt, a slash or shell command, an interrupt, or an answer to a question the
agent asked (a choice, a plan approval, a rejected tool call). Tool results,
subagents and programmatic runs (`claude -p`) are not inputs. Each input gets
half the idle threshold before and after it (`gapMinutes`, default 5, so ±2.5
minutes):

- Two inputs at most 5 minutes apart: the time between them counts in full.
- The agent then runs alone for 40 minutes: 5 minutes count, not 40.

**2. A minute counts at most once.** With several sessions open at the same
time, their time spans are merged first and then shared: two parallel sessions
give each job half a minute per minute. One hour on the clock is at most one
hour on the invoice, however many sessions were running. Background tools
(`overheadProjekte`, local models) step back behind the actual work.

**Agent time** is shown next to it: the AI's runtime per session, every log
line counting, parallel sessions counted separately. It tells you how much
machine time sits behind your own time and feeds no amount anywhere.

On the author's own logs (eleven weeks, 614 sessions) this turned 154 logged
hours into 64 billable ones. If you deliberately bill agent supervision as
working time, switch the **time model** to *Activity* under Settings (stored as
`"zeitmodell": "aktivitaet"` in `config.json`): then every log line counts
until a gap exceeds the threshold. Rule 2 applies either way, and the switch
takes effect immediately — issued invoices never change.

The setting under Settings is the **default**. You can override it where the
work actually differs:

| Where | Applies to | Stored in |
|---|---|---|
| Settings → hourly rates, column *Time model* | one project | `config.json`, `projektSaetze` |
| Jobs → open a job, switch *Time model* | one job | the database |
| Live → column *Time model* | one session, with or without a job | the database |

The narrowest choice wins: session, then job, then project, then the default.
Each switch shows the model that applies. Without a choice of its own that is
the inherited default; clicking the other value sets a choice, clicking the
inherited value again removes it, so the entry follows the default if that
changes later. A job whose sessions use different models shows
*varies by session*. Each invoice position stores the time model its hours were
counted with.

Rows read in before version 1.3 carry no input marker yet. As long as their
log files still exist, the next run adds it once; anything older keeps the
`aktivitaet` measure.

### Where the tokens went

Beyond *how much*, the Tools tab answers *what consumed it*. Requests are
attributed to the MCP server that triggered them and to the skill that was
active at the time, each as a ranked bar chart; a server can be opened to show
its individual tools. On real data this surfaced that a single context tool
accounted for the bulk of one server's spend — the kind of thing a flat list of
a hundred rows hides.

Two separate lists on purpose: an MCP server *causes* the request, so the
tokens are genuinely its own. A skill does not — it adds text to a request that
was happening anyway. Its row says *how much ran while this skill was active*,
not *how much the skill cost*. Read as cost attribution, that number would be
wrong, so the tab says so rather than letting you assume otherwise.

This section changes no billing figure. It is marked as such in the interface,
because the numbers above it do feed invoices and the difference matters.

### Accuracy

Claude Code writes the same API request to the log **multiple times** (one line
per content block, all carrying identical usage figures). Summing naively
overcounts by more than 100%. `c2invoice` keeps only the latest state per
`requestId`. Verified against `ccusage` over a full month: **0.02% deviation**
($2076.67 vs $2076.65).

**Models without an exact price are flagged** instead of sitting silently in a
total. If the price list does not know a model, one of two things happens: a
similarly named model exists (its price is used, flagged *estimated*), or none
does (the request counts as 0 USD, flagged *no price*). The overview names the
affected models. Once the price list carries the model, the amount is
recomputed from the stored token counts and the flag disappears.

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

### E-invoice (XRechnung)

Every issued invoice can be downloaded as a structured file from the Invoices
tab: EN 16931 in UN/CEFACT CII syntax, German CIUS **XRechnung 3.0**. The file
is the original for the recipient; the HTML view and the PDF are the reading
copy of the same snapshot. Nothing is recalculated on export — every amount
comes from the stored invoice.

The standard asks for more than § 14 UStG does, so a few fields must be set:

| Where | Field |
|---|---|
| Settings → issuer data | email, phone, IBAN; address with postcode and city on the last line |
| The client's contact | buyer reference, email; address with postcode and city on the last line |
| optional | country (default DE), supplier number, order number per invoice |

The **buyer reference** is the Leitweg-ID for German public authorities, and
whatever reference the client asks for otherwise (cost centre, project name).
For authorities the Leitweg-ID also serves as the electronic address.

If something is missing, the export refuses and names the field — a file with
an empty mandatory field would look finished and be rejected at the
recipient's end. Because issued invoices are immutable, nothing can be added
afterwards: complete the data, cancel the invoice, issue it again. The
interface therefore tells you what is missing the moment you create an invoice.
Invoices from before version 1.3 do not carry the new fields.

**Limits:** no transmission (upload, email or Peppol is up to you), no embedded
attachments, no cash discount terms, one VAT rate per invoice, no reverse
charge, no ZUGFeRD PDF.

**Checked with** KoSIT's official validator (version 1.6.3) and the
XRechnung 3.0.2 validator configuration of 2026-08-31 — the CII D16B schema,
the EN 16931 Schematron and the XRechnung Schematron — across six cases:
standard VAT, small-business exemption, flat-rate position, cancellation,
public authority with Leitweg-ID, client abroad. All six were accepted with no
error and no warning; the same invoice with a wrong total was rejected. This is
the check the receiving platforms run, but it is no substitute for their own
acceptance: before invoicing a public-sector client for the first time, upload
one invoice to the test environment of the receiving platform. KoSIT publishes
new versions on 31 January and 31 July, valid six months later; the identifier
lives in `erechnung.js`.

**Jurisdiction note:** the invoicing module implements **German** requirements
(§ 14 UStG mandatory fields, § 19 small-business exemption, 19% VAT). VAT rate
and small-business status are configurable, but the required-field logic assumes
German law. If you extend this for another country, please make it configurable
rather than replacing it.

## Language

The interface speaks **English and German**. Pick one under Settings; the
choice is remembered per browser, and numbers and dates follow it.

The **invoice document stays German** on purpose. German invoicing law ties
its mandatory fields to German terms, so a translated invoice would not be
legally sound. Only the interface is translated.

Source comments and configuration comments remain German.

## Optional: run it in the background (Windows)

`integration/autostart.ps1` registers a scheduled task that keeps the server
running and restarts it if it dies. `integration/start-hidden.vbs` starts it
without a console window. Both are optional; `npm start` is enough.

## Roadmap

- Linear and Trello sync adapters
- Partial billing of long-running jobs across month boundaries
- ZUGFeRD: the e-invoice embedded in the PDF

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Short version: no dependencies, every
calculation gets a check that actually fails when the logic breaks, and tests
must not depend on your own `config.json`. Tracker adapters are the most
useful thing to contribute right now.

## License

AGPL-3.0. If you modify this and offer it as a service, your changes must be
made public.

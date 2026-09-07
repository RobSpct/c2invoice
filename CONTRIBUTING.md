# Contributing

Thanks for looking. This is a small, dependency-free tool and the bar for
changes is deliberately practical rather than ceremonial.

## Before you start

Open an issue first for anything beyond a bug fix. The tool computes numbers
that end up on invoices, so a change that alters a calculation needs a reason
written down somewhere.

**This repository is published from a private working repository.** Everything
except `README.md`, `LICENSE`, `package.json` and `CLAUDE.md` is overwritten on
the next sync, so a pull request is read as a proposal rather than merged as a
commit: accepted changes are applied upstream and arrive here with the
following sync, and you are credited in the release notes. Nothing is lost, but
your commit will not appear in this repository's history. Say so in the pull
request if that matters to you.

## Ground rules

**No dependencies.** The tool runs on Node's standard library alone, including
the built-in `node:sqlite`. A pull request that adds a package to
`package.json` will be declined unless it replaces significantly more code than
it adds. This is why there is no build step and no `npm install`.

**Every calculation gets a check.** `test/selfcheck.js` is the whole test
suite — plain `assert`, no framework. If you change how a number is derived,
add a check, and verify it actually fails when the logic is broken. A test that
stays green either way protects nothing.

**Tests must not depend on your configuration.** They run against
`config.example.json` values or save and restore what they change. A test that
needs the author's `config.json` tests the installation, not the software.

**Correctness beats convenience on money paths.** Where a value is uncertain,
the tool leaves it blank rather than guessing. Please keep it that way.

## Running things

```bash
cp config.example.json config.json
npm test        # self-check
npm start       # server on http://127.0.0.1:4747
```

The suite runs on Windows, macOS and Linux. If you only have one of them, say
so in the pull request and it will be checked on the others.

## Tracker adapters

The most useful contribution right now. Detection of job keys from branch names
is already tracker-agnostic via `config.ticketRegex` — Linear, Shortcut and
YouTrack work unchanged. What is tracker-specific is pushing results *back*
into the tracker as a comment or field.

`jira-sync.js` is the reference implementation, roughly 400 lines. A new adapter
exposes `run({ db })` and is wired into one place in `server.js`. Linear and
Trello are the obvious next candidates.

## Language

The interface speaks English and German; source comments and configuration
comments are German, and the README is English. New interface strings go
through the translation dictionary rather than being written inline, so both
languages stay complete. Please keep new comments in the language of the file
you are editing so the codebase stays consistent.

The invoice document itself stays German on purpose: German invoicing law ties
its mandatory fields to German terms, so a translated invoice would not be
legally sound.

## Invoicing is German law

The invoicing part implements German requirements (§ 14 UStG, § 19 small
business rule): sequential numbering per year, immutable issued documents,
cancellation instead of deletion. Adapting it to another jurisdiction is a
larger piece of work than it looks — open an issue before starting.

## Legal

The project is licensed under AGPL-3.0-or-later. By contributing you agree your
work is released under the same license.

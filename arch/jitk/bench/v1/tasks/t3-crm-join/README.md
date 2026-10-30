# T3: cross-tool join (meeting transcript to Salesforce)

This task is modeled on the example in Anthropic's "Code execution with MCP"
post. There, a meeting transcript goes from Google Drive into a Salesforce
record without passing through the model. Here the program does more of the
work an agent would actually do with it.

**Prompt** (verbatim in `task.json` `.prompt`): find the 2026-10-29 pipeline
review doc in Drive. For each account item under "Suggested next steps", find
the account by exact name, the active user named as owner, and the open
opportunity. Create a Task, set the opportunity's NextStep, and then create a
`Meeting_Note__c` holding the full doc text. Return the ids, but not the
transcript.

## Data: synthetic, seeded

- **Fixture** (`fixture.ts`, seed 20261029, CPython-compatible MT from
  `tslib/random.ts`): a Salesforce org of 30 Users, 35 Accounts and 71
  Opportunities, plus 4 Drive files. `crm.json` is the org (39 KB, committed).
  All names are invented.
- **The meeting doc**: Google Meet "Notes by Gemini" style. It has a summary,
  per-account details, 12 suggested next steps (one `[Internal]`), then a
  transcript of about 900 utterances: 124,902 characters, 126 KB as UTF-8.
  That fits under Salesforce's 131,072-character long-text limit, which the
  mock enforces.
- **Distractors:**
  - last week's review doc, with other next steps
  - an agenda template and a forecast-notes doc (the latter matches "pipeline
    review 2026-10-29")
  - lookalike accounts that a `LIKE` or prefix query also returns
    (`Meridian Health`, `Meridian Health Systems (Legacy)`, `Cobalt Freight UK
    Ltd`, ...)
  - inactive duplicate Users for two owners
  - closed opportunities on every action account
  - an apostrophe in `O'Hara & Finch LLP`, which needs SOQL escaping
- **Mock services** (`mock.ts`): Drive `files.list`-style search and a doc text
  export. Salesforce v62.0 REST reply shapes (query `{totalSize, done,
  records:[{attributes,...}]}`, create/update `{id, success, errors}`, errors as
  `[{message, errorCode}]`), with a SOQL subset: SELECT/FROM/WHERE with
  AND/OR/parentheses, `= != < > <= >= IN NOT IN LIKE`, ORDER BY, LIMIT. Ids
  are valid 18-character Salesforce ids. A created record's id is derived from
  the request, so replays are stable. The mock does not keep writes between
  calls, so every program sees the same org.
- **Latencies** (`lib/synthetic.ts`) are log-normal (sigma 0.35), seeded by the
  call key. Medians: Drive search 240 ms; doc export 380 ms plus 600 ms/MB;
  SOQL 160 ms plus 0.8 ms/row; retrieve 110 ms; create 210 ms plus 800 ms/MB
  of request; update 190 ms.
- **Generation:** `generate.ts` runs the five programs against the mock in
  record mode and writes `responses.jsonl` (461 KB, 129 recordings; gitignored,
  sha256 in `../manifest.json`). `materialize.ts` runs it. It is
  deterministic, so add new programs and re-run it to record their calls.

## Sizes per run

| Program                                                                                          | Calls | Response bytes | Request bytes | Largest round trip             |
| ------------------------------------------------------------------------------------------------ | ----- | -------------- | ------------- | ------------------------------ |
| 1 sequential, 3 queries per item                                                                 | 58    | 136 KB         | 134 KB        | 127 KB doc in, 126 KB note out |
| 2 `Promise.all` per item                                                                         | 58    | 137 KB         | 135 KB        | same                           |
| 3 batched `IN (...)` queries                                                                     | 28    | 136 KB         | 132 KB        | same                           |
| 4 fetches more: all 4 docs, whole Account/User/Opportunity tables, `getRecord` before each write | 42    | 279 KB         | 132 KB        | same                           |
| 5 `LIKE` prefix + exact filter, batches of 3                                                     | 58    | 141 KB         | 134 KB        | same                           |

## What it stresses

The canonical code-mode claim: a 126 KB intermediate comes in from one tool
and goes out to another (as a request argument), while the answer stays
around 3 KB. It also tests multi-step joins with a distractor at every step,
and SOQL string escaping.

## Oracle

`oracle.ts` finds the recorded 2026-10-29 doc and parses its next steps with
its own string slicing. It resolves each item against `crm.json`, then checks
the 11 items field by field and in order. It also checks the writes the
answer claims:
- each `taskId` must be a recorded Task create with the right
  WhatId/OwnerId/Subject/ActivityDate/Status/Priority
- a NextStep update must be recorded for each opportunity
- `meetingNoteId` must be a recorded `Meeting_Note__c` create whose
  `Transcript__c` equals the doc text exactly

An answer over 16 KB fails, because it would be carrying the transcript.

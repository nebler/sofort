// T3 fixture, fully synthetic and seeded: a Salesforce org (Users, Accounts,
// Opportunities, Events) and a Drive folder with two weekly pipeline review
// docs in Google Meet "Notes by Gemini" style (summary, details, suggested
// next steps, then the full transcript), plus two small distractor docs.
// All company and person names are invented.
import { PythonRandom, pick } from '../lib/synthetic.ts';

export const SEED = 20261029;
export const MEETING_DATE = '2026-10-29';
export const TARGET_DOC = 'Weekly pipeline review – 2026-10-29 – Notes by Gemini';

export interface SfRecord {
  Id: string;
  [field: string]: unknown;
}
export interface Org {
  User: SfRecord[];
  Account: SfRecord[];
  Opportunity: SfRecord[];
}
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  owners: { displayName: string; emailAddress: string }[];
  content: string;
}
export interface Fixture {
  org: Org;
  files: DriveFile[];
  // Ground truth for README and sanity checks only; the oracle re-parses the doc.
  items: { account: string | null; owner: string; action: string; due: string }[];
}

// Salesforce 18-character ids: 15 case-sensitive chars plus a 3-char suffix
// encoding which of the 15 are upper case.
const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export function sfId(prefix: string, pod: string, n: number): string {
  let body = '';
  for (let i = 0, v = n; i < 7; i++, v = Math.floor(v / 62)) body = B62[v % 62] + body;
  const id15 = prefix + pod + '00000'.slice(0, 15 - prefix.length - pod.length - 7) + body;
  let suffix = '';
  for (let chunk = 0; chunk < 3; chunk++) {
    let bits = 0;
    for (let i = 0; i < 5; i++) {
      const c = id15[chunk * 5 + i];
      if (c >= 'A' && c <= 'Z') bits |= 1 << i;
    }
    suffix += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345'[bits];
  }
  return id15 + suffix;
}

const TEAM = [
  'Dana Whitfield',
  'Priya Raman',
  'Marcus Oyelaran',
  'Sofia Lindqvist',
  'Tomás Herrera',
  'Keiko Ashworth',
  'Ben Castellanos',
  'Ruth Adebayo-Klein',
];
const OTHER_USERS = [
  'Alan Pierce',
  'Beatriz Moura',
  'Chen Wei',
  'Daria Volkova',
  'Elias Brandt',
  'Fatima Zahra Idrissi',
  'Gareth Lloyd',
  'Hana Kobayashi',
  'Ivan Petrov',
  'Jonas Meyer',
  'Kavya Iyer',
  'Liam O’Sullivan',
  'Mei Lin Tan',
  'Nadia Haddad',
  'Oscar Lindgren',
  'Paula Ferreira',
  'Quentin Laurent',
  'Rosa Jiménez',
  'Samuel Okafor',
  'Tessa van Dijk',
];
const ACTION_ACCOUNTS = [
  'Meridian Health Systems',
  'Cobalt Freight GmbH',
  "O'Hara & Finch LLP",
  'Kestrel Robotics',
  'Juniper Foods Ltd',
  'Nimbus Analytics Inc.',
  'Harbor Capital Partners',
  'Granite Energy',
  'Lumen Retail Group',
  'Fjord Labs AS',
  'Pinnacle Logistics',
];
// Accounts whose names collide with an action account under LIKE or a prefix
// match: the distractor join.
const LOOKALIKES = [
  'Meridian Health',
  'Meridian Health Systems (Legacy)',
  'Cobalt Freight UK Ltd',
  'Kestrel Robotics Services',
  'Granite Energy Storage',
  'Pinnacle Logistics Canada',
];
const OTHER_ACCOUNTS = [
  'Alder Biotech',
  'Birch Hospitality',
  'Delta Water Utilities',
  'Ember Studios',
  'Iris Telecom',
  'Orchard Insurance',
  'Quarry Construction',
  'Ridge Outdoor Co.',
  'Summit Learning',
  'Tidal Payments',
  'Vale Pharmaceuticals',
  'Wren Aerospace',
  'Yarrow Media',
  'Zephyr Mobility',
  'Aster Semiconductors',
  'Basalt Mining',
  'Cypress Hotels',
  'Dune Solar',
];
const INDUSTRIES = [
  'Healthcare',
  'Transportation',
  'Legal',
  'Manufacturing',
  'Food & Beverage',
  'Technology',
  'Finance',
  'Energy',
  'Retail',
  'Education',
];
const PRODUCTS = [
  'Platform renewal',
  'Insights tier upgrade',
  'Data Connectors add-on',
  'Enterprise expansion',
  'Pilot to production',
  'Multi-region rollout',
];
const STAGES_OPEN = ['Qualification', 'Needs Analysis', 'Proposal/Price Quote', 'Negotiation/Review'];
const COMPETITORS = ['Corvane', 'Hexlo', 'Brightpath', 'Quanta Suite'];
const CONTACTS = [
  'Laura',
  'Henrik',
  'Amara',
  'Diego',
  'Yuki',
  'Oliver',
  'Ines',
  'Rahul',
  'Grace',
  'Matteo',
  'Zoe',
  'Anders',
];

const ACTIONS: [string, string][] = [
  [
    'Send the revised statement of work with the phased rollout',
    'I’ll send them the revised SOW with the phased rollout',
  ],
  ['Schedule a security review with their CISO', 'I’ll get the security review with their CISO on the calendar'],
  [
    'Share the updated pricing proposal including the multi-year discount',
    'I’ll share the updated pricing with the multi-year discount',
  ],
  ['Book an executive sponsor call with our CRO', 'let me book an exec sponsor call with our CRO'],
  [
    'Send the signed DPA and the subprocessor list to legal',
    'I’ll get the signed DPA and the subprocessor list over to their legal team',
  ],
  [
    'Prepare a reference call with a customer in the same industry',
    'I’ll line up a reference call with someone in their industry',
  ],
  [
    'Confirm the procurement timeline and the PO number',
    'I’ll confirm the procurement timeline and chase the PO number',
  ],
  ['Deliver the ROI model for the expansion to the CFO', 'I’ll put together the ROI model for their CFO'],
  [
    'Run the technical deep dive on the data connectors',
    'I’ll run the technical deep dive on the connectors with their architects',
  ],
  ['Send the mutual action plan for sign-off', 'I’ll send over the mutual action plan so they can sign off'],
  [
    'Follow up on the pilot success criteria with the project lead',
    'I’ll follow up on the pilot success criteria with their project lead',
  ],
];

function money(n: number): string {
  return '$' + n.toLocaleString('en-US');
}

function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
}

function emailOf(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z ]/g, '')
      .trim()
      .replace(/ +/g, '.') + '@example.com'
  );
}

function buildOrg(rng: PythonRandom): Org {
  const User: SfRecord[] = [];
  let n = 1;
  const userId = () => sfId('005', 'Hp', 4100 + n++);
  for (const name of [...TEAM, ...OTHER_USERS]) {
    User.push({
      Id: userId(),
      Name: name,
      Email: emailOf(name),
      IsActive: true,
      Title: TEAM.includes(name)
        ? name === 'Dana Whitfield'
          ? 'VP Sales, EMEA'
          : 'Account Executive'
        : pick(rng, ['Account Executive', 'Sales Engineer', 'Customer Success Manager', 'SDR']),
      Department: 'Sales',
    });
  }
  // A deactivated duplicate of an action owner: a user who left and came back.
  User.push({
    Id: userId(),
    Name: 'Marcus Oyelaran',
    Email: 'marcus.oyelaran.old@example.com',
    IsActive: false,
    Title: 'Account Executive',
    Department: 'Sales',
  });
  User.push({
    Id: userId(),
    Name: 'Keiko Ashworth',
    Email: 'keiko.ashworth+2019@example.com',
    IsActive: false,
    Title: 'SDR',
    Department: 'Sales',
  });

  const Account: SfRecord[] = [];
  const Opportunity: SfRecord[] = [];
  let a = 1;
  let o = 1;
  const team = User.filter(u => TEAM.includes(u.Name as string) && u.IsActive && u.Name !== 'Dana Whitfield');
  const all = [...ACTION_ACCOUNTS, ...LOOKALIKES, ...OTHER_ACCOUNTS];
  for (const name of all) {
    const owner = pick(rng, team);
    const id = sfId('001', 'Hp', 88000 + a++ * 37);
    Account.push({
      Id: id,
      Name: name,
      Industry: pick(rng, INDUSTRIES),
      Type: pick(rng, ['Customer', 'Customer', 'Prospect']),
      BillingCountry: pick(rng, [
        'Germany',
        'United Kingdom',
        'Netherlands',
        'Sweden',
        'France',
        'Ireland',
        'Norway',
        'United States',
      ]),
      AnnualRevenue: (5 + rng.randrange(400)) * 1_000_000,
      NumberOfEmployees: 50 + rng.randrange(20000),
      OwnerId: owner.Id,
    });
    const action = ACTION_ACCOUNTS.includes(name);
    const count = 1 + rng.randrange(3);
    for (let k = 0; k < count; k++) {
      // Action accounts: the first opportunity is the one open deal; others are closed.
      const open = action ? k === 0 : rng.random() < 0.5;
      const closeDate = open ? addDays('2026-11-15', rng.randrange(120)) : addDays('2025-06-01', rng.randrange(480));
      const stage = open ? pick(rng, STAGES_OPEN) : pick(rng, ['Closed Won', 'Closed Won', 'Closed Lost']);
      const shortName = name.replace(/ (GmbH|Ltd|Inc\.|LLP|AS)$/, '');
      Opportunity.push({
        Id: sfId('006', 'Hp', 51000 + o++ * 53),
        Name: `${shortName} – ${pick(rng, PRODUCTS)} ${open ? 'FY27' : pick(rng, ['FY25', 'FY26'])}`,
        AccountId: id,
        StageName: stage,
        IsClosed: !open,
        IsWon: stage === 'Closed Won',
        Amount: (20 + rng.randrange(900)) * 1000,
        CloseDate: closeDate,
        Probability: open ? [10, 25, 50, 75][STAGES_OPEN.indexOf(stage)] : stage === 'Closed Won' ? 100 : 0,
        NextStep: open
          ? pick(rng, ['Waiting on procurement', 'Legal review', 'Pricing call', 'Champion follow-up', null])
          : null,
        OwnerId: owner.Id,
      });
    }
  }
  return { User, Account, Opportunity };
}

interface Item {
  account: string | null;
  owner: string;
  action: string;
  spoken: string;
  due: string;
}

// One meeting doc: notes header, details, next steps, transcript.
function buildMeeting(
  rng: PythonRandom,
  org: Org,
  date: string,
  items: Item[],
  discussed: string[],
  targetChars: number,
): string {
  const ownerOf = (account: string) => {
    const acc = org.Account.find(x => x.Name === account)!;
    return org.User.find(u => u.Id === acc.OwnerId)!.Name as string;
  };
  const lines: string[] = [];
  let t = 3;
  const say = (speaker: string, text: string) => {
    lines.push(`${clock(t)} ${speaker}: ${text}`);
    t += 3 + rng.randrange(7);
  };
  const details: string[] = [];
  say(
    'Dana Whitfield',
    'Okay, it’s two past, let’s get going. Same format as always: we go account by account, commits first, then upside.',
  );
  say('Priya Raman', 'Sounds good. Can everyone see the forecast sheet? I shared it in the chat.');
  say(
    'Dana Whitfield',
    'Got it. Before we start, reminder that the quarter closes in five weeks, so I want honest stages today.',
  );
  for (const account of discussed) {
    const rep = ownerOf(account);
    const opp =
      org.Opportunity.find(x => org.Account.find(acc => acc.Name === account)!.Id === x.AccountId && !x.IsClosed) ??
      org.Opportunity.find(x => org.Account.find(acc => acc.Name === account)!.Id === x.AccountId)!;
    const contact = pick(rng, CONTACTS);
    const competitor = pick(rng, COMPETITORS);
    const amount = money(opp.Amount as number);
    const start = t;
    say(
      'Dana Whitfield',
      pick(rng, [
        `Next up, ${account}. ${rep}, where are we?`,
        `${account}. ${rep}, give us the latest.`,
        `Let’s do ${account}. What changed since last week?`,
      ]),
    );
    say(
      rep,
      `So ${account} is sitting at ${opp.StageName}, ${amount}, close date ${opp.CloseDate}. ${pick(rng, ['Overall I feel good about it.', 'Honestly it’s been a slow couple of weeks.', 'There’s been real movement this week.', 'It’s tracking, but there are a couple of risks.'])}`,
    );
    const turns = 24 + rng.randrange(20);
    for (let k = 0; k < turns; k++) {
      const who = k % 3 === 0 ? 'Dana Whitfield' : k % 3 === 1 ? rep : pick(rng, TEAM);
      say(
        who,
        pick(rng, [
          `${contact} on their side is still our champion, but she’s been pulled into a reorg and her calendar is a mess.`,
          `They’re also talking to ${competitor}. ${competitor} came in about fifteen percent under us on the first year.`,
          `The blocker is really legal. Their counsel wants changes to the liability cap and the DPA language.`,
          `Procurement told us they need three quotes on file before anything over a hundred thousand goes through.`,
          `Do we have a mutual action plan with them, or is it all in email?`,
          `I’d push on the timeline. If the close date slips into next quarter, I want to know now, not in week twelve.`,
          `The pilot numbers were good: ingestion time dropped by about forty percent and the analysts actually used the dashboards.`,
          `Their CFO asked for an ROI story that isn’t just headcount savings. Something about faster month-end close.`,
          `We should bring in solutions engineering, the connector questions are getting pretty deep.`,
          `Are they budgeted for this fiscal year or are we hoping for end-of-year money?`,
          `They said budget is approved, but it sits with the platform team, not with ${contact}’s group.`,
          `I wouldn’t discount further. If anything we trade the discount for a three-year term.`,
          `Security questionnaire is done, two hundred and twelve questions, we only had three open items.`,
          `What’s the risk they just renew the incumbent and push this to next year?`,
          `I’d say medium. ${competitor} is cheaper, but they can’t do the on-prem connector.`,
          `Okay, and who else is in the buying group? Last time it was IT, finance and the data office.`,
          `We met the data office on Tuesday. Good meeting, they asked for a reference in their industry.`,
          `Can we get their architects on a call with ours next week? That usually unblocks things.`,
          `Their fiscal year ends in March, so there’s some urgency on their side too.`,
          `Let’s not move the stage until we have the paper process confirmed.`,
          `For the forecast I’d keep it in commit, but flag it.`,
          `I’m fine with that. Just put the risk in the notes field so finance sees it.`,
          `Quick one: is the amount still including the professional services, or did that get carved out?`,
          `Services got carved out into a separate SOW, so the number is subscription only now.`,
          `Got it, thanks.`,
          `Yeah, that matches what I heard from their side as well.`,
          `Mm-hm. Okay.`,
        ]),
      );
    }
    const item = items.find(x => x.account === account);
    let note = `${rep} reported ${account} at ${opp.StageName} (${amount}, close ${opp.CloseDate}); ${competitor} is competing and the team discussed timeline risk`;
    if (item) {
      say('Dana Whitfield', 'So what’s the next step, concretely?');
      say(
        item.owner,
        `Okay, action item for me: ${item.spoken}, by ${new Date(item.due + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}.`,
      );
      say('Dana Whitfield', 'Great, put it in Salesforce so it doesn’t get lost.');
      note += `; ${item.owner} owns the next step`;
    } else {
      say(
        'Dana Whitfield',
        pick(rng, [
          'Okay, let’s keep watching that one.',
          'Fine, nothing new to do there this week.',
          'Alright, moving on.',
        ]),
      );
    }
    details.push(`* **${account}**: ${note} (${clock(start)}).`);
  }
  // Pad with general discussion until the doc reaches its target size.
  while (lines.join('\n').length < targetChars) {
    say(
      pick(rng, TEAM),
      pick(rng, [
        'On the forecast overall, I think we’re about two hundred K light against the plan if nothing slips in.',
        'Marketing says the webinar next week has three hundred registrations, mostly mid-market.',
        'Can we talk about the deal desk turnaround? We waited four days for a non-standard discount approval.',
        'The new CPQ template is live, please use it, the old one has the wrong price book.',
        'Reminder that the partner summit is in Lisbon on the eighteenth.',
        'If anyone needs SE time next week, book it today, the calendar is filling up.',
        'I’ll be out Friday, Ben is covering my accounts.',
        'Has anyone tried the new sequences in the outreach tool? The reply rates look better.',
        'Let’s make sure close dates are realistic before the board deck goes out.',
      ]),
    );
  }
  say('Dana Whitfield', 'Okay, that’s time. Thanks everyone, please update your next steps today.');

  const steps = items.map(
    item => `- [ ] [${item.account ?? 'Internal'}] ${item.owner}: ${item.action}. Due ${item.due}.`,
  );
  return [
    `Weekly pipeline review – ${date}`,
    `Notes by Gemini · ${date} 16:00 CET`,
    `Invited: ${TEAM.join(', ')}`,
    'Attachments: Weekly pipeline review – forecast sheet',
    '',
    'Summary',
    `The team reviewed ${discussed.length} accounts in the EMEA pipeline. Dana Whitfield asked for realistic stages and close dates ahead of the board deck. Several deals face legal and procurement delays, and competitive pressure from ${COMPETITORS.slice(0, 2).join(' and ')} came up repeatedly.`,
    '',
    'Details',
    ...details,
    '',
    'Suggested next steps',
    ...steps,
    '',
    'You should review Gemini’s notes to make sure they’re accurate. Get tips and learn how Gemini takes notes.',
    '',
    'Transcript',
    ...lines,
    '',
    'Meeting ended after ' + clock(t) + '.',
  ].join('\n');
}

export function buildFixture(): Fixture {
  const rng = new PythonRandom(SEED);
  const org = buildOrg(rng);
  const owners = TEAM.filter(name => name !== 'Dana Whitfield');
  const items: Item[] = ACTION_ACCOUNTS.map((account, i) => ({
    account,
    owner: owners[i % owners.length],
    action: ACTIONS[i][0],
    spoken: ACTIONS[i][1],
    due: addDays(MEETING_DATE, 3 + rng.randrange(12)),
  }));
  items.splice(5, 0, {
    account: null,
    owner: 'Dana Whitfield',
    action: 'Update the EMEA forecast sheet before the board deck review',
    spoken: 'I’ll update the forecast sheet before the board deck review',
    due: addDays(MEETING_DATE, 4),
  });
  const shuffledOthers = [...OTHER_ACCOUNTS, ...LOOKALIKES.slice(0, 3)];
  rng.shuffle(shuffledOthers);
  const discussed = [...ACTION_ACCOUNTS, ...shuffledOthers.slice(0, 12)];
  rng.shuffle(discussed);
  const target = buildMeeting(rng, org, MEETING_DATE, items, discussed, 118_000);

  // Last week's doc: other accounts, other next steps (all already done).
  const lastWeekItems: Item[] = shuffledOthers.slice(0, 6).map((account, i) => ({
    account,
    owner: owners[(i + 3) % owners.length],
    action: ACTIONS[(i + 4) % ACTIONS.length][0],
    spoken: ACTIONS[(i + 4) % ACTIONS.length][1],
    due: addDays('2026-10-22', 2 + rng.randrange(6)),
  }));
  const lastWeek = buildMeeting(rng, org, '2026-10-22', lastWeekItems, shuffledOthers.slice(0, 14), 96_000);

  const owner = [{ displayName: 'Dana Whitfield', emailAddress: 'dana.whitfield@example.com' }];
  const doc = 'application/vnd.google-apps.document';
  const files: DriveFile[] = [
    {
      id: '1qZt8kWvL3c9XHr2pNfA0sJmBdEoY7uGi4TbVwKx5RlM',
      name: TARGET_DOC,
      mimeType: doc,
      modifiedTime: '2026-10-29T17:41:09.512Z',
      owners: owner,
      content: target,
    },
    {
      id: '1Hc4mR7yQ2nWfZ8tKbE6vLsP0aXjU3dGo9IqTzNk1BwY',
      name: 'Weekly pipeline review – 2026-10-22 – Notes by Gemini',
      mimeType: doc,
      modifiedTime: '2026-10-22T17:38:44.120Z',
      owners: owner,
      content: lastWeek,
    },
    {
      id: '1Vb9sN2kD5wQ8xLr3TmF7jYc0HpE6uAz4GiKoRtW1qSe',
      name: 'Weekly pipeline review – agenda template',
      mimeType: doc,
      modifiedTime: '2026-09-02T09:12:30.004Z',
      owners: owner,
      content:
        'Weekly pipeline review – agenda template\n\n1. Commits (owner, stage, amount, close date)\n2. Upside\n3. Risks and asks\n4. Next steps: one line per action, [Account] Owner: action. Due YYYY-MM-DD.\n',
    },
    {
      id: '1Pq3Lx8Zr6Nc1VbT9yWk4HdF2sJm7EoA0GuQiR5tKwXe',
      name: 'Weekly pipeline review – forecast sheet notes',
      mimeType: doc,
      modifiedTime: '2026-10-29T15:55:02.871Z',
      owners: owner,
      content:
        'Forecast sheet notes – 2026-10-29\n\nCommit: on track, 200K light vs plan.\nUpside: Meridian Health Systems, Kestrel Robotics.\n',
    },
  ];
  return { org, files, items: items.map(({ account, owner, action, due }) => ({ account, owner, action, due })) };
}

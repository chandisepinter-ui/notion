# Titan SOC Academy — Phase 1 Foundation

A standalone training platform for Titan Protection & Consulting SOC dispatch operators.
This build is the **Phase 1 foundation**: design system, navigation, three role experiences,
database, permissions, the seven-day roadmap, a reusable lesson engine, and one fully
working demonstration module (IMMIX alert investigation).

> **Two kinds of content:**
> 1. **Titan curriculum (38 modules, Days 1–7)** — imported from the Power Apps Academy build with
>    `npm run content:import`. It is real Titan content, so it is **never stored in this repository**;
>    it lives only in the git-ignored `content-import/` folder on your computer.
> 2. **IMMIX practice lab** (built in) — fully fictional sites and response plans used to demonstrate
>    the simulated alarm console. Not Titan policy.

---

## Start it on Windows (first time)

You need **Node.js 20.9 or newer** (22 LTS recommended).

1. **Install Node.js** (one time): download the **LTS** installer from <https://nodejs.org> and run it with
   the default options. If you cannot install software on a company computer, ask IT — Node.js is the
   only requirement.
2. **Open the project folder** in File Explorer (`titan-soc-academy`). Click the address bar, type
   `powershell`, press **Enter**. A blue PowerShell window opens in that folder.
3. **Install the app's building blocks** (one time, takes a few minutes):
   ```powershell
   npm install
   ```
4. **Set up the database and demo accounts** (one time):
   ```powershell
   npm run setup
   ```
   This creates a private `.env` settings file, the local database (`data\titan-academy.db`) and the
   fictional demonstration accounts.
5. **Start the app:**
   ```powershell
   npm run dev
   ```
6. Open **<http://localhost:3000>** in Edge or Chrome.

To stop the app, click the PowerShell window and press **Ctrl + C**.
Next time, you only need step 2 and `npm run dev`.

> If PowerShell says *"running scripts is disabled on this system"*, use **Command Prompt** instead
> (type `cmd` in the address bar in step 2) — the commands are identical.

---

## Importing Titan content (once per computer, and after content changes)

The real curriculum comes from your Power Apps Academy build in OneDrive:
`SOC Academy › titan-soc-academy › data › seeds › import`

1. In the project folder, create the folder `content-import\powerapps` (if it is not there).
2. Copy these files from the OneDrive `import` folder into `content-import\powerapps`:
   `SOC_Academy_Curriculum_modules.csv`, `SOC_Academy_Lessons.csv`, `SOC_Academy_Assessment_Items.csv`,
   `SOC_Academy_Answer_Keys.csv`, `SOC_Academy_Scenario_Catalog.csv`, `SOC_Academy_Conflicts.csv`,
   `SOC_Academy_Source_Registry.csv`, `SOC_Academy_Media.csv` — plus
   `SOC_Academy_Day7_Competencies_catalog.csv` from the `seeds` folder one level up.
3. Run:
   ```powershell
   npm run content:import
   ```
   It checks every answer key, reports any content problems, and loads the modules.
4. Restart `npm run dev`. The Academy now shows all 38 modules.

What the import does with your content:
* Mastery = **90% of scored questions with no safety-critical errors** (from ACADEMY_DIRECTION_2026).
* Questions tied to an **OPEN conflict** in `SOC_Academy_Conflicts.csv` are shown but **not scored**.
* Each module shows its source status (*Source-grounded · pending approval*, *Partial source*, *Needs source*).
* Training videos appear only once marked approved in `SOC_Academy_Media.csv` (none are yet).
* Modules without approved graded content (e.g. *Living the Motto*) record **Completed — pending source**.
* Simulator scenarios S01–S10 are imported too. The IMMIX workstation runs the ones that need only
  Computer 1 (currently **S01, S02, S04**); the rest show *Needs Computer 2* until HubSpot, phones,
  TrackTik, radio and Outlook/Teams are simulated.
* **Day 7 is the eight-hour simulated validation shift** (owner decision, 2026-11-04). The Power Apps
  live-shift module (D7M01) is set aside by the import; the simulated shift arrives with the simulator.

## IMMIX simulator (Computer 1)

Open **Simulator** in the menu. The workstation is a replica of the Titan IMMIX Cloud screens, built
from the sanitized reference screenshots (colours, layout and controls measured from them):
Alarms home (red alert background, orange queue rows, **PROCESS ALARM**, Patrols / Parked Events /
On Test) → event screen (event clip with the clip dropdown and player bar, Cameras / Audio / Edge
Devices, live view with its toolbar, the bottom tabs) → **Close Event** (two-level outcome),
**Park Event**, and **MultiView**, which opens in its own window as on the live system.

### Real camera footage (local only)

The cameras show real Titan camera stills (owner-authorized 2026-11-04), never stored on GitHub.
To install them on a computer:

1. From SharePoint **SOC Academy Simulation Assets › IMMIX**, download `Event - Notes.png`,
   `Event - Maps.png` and `Event - Multiview.png` into `content-import\reference\immix`.
2. Run `npm run media:import`. It cuts 16 camera stills into `content-import\media\immix`.

After dark (scenario time 18:00–07:00) day stills switch to infrared black-and-white, as real cameras
do. To pin a specific still to a camera, create `content-import\media\immix\cameras.json`, e.g.
`{ "SITE-ID/CAM 02": "mv-04.jpg" }`. Without stills the simulator uses drawn scenes.

### Guided IMMIX walkthroughs (local only)

The 30 click-through walkthroughs from the Power Apps build (161 frames, Days 2–3) appear on each
module's **"Watch again — now spot each step"** step. The trainee clicks where they would click in
IMMIX; a wrong click shows the hint, two wrong clicks outline the target. Ungraded GUIDE practice:
completion and the best wrong-click count are saved to the trainee's progress. To install:

```
npm run media:walkthroughs -- "<OneDrive>\SOC Academy\titan-soc-academy\simulator\scenario_assets"
```

Frames go to `content-import\media\walkthroughs` (git-ignored) and are served only to signed-in users.
A walkthrough whose frames are missing is hidden rather than shown broken.

### Screens and how they behave

Built from the IMMIX screenshots in SharePoint (Simulation Assets › IMMIX; Dispatch Center › How To Videos ›
Screenshots › Immix: *Immix Tabs*, *Close Outs*, *E-Care*):

* **Close Event** — level-1 *Outcome* (eCare, Highlander Power Alarm, Incident/Action Taken, IT, Nuisance,
  Off Site Activity, On Site Activity) then the level-2 *Select Outcome* list for that category.
* **Raise** — "Raise to routing group". **Details** — separate window: Site Details, Call List, Site Staff,
  Maintainer, Arming Schedule. There are no call buttons: calls are made on the phone and documented in
  **Audit Event › Notification** (Subscriber / Police / Fire Dept, No Answer / Call Made, Additional Details).
  *Close Event* is disabled while Audit Event is open, as on the live system.
* **Arming/Disarming**, **Problems** (Add a new problem), **Notes › Add new note** (Note Details).
* Site Time follows the site's time zone (from its address); operator time zone = `SOC_TIME_ZONE`.

Not simulated (shown as such): Dashboard/Setup/Reports/Events/Cameras/Walls pages, Edge Devices, Disarm Site
effects, and live microphone audio (in training you type what you would say).

The live close-out lists are read from `content-import\reference\immix\outcomes.json` (local). Scenario
outcome *Audio Talk Down Threat Eliminated* is matched to *Incident/Action Taken › Successful Audio Talkdown*
pending your ruling on conflict C12.

## Deciding source conflicts

Sign in as the Administrator and open **Administration → Content Decisions**. For each open conflict,
choose Source A, Source B, your own ruling, or "not applicable", and write the ruling in plain words.
Operators see your ruling immediately under every learn card and question the conflict affects.
Every ruling is kept (newest wins) and recorded in the audit log. Rulings are stored only in your local
database. Afterwards, update the source content to match and re-run `npm run content:import`.
* Operators unlock modules in order; supervisors and administrators can preview any module.

## Try it (5-minute tour)

| Sign in as | What to look at |
|---|---|
| **Jordan Reyes** — Operator | Dashboard “Your next step” → **Start training**. Work through the IMMIX module: briefing, demonstration, guided alert (try a wrong answer to see feedback), practice, full challenge, verification. Leave midway and come back — it resumes exactly where you were. |
| **Morgan Ellis** — Supervisor | Sees only *assigned* trainees (Jordan). Open Jordan to review every answer, recurring mistakes, competencies, and add a remediation note. |
| **Riley Chen** — Senior Supervisor | Sees *every* trainee — granted by a permission, not by name. |
| **Taylor Quinn** — Administrator | Grant/remove roles, assign trainees to supervisors, view the permission matrix, curriculum status, SME-approval list and audit log. |
| **Sam Okafor** — Operator (Nights) | A second trainee who is *not* assigned to Morgan. |

Use **Switch demo account** (top bar) to change accounts. The theme switch (sun/moon) is in the top bar;
text size and motion are under **Profile & Preferences**.

**Start over:** `npm run db:reset` erases all *local* progress and rebuilds the demo data.

---

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the app at http://localhost:3000 |
| `npm run setup` | Creates `.env`, the database tables, curriculum and demo accounts (safe to re-run) |
| `npm run db:reset` | Deletes the local database and rebuilds it (all local progress is lost) |
| `npm run check` | Type-check + unit tests of the lesson engine |
| `npm run content:import` | Imports the Titan curriculum from `content-import\powerapps` (see above) |
| `npm run media:import` | Builds the IMMIX camera stills from the reference screenshots (see IMMIX simulator) |
| `npm run media:walkthroughs -- "<folder>"` | Installs the guided IMMIX walkthroughs from the OneDrive `scenario_assets` folder |
| `npm run test:e2e` | Full browser test of every role and the practice lab, using a separate throwaway database and no Titan content. First run `npx playwright install chromium` once. |
| `npm run test:content` | Browser check of the imported Titan content: every module opens and every step works |

The full browser suite includes a real-time simulator run (about 3 minutes, because the two-minute
MultiView verification is watched live).
| `npm run build` then `npm start` | Production-style build and run |

---

## Security: demonstration sign-in vs. production

* `AUTH_MODE=demo` (the default in `.env`) lets **anyone pick any account**. It exists only for local
  testing. Every page shows a **“Demonstration mode — not secure”** banner while it is on.
* `AUTH_MODE=production` disables demo sign-in completely. **Company sign-in (Microsoft Entra ID) is not
  built yet** — it is planned before any deployment. Do not deploy this build for real use.
* Sessions are signed with `SESSION_SECRET` (generated by `npm run setup`, stored only in `.env`, which is
  never committed). Roles and permissions are re-read from the database on every request, so a role
  change takes effect immediately.
* Lesson answer keys never reach the browser until an answer has been graded on the server; the server
  also refuses a decision if the required evidence has not been reviewed.

---

## How it is built (for whoever maintains it)

| Area | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router) + **React 19** + **TypeScript** | Current, well-supported, one codebase for pages and server logic. |
| Styling | **Tailwind CSS 4** + design tokens in `src/app/globals.css` | Every color is a token, so light/dark stay consistent. |
| Database | **SQLite** via **Drizzle ORM** + `@libsql/client` | *Deviation from Prisma:* Drizzle needs no extra engine downloads, which is more reliable on locked-down Windows networks. Tables use portable column types; moving to PostgreSQL means re-declaring `schema.ts` with `drizzle-orm/pg-core` and changing `DATABASE_URL`. |
| Auth | Signed HTTP-only session cookie (`jose`) + database permissions | Demo-only sign-in today; Entra ID (OpenID Connect) will plug into the same session layer. |
| Icons / fonts | `lucide-react`, Inter & JetBrains Mono bundled locally | No calls to external services at runtime. |

```
src/
  app/                    pages (each folder = a URL)
    (app)/                signed-in area: dashboard, academy, supervisor, admin, …
    login/                demonstration sign-in
  components/
    ui/                   design system: Button, Panel, Badge, Progress, Planned, …
    shell/                navigation, theme toggle, preferences
    lesson/               lesson player, simulated IMMIX console, camera renderer, feedback
  content/
    curriculum.ts         7-day structure, module list, skills, arcade, demo accounts
    modules/              lesson content as structured data (one file per module)
  lib/
    academy/engine.ts     lesson rules: grading, feedback, mastery, remediation (pure, unit-tested)
    academy/view.ts       strips answer keys before anything is sent to the browser
    academy/actions.ts    server actions the lesson player calls
    auth/                 sessions, permission catalogue, guards
    db/schema.ts          database tables
scripts/                  setup, seed, reset
tests/                    unit tests (engine) and end-to-end browser tests
```

### Updating Titan content

Edit the content where it is maintained (the SOC Academy seed files), copy the updated files into
`content-import\powerapps`, and run `npm run content:import`. Learner progress is kept.

### Adding a new built-in practice module (no new code)

1. Copy `src/content/modules/immix-alert-investigation.ts` and edit the sites, scenarios and steps.
2. Register it in `LESSON_MODULES` in `src/content/curriculum.ts` and set its `MODULE_SEEDS` entry to
   `status: "AVAILABLE"`.
3. Run `npm run setup` (refreshes the curriculum) and `npm run check` (the content-integrity test
   catches broken references).

Every module follows **Introduce → Demonstrate → Guide → Practice → Challenge → Verify**.
Competency moves through **Learning → Assisted → Practicing → Mastery demonstrated**, or to
**Requires remediation** when verification exposes a gap. Supervisor validation (Day 7) is tracked
separately from what the system measures.

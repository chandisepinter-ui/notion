/**
 * Browser test flows. Each `test()` prints PASS/FAIL; the run fails if any fail.
 * Answer keys below mirror src/content/modules/immix-alert-investigation.ts.
 */
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✔ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, err: e });
    console.log(`  ✖ ${name}\n      ${String(e?.message ?? e).split("\n").slice(0, 6).join("\n      ")}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
const shot = (page, name) => page.screenshot({ path: `tests/e2e/screenshots/${name}.png`, fullPage: true });

async function signIn(page, base, name) {
  await page.goto(`${base}/login`);
  await page.getByRole("button", { name: `Sign in as ${name}` }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login") && u.pathname !== "/");
}

/** Reviews the required evidence in the investigation console. */
async function investigate(page) {
  const next = page.getByRole("button", { name: "Next frame" });
  for (let i = 0; i < 8 && (await next.isEnabled()); i++) await next.click();
  await page.getByRole("tab", { name: /Access schedule/ }).click();
  await page.getByRole("tab", { name: /Response plan/ }).click();
  await page.getByText("Evidence reviewed. Make your decision below.").waitFor();
}

async function decide(page, action, rule) {
  await page.getByRole("radio", { name: new RegExp(`^${action}`) }).check({ force: true });
  await page.getByRole("radio", { name: new RegExp(`^${rule} `) }).check({ force: true });
}

const ACTION = { "false-alarm": "Close as false alarm", authorized: "Log as authorized activity", monitor: "Monitor and log", escalate: "Escalate" };

async function axe(page, label) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const serious = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (serious.length) {
    throw new Error(
      `${label}: ${serious.length} serious/critical accessibility issue(s): ` +
        serious.map((v) => `${v.id} (${v.nodes.length}) → ${v.nodes[0]?.target.join(" ")}`).join("; "),
    );
  }
}

export async function run(base) {
  const browser = await chromium.launch();
  // Reduced motion: axe measures contrast mid-animation otherwise.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));

  console.log("\nAuthentication & permissions");
  await test("signed-out visitors are sent to sign-in", async () => {
    await page.goto(`${base}/dashboard`);
    assert(page.url().endsWith("/login"), `expected /login, got ${page.url()}`);
    await page.getByText("Demonstration mode — not secure").waitFor();
  });
  await test("login page is accessible (axe, dark)", async () => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(`${base}/login`);
    await axe(page, "login dark");
  });
  await test("login page is accessible (axe, light)", async () => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(`${base}/login`);
    await axe(page, "login light");
    await shot(page, "01-login-light");
    await page.emulateMedia({ colorScheme: "dark" });
  });
  await test("operator signs in and lands on dashboard with a clear next step", async () => {
    await signIn(page, base, "Jordan Reyes");
    assert(page.url().endsWith("/dashboard"), page.url());
    await page.getByRole("heading", { name: /Start Alert Investigation/ }).waitFor();
    await page.getByRole("link", { name: /Start training/ }).waitFor();
    await shot(page, "02-operator-dashboard");
  });
  await test("operator dashboard is accessible (axe)", async () => axe(page, "dashboard"));
  await test("operator cannot open admin or supervisor pages", async () => {
    await page.goto(`${base}/admin`);
    await page.getByText("You don’t have access to this page").waitFor();
    await page.goto(`${base}/supervisor`);
    await page.getByText("You don’t have access to this page").waitFor();
  });
  await test("operator navigation hides admin/supervision sections", async () => {
    await page.goto(`${base}/dashboard`);
    const nav = page.getByRole("navigation", { name: "Main" }).first();
    assert((await nav.getByRole("link", { name: "Trainees" }).count()) === 0, "Trainees link visible to operator");
    assert((await nav.getByRole("link", { name: "Accounts & Roles" }).count()) === 0, "Admin link visible to operator");
  });
  await test("roadmap shows all 7 days and marks unbuilt modules", async () => {
    await page.goto(`${base}/academy`);
    for (let d = 1; d <= 7; d++) await page.getByText(`Day ${d}`, { exact: true }).first().waitFor();
    const count = await page.getByText("Not yet available").count();
    assert(count >= 7, `expected planned labels, got ${count}`);
    await shot(page, "03-academy-roadmap");
  });

  console.log("\nLesson: INTRODUCE → DEMONSTRATE → GUIDE");
  const lesson = `${base}/academy/immix-alert-investigation`;
  await test("briefing loads and Continue advances to demonstration", async () => {
    await page.goto(lesson);
    await page.getByRole("heading", { name: "Evidence before action", exact: true }).waitFor();
    await shot(page, "04-briefing");
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.getByText("Demonstration · 1 of 7").waitFor();
  });
  await test("demonstration steps through all panels (with Back)", async () => {
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByText("Demonstration · 2 of 7").waitFor();
    await page.getByRole("button", { name: /Back/ }).click();
    await page.getByText("Demonstration · 1 of 7").waitFor();
    for (let i = 1; i < 7; i++) {
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await page.getByText(`Demonstration · ${i + 1} of 7`).waitFor();
    }
    await shot(page, "05-demonstration-final");
    await page.getByRole("button", { name: /Finish demonstration/ }).click();
    await page.getByRole("heading", { name: "Your turn, with help" }).waitFor();
  });
  await test("decision is locked until evidence is reviewed", async () => {
    const radio = page.getByRole("radio", { name: /^Escalate/ });
    assert(await radio.isDisabled(), "decision should be disabled before evidence");
    await page.getByText("Before deciding, review:").waitFor();
  });
  await test("hints reveal one at a time", async () => {
    await page.getByRole("button", { name: "Show a hint" }).click();
    await page.getByText("Hint 1").waitFor();
    assert((await page.getByText("Hint 2").count()) === 0, "hint 2 should be hidden");
  });
  await test("wrong answer gives concept feedback without revealing the answer", async () => {
    await investigate(page);
    await decide(page, ACTION.escalate, "R3");
    await page.getByRole("button", { name: /Submit decision/ }).click();
    await page.getByText("Not correct yet").waitFor();
    await page.getByText(/Concept: Escalating activity/).waitFor();
    assert((await page.getByText("Why this is right").count()) === 0, "explanation leaked before solving");
    await shot(page, "06-guide-wrong-feedback");
  });
  await test("progress survives a page reload (feedback and evidence restored)", async () => {
    await page.reload();
    await page.getByText("Not correct yet").waitFor();
    await page.getByText("Evidence reviewed. Make your decision below.").waitFor();
  });
  await test("repeating the same mistake shows an alternate explanation", async () => {
    await decide(page, ACTION.escalate, "R1");
    await page.getByRole("button", { name: /Submit decision/ }).click();
    await page.getByText(/here is another way to think about it/).waitFor();
  });
  await test("correct answer explains why and allows Continue", async () => {
    await decide(page, ACTION["false-alarm"], "R1");
    await page.getByRole("button", { name: /Submit decision/ }).click();
    await page.getByText("Why this is right").waitFor();
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.getByRole("heading", { name: "Independent practice" }).waitFor();
  });
  await test("lesson console is accessible (axe)", async () => axe(page, "practice console"));

  console.log("\nLesson: PRACTICE → CHALLENGE");
  await test("two first-try correct answers skip remaining practice (mastery shortcut)", async () => {
    await page.getByText("Alert 1 of up to 4").waitFor();
    await investigate(page);
    await decide(page, ACTION.authorized, "R2");
    await page.getByRole("button", { name: /Submit decision/ }).click();
    await page.getByText("Why this is right").waitFor();
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.getByText("Alert 2 of up to 4").waitFor();
    await investigate(page);
    await decide(page, ACTION.escalate, "R3");
    await page.getByRole("button", { name: /Submit decision/ }).click();
    await page.getByText("Why this is right").waitFor();
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.getByRole("heading", { name: "Full scenario" }).waitFor();
  });
  await test("challenge flags critical error for trusting a vest over the schedule", async () => {
    await investigate(page);
    await decide(page, ACTION.authorized, "R2");
    await page.getByRole("button", { name: /Submit decision/ }).click();
    await page.getByText("Not correct — critical error in this exercise").waitFor();
    await page.getByText(/Concept: Trusting appearance/).waitFor();
    await shot(page, "07-challenge-critical");
    await decide(page, ACTION.escalate, "R3");
    await page.getByRole("button", { name: /Submit decision/ }).click();
    await page.getByText("Why this is right").waitFor();
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.getByRole("heading", { name: "Verification", exact: true }).waitFor();
  });

  console.log("\nLesson: VERIFY (fail → remediation → retake → pass)");
  const answerAll = async (answers) => {
    for (let i = 0; i < answers.length; i++) {
      await page.getByRole("navigation", { name: "Verification alerts" }).getByRole("button").nth(i).click();
      await investigate(page);
      await decide(page, ACTION[answers[i][0]], answers[i][1]);
      await page.getByText("Answer saved.").waitFor();
    }
  };
  await test("verification hides answers and requires all alerts before submit", async () => {
    const submit = page.getByRole("button", { name: /Answer all 5 to submit/ });
    assert(await submit.isDisabled(), "submit should be disabled");
    const html = await page.content();
    assert(!html.includes("correctAction") && !html.includes("Why this is right"), "answer key present in page");
  });
  await test("draft answers persist across reload", async () => {
    await investigate(page);
    await decide(page, ACTION.authorized, "R2");
    await page.getByText("Answer saved.").waitFor();
    await page.waitForTimeout(400);
    await page.reload();
    await page.getByRole("heading", { name: "Verification", exact: true }).waitFor();
    assert(await page.getByRole("radio", { name: /^Log as authorized/ }).isChecked(), "draft not restored");
  });
  await test("a critical error fails verification even at 80%", async () => {
    // attempt 1 = variant "a"; alert 2 answered with Monitor (critical miss)
    await answerAll([["authorized", "R2"], ["monitor", "R3"], ["false-alarm", "R1"], ["monitor", "R4"], ["authorized", "R2"]]);
    await page.getByRole("button", { name: /Submit verification/ }).click();
    await page.getByText("Not yet verified — remediation required").waitFor();
    await page.getByText("Score 80%").waitFor();
    await page.getByText("Critical error", { exact: true }).waitFor();
    await shot(page, "08-verify-failed-remediation");
  });
  await test("dashboard routes the learner to remediation", async () => {
    await page.goto(`${base}/dashboard`);
    await page.getByRole("heading", { name: /Review what you missed/ }).waitFor();
    await page.getByRole("link", { name: /Start remediation/ }).click();
  });
  await test("retake requires remediation review, then uses different alerts", async () => {
    await page.getByRole("heading", { name: "Targeted remediation" }).waitFor();
    assert((await page.getByRole("button", { name: /Start retake/ }).count()) === 0, "retake available before review");
    await page.getByRole("button", { name: /I have reviewed these concepts/ }).click();
    await page.getByRole("button", { name: /Start retake \(attempt 2\)/ }).click();
    await page.getByText("Attempt 2.", { exact: false }).waitFor();
    await page.getByText(/SUN 05:48|Sun 05:48/).first().waitFor();
  });
  await test("passing verification records mastery", async () => {
    await answerAll([["escalate", "R3"], ["escalate", "R3"], ["false-alarm", "R1"], ["monitor", "R4"], ["authorized", "R2"]]);
    await page.getByRole("button", { name: /Submit verification/ }).click();
    await page.getByText("Verified — mastery demonstrated").waitFor();
    await shot(page, "09-verify-passed");
  });
  await test("progress page shows mastery and timeline; history shows answers", async () => {
    await page.goto(`${base}/progress`);
    assert((await page.getByText("Mastery demonstrated").count()) >= 3, "mastery not shown");
    await page.getByText(/Passed verification \(attempt 2, 100%\)/).first().waitFor();
    await page.goto(`${base}/history`);
    const rows = await page.locator("tbody tr").count();
    assert(rows >= 15, `expected many attempts, got ${rows}`);
    await page.goto(`${base}/dashboard`);
    await page.getByRole("heading", { name: "You’re caught up" }).waitFor();
  });
  await test("other operator pages render (skills, arcade, reference, refreshers, profile)", async () => {
    for (const p of ["skills", "arcade", "reference", "refreshers", "profile"]) {
      const r = await page.goto(`${base}/${p}`);
      assert(r.status() === 200, `${p} returned ${r.status()}`);
    }
    await page.goto(`${base}/arcade`);
    assert((await page.getByText("This game is not built yet").count()) === 3, "arcade games not labeled");
    await shot(page, "10-arcade");
  });

  console.log("\nTheme & preferences");
  await test("theme toggle switches and persists across reload", async () => {
    await page.goto(`${base}/profile`);
    await page.getByRole("radio", { name: "Light" }).first().click();
    assert((await page.locator("html").getAttribute("data-theme")) === "light", "not light");
    await page.waitForTimeout(500);
    await page.reload();
    assert((await page.locator("html").getAttribute("data-theme")) === "light", "light not persisted");
    await axe(page, "profile light");
    await page.goto(`${base}/academy/immix-alert-investigation`);
    await axe(page, "lesson results light");
    await page.goto(`${base}/dashboard`);
    await axe(page, "dashboard light");
    await shot(page, "11-dashboard-light");
    await page.goto(`${base}/profile`);
    await page.getByRole("radio", { name: "Large" }).click();
    assert((await page.locator("html").getAttribute("data-text")) === "large", "large text not applied");
    await page.getByRole("radio", { name: "Standard" }).click();
    await page.getByRole("radio", { name: "Dark" }).first().click();
    await page.waitForTimeout(500);
  });

  console.log("\nSupervisor");
  await test("supervisor sees only assigned trainee and their answers", async () => {
    await signIn(page, base, "Morgan Ellis");
    assert(page.url().endsWith("/supervisor"), page.url());
    await page.getByText("Jordan Reyes").first().waitFor();
    assert((await page.getByText("Sam Okafor").count()) === 0, "unassigned trainee visible");
    await page.getByRole("link", { name: /Jordan Reyes/ }).click();
    await page.getByRole("heading", { name: "Answer review" }).waitFor();
    await page.getByText(/Trusting appearance/).first().waitFor();
    await shot(page, "12-supervisor-trainee");
  });
  await test("supervisor trainee review is accessible (axe)", async () => axe(page, "supervisor trainee"));
  await test("supervisor can document remediation", async () => {
    await page.getByRole("textbox", { name: "Note" }).fill("Reviewed the Saturday dock alert together. Re-explained that vests do not establish authorization.");
    await page.getByRole("button", { name: "Save note" }).click();
    await page.getByText("Note saved.").waitFor();
    await page.getByText(/Re-explained that vests/).first().waitFor();
  });
  await test("supervisor cannot open an unassigned trainee by URL or admin pages", async () => {
    await page.goto(`${base}/admin`);
    await page.getByText("You don’t have access to this page").waitFor();
  });

  console.log("\nSenior supervisor & administrator");
  let samId = "";
  await test("senior supervisor sees all trainees (permission-based, not assignment)", async () => {
    await signIn(page, base, "Riley Chen");
    await page.getByText("Sam Okafor").first().waitFor();
    await page.getByText("Jordan Reyes").first().waitFor();
    samId = (await page.getByRole("link", { name: /Sam Okafor/ }).getAttribute("href")).split("/").pop();
  });
  await test("assigned-only supervisor gets 404 for an unassigned trainee URL", async () => {
    await signIn(page, base, "Morgan Ellis");
    const r = await page.goto(`${base}/supervisor/trainees/${samId}`);
    assert(r.status() === 404, `expected 404, got ${r.status()}`);
  });
  await test("administrator lands on admin overview with live counts", async () => {
    await signIn(page, base, "Taylor Quinn");
    assert(page.url().endsWith("/admin"), page.url());
    await shot(page, "13-admin");
    await axe(page, "admin");
  });
  await test("administrator cannot remove own Administrator role", async () => {
    await page.goto(`${base}/admin/users`);
    const me = page.locator("li", { has: page.getByText("You", { exact: true }) });
    await me.getByRole("button", { name: /Administrator/ }).click();
    await page.getByText("You cannot remove your own Administrator role.").waitFor();
  });
  await test("granting a role changes the user's navigation and is audited", async () => {
    const sam = page.locator("li", { has: page.getByText("sam.okafor@demo.titan-academy.local") });
    await sam.getByRole("button", { name: /\+ Supervisor/ }).click();
    await sam.getByRole("button", { name: /✓ Supervisor/ }).waitFor();
    await page.goto(`${base}/admin/audit`);
    await page.getByText("role.grant").first().waitFor();
    await page.goto(`${base}/admin/roles`);
    await axe(page, "permission matrix");
    await page.goto(`${base}/admin/curriculum`);
    await page.getByText("Pending SME approval").waitFor();
    await signIn(page, base, "Sam Okafor");
    assert(page.url().endsWith("/supervisor"), `Sam should now land on /supervisor, got ${page.url()}`);
  });

  console.log("\nResponsive layout");
  await test("mobile: menu opens, navigates and closes; no horizontal overflow", async () => {
    const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const mp = await m.newPage();
    await signIn(mp, base, "Jordan Reyes");
    await mp.getByRole("button", { name: "Open menu" }).click();
    await mp.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "Skill Catalog" }).click();
    await mp.waitForURL(/\/skills/);
    assert((await mp.getByRole("dialog", { name: "Menu" }).count()) === 0, "menu did not close");
    for (const p of ["dashboard", "academy", "academy/immix-alert-investigation", "progress", "history"]) {
      await mp.goto(`${base}/${p}`);
      const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert(overflow <= 1, `${p} overflows horizontally by ${overflow}px`);
    }
    await mp.goto(`${base}/dashboard`);
    await mp.screenshot({ path: "tests/e2e/screenshots/14-mobile-dashboard.png", fullPage: true });
    await m.close();
  });
  await test("keyboard: skip link reaches main content", async () => {
    await page.goto(`${base}/dashboard`);
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.textContent);
    assert(focused?.includes("Skip to main content"), `first tab stop was "${focused}"`);
  });

  await test("no uncaught browser errors during the run", async () => {
    const real = consoleErrors.filter((e) => !/favicon|404 \(Not Found\)|Failed to load resource/.test(e));
    assert(real.length === 0, real.slice(0, 5).join(" | "));
  });

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  return failed.length ? 1 : 0;
}

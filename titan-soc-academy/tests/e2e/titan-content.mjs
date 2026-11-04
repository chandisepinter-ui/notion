/**
 * Checks the IMPORTED Titan content on this computer (npm run test:content).
 * Contains no Titan content itself: it walks whatever modules were imported.
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ ok: true }); console.log(`  ✔ ${name}`); }
  catch (e) { results.push({ ok: false }); console.log(`  ✖ ${name}\n      ${String(e?.message ?? e).split("\n").slice(0, 4).join("\n      ")}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };

async function signIn(page, base, name) {
  await page.goto(`${base}/login`);
  await page.getByRole("button", { name: `Sign in as ${name}` }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login") && u.pathname !== "/");
}

/** Answers the question in `scope`; `variant` changes the answer on each retry. */
async function answerVisible(scope, variant = 0) {
  if (await scope.getByText("Select the steps in the correct order.").count()) {
    const reset = scope.getByRole("button", { name: "Start over" });
    if (await reset.count()) await reset.click();
    for (let i = 0; i < 12; i++) {
      const steps = scope.locator("p:has-text('Steps — select the next one') + div > button");
      const n = await steps.count();
      if (n === 0) break;
      await steps.nth(i === 0 ? variant % n : 0).click();
    }
    return;
  }
  const inputs = scope.locator("input[type=radio], input[type=checkbox]");
  const n = await inputs.count();
  const radio = (await scope.locator("input[type=radio]").count()) > 0;
  if (!radio) {
    // multi: clear, then tick a different option each try
    for (let i = 0; i < n; i++) if (await inputs.nth(i).isChecked()) await inputs.nth(i).uncheck({ force: true });
  }
  await inputs.nth(variant % n).check({ force: true });
}

async function walkPractice(page) {
  for (let t = 0; t < 3 && (await page.getByRole("button", { name: "Check answer" }).count()); t++) {
    await answerVisible(page.locator("article"), t);
    await page.getByRole("button", { name: "Check answer" }).click();
    await page.getByRole("status").waitFor();
    await page.waitForTimeout(200);
  }
}

export async function run(base) {
  const catalog = JSON.parse(readFileSync("content-import/generated/titan-catalog.json", "utf8"));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  console.log(`\nImported catalog ${catalog.catalogVersion}: ${catalog.modules.length} modules`);

  await test("operator: modules are locked in order and dashboard points to the first module", async () => {
    await signIn(page, base, "Jordan Reyes");
    const first = catalog.modules[0];
    await page.getByRole("heading", { name: new RegExp(`Start ${first.title}`) }).waitFor();
    await page.goto(`${base}/academy/${catalog.modules[1].key}`);
    await page.getByRole("heading", { name: "This module is locked" }).waitFor();
  });

  await test("operator: completes the first module end to end (practice feedback, mastery, result)", async () => {
    const first = catalog.modules[0];
    await page.goto(`${base}/academy/${first.key}`);
    for (let guard = 0; guard < 60; guard++) {
      if (await page.getByText(/Submit mastery check|Answer all \d+ to submit/).count()) break;
      if (await page.getByRole("button", { name: "Check answer" }).count()) {
        await walkPractice(page);
      }
      const nextBtn = page.getByRole("button", { name: /^(Continue|Next|Acknowledge)/ });
      if (!(await nextBtn.count())) break;
      await nextBtn.first().click();
      await page.waitForTimeout(250);
    }
    const qs = page.locator("ol > li.titan-panel");
    const n = await qs.count();
    assert(n > 0, "no mastery questions");
    await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze().then((r) => {
      const bad = r.violations.filter((v) => ["serious", "critical"].includes(v.impact));
      assert(!bad.length, "axe: " + bad.map((v) => v.id).join(","));
    });
    for (let i = 0; i < n; i++) await answerVisible(qs.nth(i));
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Submit mastery check" }).click();
    await page.getByRole("heading", { name: /Mastered|Not yet — remediation required/ }).waitFor();
    await page.getByRole("heading", { name: "Answer review" }).waitFor();
    await page.screenshot({ path: "tests/e2e/screenshots/titan-mastery-result.png", fullPage: true });
  });

  await test("administrator preview: every imported module opens and every step renders", async () => {
    await signIn(page, base, "Taylor Quinn");
    const failures = [];
    for (const m of catalog.modules) {
      const r = await page.goto(`${base}/academy/${m.key}`);
      if (r.status() !== 200) { failures.push(`${m.key}: HTTP ${r.status()}`); continue; }
      for (let guard = 0; guard < 80; guard++) {
        if (await page.getByText(/Submit mastery check|Answer all \d+ to submit|Your supervisor completes and signs|Completed — pending source/).count()) break;
        if (await page.getByRole("button", { name: "Check answer" }).count()) {
          await walkPractice(page);
        }
        const nextBtn = page.getByRole("button", { name: /^(Continue|Next|Acknowledge)/ });
        if (!(await nextBtn.count())) { failures.push(`${m.key}: stuck at "${await page.locator("h2").first().textContent()}"`); break; }
        await nextBtn.first().click();
        await page.waitForTimeout(150);
      }
    }
    assert(!failures.length, failures.join("; "));
  });

  await test("admin curriculum shows sources and open conflicts", async () => {
    await page.goto(`${base}/admin/curriculum`);
    await page.getByRole("heading", { name: "Source registry" }).waitFor();
    if (catalog.conflicts.some((c) => c.status === "OPEN")) await page.getByRole("heading", { name: "Open source conflicts" }).waitFor();
  });

  await test("supervisor sees the operator's graded answers", async () => {
    await signIn(page, base, "Morgan Ellis");
    await page.getByRole("link", { name: /Jordan Reyes/ }).click();
    await page.getByRole("heading", { name: "Answer review" }).waitFor();
    assert((await page.locator("tbody tr").count()) > 0, "no attempts visible");
  });

  await test("no uncaught browser errors", async () => assert(!errors.length, errors.slice(0, 3).join(" | ")));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  return failed ? 1 : 0;
}

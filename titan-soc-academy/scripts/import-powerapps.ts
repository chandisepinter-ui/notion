/**
 * Imports the Titan Power Apps Academy content.
 *
 *   npm run content:import
 *
 * Reads the SOC Academy seed CSVs from  content-import/powerapps/  (copied from
 * OneDrive: SOC Academy/titan-soc-academy/data/seeds/import/), validates every
 * answer key, converts the lessons into course modules, writes
 *   content-import/generated/titan-catalog.json
 * and loads the curriculum into the local database.
 *
 * content-import/ is git-ignored: real Titan content never goes to GitHub.
 * Nothing here invents content — every word comes from the source files.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import type { CourseCatalog, CourseModule, CourseStep, Question } from "../src/lib/course/types";
import type { Stage } from "../src/lib/academy/types";
import { seedCourseCatalog } from "./lib/seed-course";

if (existsSync(".env")) loadEnvFile(".env");

const IN = "content-import/powerapps";
const OUT = "content-import/generated/titan-catalog.json";
const PASS_PERCENT = 90; // ACADEMY_DIRECTION_2026: mastery is 90% with no safety-critical errors.

/* ---------------- CSV (RFC 4180, BOM + CRLF safe) ---------------- */
function parseCsv(text: string): Record<string, string>[] {
  text = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.length > 1 || r[0] !== "");
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

const read = (f: string) => {
  const p = `${IN}/${f}`;
  if (!existsSync(p)) throw new Error(`Missing ${p}. Copy the SOC Academy seed files into ${IN}/ first (see README).`);
  return parseCsv(readFileSync(p, "utf8"));
};
const bool = (v: string) => /^true$/i.test(v.trim());
const json = <T,>(v: string, fallback: T): T => {
  try { return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
};

const problems: string[] = [];

function main() {
  const modulesCsv = read("SOC_Academy_Curriculum_modules.csv");
  const lessons = read("SOC_Academy_Lessons.csv");
  const itemsCsv = read("SOC_Academy_Assessment_Items.csv");
  const keys = new Map(read("SOC_Academy_Answer_Keys.csv").map((k) => [k.ItemID, k]));
  const conflictsCsv = read("SOC_Academy_Conflicts.csv");
  const sourcesCsv = read("SOC_Academy_Source_Registry.csv");
  const mediaCsv = read("SOC_Academy_Media.csv");
  const scenarios = read("SOC_Academy_Scenario_Catalog.csv");
  const day7 = existsSync(`${IN}/SOC_Academy_Day7_Competencies_catalog.csv`) ? read("SOC_Academy_Day7_Competencies_catalog.csv") : [];

  const openConflicts = new Set(conflictsCsv.filter((c) => (c.ConflictStatus ?? c.Status) === "OPEN").map((c) => c.ConflictID));
  const scenarioInfo = new Map(
    scenarios.map((s) => {
      const m = json<{ title?: string; brief?: string }>(s.ManifestJSON, {});
      return [s.ScenarioID, { title: m.title ?? s.Title, brief: m.brief ?? "" }];
    }),
  );

  /* ---------------- Questions ---------------- */
  const questions = new Map<string, Question>();
  for (const it of itemsCsv) {
    const k = keys.get(it.ItemID);
    const options = json<string[]>(it.OptionsJSON ?? it.Options, []);
    const answer = json<number[]>(k?.AnswerJSON ?? "", []);
    const type = (it.ItemType ?? it.Type) as Question["type"];
    const where = `${it.ItemID}`;
    if (!k) problems.push(`${where}: no answer key`);
    if (!["mcq", "multi", "order"].includes(type)) problems.push(`${where}: unknown type ${type}`);
    if (answer.some((a) => !Number.isInteger(a) || a < 0 || a >= options.length)) problems.push(`${where}: answer index out of range`);
    if (type === "mcq" && answer.length !== 1) problems.push(`${where}: mcq must have exactly one answer`);
    if (type === "order" && (answer.length !== options.length || new Set(answer).size !== answer.length)) problems.push(`${where}: order key is not a full sequence`);
    const conflictId = it.ConflictID || null;
    const sourceGrounded = it.VerificationStatus === "SOURCE_GROUNDED";
    questions.set(it.ItemID, {
      id: it.ItemID,
      type,
      prompt: it.Prompt,
      options,
      answer,
      explanation: k?.Explanation ?? "",
      critical: bool(it.CriticalError),
      // Scored only if marked graded, source-grounded, and not tied to an OPEN conflict.
      graded: bool(it.Graded) && sourceGrounded && !(conflictId && openConflicts.has(conflictId)),
      weight: Number(it.Weight) || 1,
      sourceId: it.SourceID || null,
      conflictId,
      verification: it.VerificationStatus,
    });
  }

  /* ---------------- Modules ---------------- */
  const stageFor: Record<string, Stage> = {
    PRIME: "introduce",
    WATCH: "demonstrate",
    LEARN: "demonstrate",
    WATCH_AGAIN: "demonstrate",
    GUIDED_PRACTICE: "guide",
    SIMULATE: "practice",
    LIVE_PRODUCTION: "introduce",
    MASTERY: "verify",
    SUPERVISOR_OBSERVATION: "verify",
    COMPETENCY_DOCUMENTATION: "verify",
    FINAL_OUTCOME: "verify",
  };
  // Stages handled by the engine itself rather than authored rows.
  const engineStages = new Set(["REMEDIATION", "RETEST", "COMPLETE", "FEEDBACK"]);

  const modules: CourseModule[] = [];
  for (const m of modulesCsv.filter((x) => bool(x.Active))) {
    const rows = lessons.filter((l) => l.ModuleID === m.ModuleID);
    const steps: CourseStep[] = [];
    const last = () => steps[steps.length - 1];
    for (const r of rows) {
      if (engineStages.has(r.Stage)) continue;
      const stage = stageFor[r.Stage];
      if (!stage) { problems.push(`${r.ContentID}: unmapped stage ${r.Stage}`); continue; }
      const id = `${m.ModuleID}-${r.Stage}-${r.Kind}`;
      switch (r.Kind) {
        case "prime":
          steps.push({ id, stage, kind: "prime", title: r.Title || m.Title, body: r.Body });
          break;
        case "learn": {
          const card = { id: r.ContentID, title: r.Title, body: r.Body, sourceId: r.SourceID || null, notVerified: bool(r.NotVerified) };
          const l = last();
          if (l?.kind === "cards" && l.stage === stage) l.cards.push(card);
          else steps.push({ id: `${id}-${r.StepIndex}`, stage, kind: "cards", title: "Learn", cards: [card] });
          break;
        }
        case "media":
          steps.push({ id: r.ContentID, stage, kind: "media", title: r.Title, body: r.Body, files: json<string[]>(r.MediaFiles, []) });
          break;
        case "info": {
          const l = last();
          const card = { title: r.Title, body: r.Body };
          if (l?.kind === "info" && l.stage === stage) l.cards.push(card);
          else steps.push({ id: r.ContentID, stage, kind: "info", title: r.Title, cards: [card] });
          break;
        }
        case "supervisor_gate": {
          const l = last();
          const card = { title: r.Title, body: r.Body };
          if (l?.kind === "supervisor-gate") l.cards.push(card);
          else steps.push({ id: r.ContentID, stage, kind: "supervisor-gate", title: "Supervisor review", cards: [card] });
          break;
        }
        case "pending_source":
          steps.push({ id: r.ContentID, stage, kind: "pending-source", title: r.Title, body: r.Body });
          break;
        case "sim": {
          const info = scenarioInfo.get(r.ScenarioID);
          if (r.Stage === "MASTERY") {
            const l = last();
            const label = `${r.ScenarioID} · ${info?.title ?? "Scenario"}`;
            if (l?.kind === "mastery") l.simulationChecks.push(label);
            else steps.push({ id: `${m.ModuleID}-MASTERY`, stage, kind: "mastery", title: "Mastery check", items: [], passPercent: PASS_PERCENT, simulationChecks: [label] });
          } else {
            steps.push({ id: r.ContentID, stage, kind: "simulation", title: "Simulator practice", scenarioId: r.ScenarioID, scenarioTitle: info?.title ?? r.ScenarioID, brief: info?.brief ?? "" });
          }
          break;
        }
        case "item": {
          const q = questions.get(r.ItemID);
          if (!q) { problems.push(`${r.ContentID}: item ${r.ItemID} not found`); break; }
          const l = last();
          if (r.Stage === "MASTERY") {
            if (l?.kind === "mastery") l.items.push(q);
            else steps.push({ id: `${m.ModuleID}-MASTERY`, stage, kind: "mastery", title: "Mastery check", items: [q], passPercent: PASS_PERCENT, simulationChecks: [] });
          } else {
            // Practice questions never count toward mastery.
            const pq = { ...q, graded: false };
            if (l?.kind === "practice" && l.stage === stage) l.items.push(pq);
            else steps.push({ id: `${id}-${r.StepIndex}`, stage, kind: "practice", title: stage === "guide" ? "Guided practice" : "Practice", items: [pq] });
          }
          break;
        }
        default:
          problems.push(`${r.ContentID}: unknown kind ${r.Kind}`);
      }
    }
    // A mastery step with only simulator checks (no questions) cannot be scored yet.
    for (const st of steps) {
      if (st.kind === "mastery" && st.items.length === 0) problems.push(`${m.ModuleID}: mastery has simulator checks only (no scorable questions)`);
    }
    modules.push({
      format: "course",
      key: m.ModuleID,
      version: m.CatalogVersion || String(m.Version),
      dayNumber: Number(m.DayNumber),
      sortOrder: Number(m.SortOrder),
      dayTitle: m.DayTitle,
      title: m.Title,
      competencyTarget: m.CompetencyTarget,
      domain: m.Domain,
      contentStatus: m.ContentStatus,
      steps,
    });
  }

  const catalog: CourseCatalog = {
    generatedAt: new Date().toISOString(),
    catalogVersion: modulesCsv[0]?.CatalogVersion ?? "",
    modules,
    sources: sourcesCsv.map((s) => ({ id: s.SourceID, title: s.Title, path: s.ArchivePath, date: s.DocumentDate, status: s.SourceStatus ?? s.Status, note: s.ReadNote })),
    conflicts: conflictsCsv.map((c) => ({
      id: c.ConflictID,
      title: c.Title ?? c.ConflictID,
      a: c.AuthorityA,
      b: c.AuthorityB,
      impact: c.Impact,
      handling: c.TemporaryHandling,
      owner: c.Owner,
      status: c.ConflictStatus ?? c.Status,
      decision: c.Decision,
    })),
    day7Skills: day7.map((d) => ({ id: d.SkillID, name: d.SkillName, category: d.Category, critical: bool(d.CriticalSkill), sortOrder: Number(d.SortOrder) })),
    media: mediaCsv.map((x) => ({ id: x.MediaAssetID, filename: x.Filename, moduleId: x.ModuleID, approved: bool(x.Approved), status: x.VerificationStatus })),
  };

  mkdirSync("content-import/generated", { recursive: true });
  writeFileSync(OUT, JSON.stringify(catalog, null, 1));

  const qCount = modules.reduce((n, m) => n + m.steps.reduce((k, s) => k + (s.kind === "mastery" || s.kind === "practice" ? s.items.length : 0), 0), 0);
  const scored = modules.reduce((n, m) => n + m.steps.reduce((k, s) => k + (s.kind === "mastery" ? s.items.filter((i) => i.graded).length : 0), 0), 0);
  console.log(`✔ ${modules.length} modules · ${qCount} questions (${scored} scored in mastery) · ${catalog.sources.length} sources · ${catalog.conflicts.length} conflicts (${openConflicts.size} open) · ${catalog.day7Skills.length} Day 7 skills`);
  console.log(`✔ Wrote ${OUT}`);
  if (problems.length) {
    console.log(`\n⚠ ${problems.length} content issue(s) to review:`);
    problems.forEach((p) => console.log(`  - ${p}`));
  }
  return catalog;
}

const catalog = main();
seedCourseCatalog(catalog)
  .then(() => console.log("✔ Curriculum loaded into the local database."))
  .catch((e) => {
    console.error("✖ Database load failed:", e);
    process.exit(1);
  });

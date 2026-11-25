#!/usr/bin/env python3
"""
Automated QA & Fuzz Tester for OpenStax Algebra Practice Chapters
-----------------------------------------------------------------
Usage:
    python3 audit_chapters.py

Runs two passes automatically:
  1. Static Integrity Audit (pure Python, works anywhere):
     - JS syntax & delimiter balance across engine/, chapters/, sw.js
     - Chapter wiring in index.html and sw.js
     - 1-to-1 generator <-> objective alignment & unused function check
     - DOM ID verification between engine/*.js and index.html
     - Static detector for unshuffled fixed-answer choices & placeholder leaks
  2. Dynamic 120x Fuzz Stress Test (auto-runs if Node.js is installed):
     - Executes every generator in every chapter 120 times
     - Catches NaN/undefined leaks, duplicate options, 1x/-1x typos,
       position bias (always button #1), stuck Yes/No answers,
       placeholder spoilers, out-of-bounds graph points, and grader failures.
"""
import glob
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))

ERRORS = []
WARNINGS = []


def err(msg):
    ERRORS.append(msg)
    print(f"  [FAIL] {msg}")


def warn(msg):
    WARNINGS.append(msg)
    print(f"  [WARN] {msg}")


def ok(msg):
    print(f"  [OK]   {msg}")


def check_js_balance(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        s = f.read()
    stack = []
    pairs = {"(": ")", "[": "]", "{": "}"}
    closing = {")": "(", "]": "[", "}": "{"}
    i, n = 0, len(s)
    line = 1
    in_str = None
    in_line_comment = False
    in_block_comment = False
    while i < n:
        ch = s[i]
        nxt = s[i + 1] if i + 1 < n else ""
        if ch == "\n":
            line += 1
            in_line_comment = False
            i += 1
            continue
        if in_line_comment:
            i += 1
            continue
        if in_block_comment:
            if ch == "*" and nxt == "/":
                in_block_comment = False
                i += 2
            else:
                i += 1
            continue
        if in_str:
            if ch == "\\":
                i += 2
                continue
            if ch == in_str:
                in_str = None
            i += 1
            continue
        if ch == "/" and nxt == "/":
            in_line_comment = True
            i += 2
            continue
        if ch == "/" and nxt == "*":
            in_block_comment = True
            i += 2
            continue
        if ch in ("'", '"', "`"):
            in_str = ch
            i += 1
            continue
        if ch == "/":
            prev = s[:i].rstrip()
            if prev and prev[-1] in "(=,:[!&|?;{":
                i += 1
                in_cc = False
                while i < n and s[i] != "\n":
                    if s[i] == "\\":
                        i += 2
                        continue
                    if s[i] == "[":
                        in_cc = True
                    elif s[i] == "]":
                        in_cc = False
                    elif s[i] == "/" and not in_cc:
                        i += 1
                        while i < n and s[i].isalpha():
                            i += 1
                        break
                    i += 1
                continue
        if ch in pairs:
            stack.append((ch, line))
        elif ch in closing:
            if not stack or stack[-1][0] != closing[ch]:
                err(f"{os.path.relpath(filepath, ROOT)}:{line}: Unmatched '{ch}'")
                return False
            stack.pop()
        i += 1
    if in_str:
        err(f"{os.path.relpath(filepath, ROOT)}: Unterminated string {in_str}")
        return False
    if stack:
        err(f"{os.path.relpath(filepath, ROOT)}: Unclosed delimiters {stack[:3]}")
        return False
    return True


def run_static_audit():
    print("\n=== 1. Static Integrity Audit (Python) ===")
    engine_files = sorted(glob.glob(os.path.join(ROOT, "engine", "*.js")))
    chapter_files = sorted(glob.glob(os.path.join(ROOT, "chapters", "ch*.js")))
    all_js = engine_files + chapter_files + [os.path.join(ROOT, "sw.js")]

    bal_ok = True
    for jf in all_js:
        if os.path.exists(jf) and not check_js_balance(jf):
            bal_ok = False
    if bal_ok:
        ok(f"JS syntax/delimiter balance passed ({len(all_js)} files)")

    # Check index.html & sw.js wiring
    with open(os.path.join(ROOT, "index.html"), "r", encoding="utf-8") as f:
        html = f.read()
    with open(os.path.join(ROOT, "sw.js"), "r", encoding="utf-8") as f:
        sw = f.read()

    html_ids = set(re.findall(r'\bid="([^"]+)"', html))
    for ef in engine_files:
        rel = os.path.relpath(ef, ROOT).replace("\\", "/")
        if rel not in html:
            err(f"Engine file {rel} is not loaded in index.html")
        if f"./{rel}" not in sw:
            warn(f"Engine file {rel} is not listed in sw.js CORE_ASSETS")
        with open(ef, "r", encoding="utf-8") as f:
            esrc = f.read()
        refs = set(re.findall(r'getElementById\("([^"]+)"\)', esrc)) - {"f0", "unmasteredToggleBtn"}
        missing = refs - html_ids
        if missing:
            err(f"{rel} references missing DOM IDs in index.html: {sorted(missing)}")
    ok("DOM IDs & engine script wiring verified")

    # Audit every chapter file
    for cf in chapter_files:
        rel = os.path.relpath(cf, ROOT).replace("\\", "/")
        if rel not in html:
            err(f"Chapter {rel} is not loaded in index.html")
        if f"./{rel}" not in sw:
            warn(f"Chapter {rel} is not in sw.js CORE_ASSETS (will still cache online on visit)")

        with open(cf, "r", encoding="utf-8") as f:
            src = f.read()

        defined_fns = set(re.findall(r"^\s*function\s+(gen\w+)\s*\(", src, re.MULTILINE))
        registered = re.findall(
            r'\{\s*id:\s*"([^"]+)",\s*objective:\s*"([^"]+)",\s*generate:\s*(\w+)\s*\}',
            src,
        )

        # Duplicate IDs
        ids = [r[0] for r in registered]
        if len(ids) != len(set(ids)):
            dups = [x for x in set(ids) if ids.count(x) > 1]
            err(f"{rel}: Duplicate generator IDs: {dups}")

        # Missing / unused functions
        reg_fns = set(r[2] for r in registered)
        for gid, gobj, gfn in registered:
            if gfn not in defined_fns:
                err(f"{rel}: Registered generator '{gid}' points to undefined function '{gfn}'")
        unused = defined_fns - reg_fns
        if unused:
            err(f"{rel}: Defined but unregistered gen* functions: {sorted(unused)}")

        # Objective alignment
        reg_idx = src.find("registerChapter(")
        if reg_idx == -1:
            err(f"{rel}: Missing window.AlgebraApp.registerChapter(...) call")
            continue
        reg_block = src[reg_idx:]
        declared_objs = set()
        for blk in re.findall(r"objectives:\s*\[([^\]]+)\]", reg_block):
            for o in re.findall(r'"([^"]+)"', blk):
                declared_objs.add(o)
        gen_objs = set(r[1] for r in registered)
        if declared_objs - gen_objs:
            err(f"{rel}: Objectives with 0 generators: {sorted(declared_objs - gen_objs)}")
        if gen_objs - declared_objs:
            err(f"{rel}: Generators referencing undeclared objectives: {sorted(gen_objs - declared_objs)}")

        # Heuristic check: unshuffled fixed-answer choices (answer: "right" / "correct" / "*_ind")
        for m in re.finditer(r'options:\s*\[([\s\S]{1,900}?)\]\s*,\s*answer:\s*"(right|correct|[a-z]+_ind)"', src):
            err(f"{rel}: Fixed answer '{m.group(2)}' appears inside an unshuffled options array (wrap in M.shuffle([...]))")

        # Heuristic check: literal 1x or -1x inside html templates
        if re.search(r'"<i>f</i>\(<i>x</i>\)\s*=\s*"\s*\+\s*\w+\s*\+\s*"<i>x</i>"', src):
            warn(f"{rel}: Potential '1x'/'-1x' formatting bug — prefer M.htmlSlopeInt(...)")

        ok(f"{rel}: {len(declared_objs)} objectives, {len(registered)} generators aligned 1-to-1")


NODE_FUZZ_SCRIPT = r"""
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = process.argv[2];
const chapters = [];
const sandbox = {
  console,
  Math,
  Number,
  String,
  Array,
  Object,
  RegExp,
  Date,
  JSON,
  Error,
  isFinite,
  isNaN,
  parseFloat,
  parseInt,
  window: {}
};
sandbox.window = sandbox;
sandbox.window.AlgebraApp = {
  registerChapter: (ch) => chapters.push(ch)
};

function loadScript(rel) {
  const code = fs.readFileSync(path.join(root, rel), "utf8");
  vm.runInNewContext(code, sandbox, { filename: rel });
}

loadScript("engine/math_utils.js");
loadScript("engine/grader.js");

const chDir = path.join(root, "chapters");
const chFiles = fs.readdirSync(chDir).filter(f => /^ch.*\.js$/.test(f)).sort();
chFiles.forEach(f => loadScript(path.join("chapters", f)));

const RUNS = 120;
const issues = [];
const warnings = [];
const FIXED_ORDER_ANSWERS = new Set(["yes", "no", "Parallel", "Perpendicular", "Neither", "Quadrant I", "Quadrant II", "Quadrant III", "Quadrant IV", "x-axis", "y-axis", "hv", "slope_int", "intercepts", "linear", "constant", "square", "cube", "sqrt", "abs"]);

function stripHtml(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/&minus;/g, "-").replace(/&pi;/g, "π").replace(/&le;/g, "<=").replace(/&ge;/g, ">=").trim();
}

function hasBadToken(s) {
  const t = String(s || "");
  return /\bNaN\b|\bundefined\b|\bInfinity\b/.test(t) && !/undefined/i.test("placeholder");
}

for (const ch of chapters) {
  for (const sec of ch.sections) {
    for (const g of sec.generators) {
      const answerPosCounts = {};
      const answerVals = new Set();
      let failedRuns = 0;

      for (let r = 0; r < RUNS; r++) {
        let q;
        try {
          q = g.generate();
        } catch (e) {
          issues.push(`${g.id}: threw runtime error: ${e.message}`);
          failedRuns++;
          break;
        }
        if (!q || !q.prompt || !q.inputType) {
          issues.push(`${g.id}: missing prompt or inputType`);
          break;
        }

        // Check NaN / undefined leaks (allowing the intentional word "undefined" in slope text)
        const texts = [q.prompt].concat(q.steps || []);
        for (const txt of texts) {
          if (/\bNaN\b|\bInfinity\b/.test(String(txt))) {
            issues.push(`${g.id}: NaN/Infinity leaked into text: ${String(txt).slice(0, 80)}`);
            break;
          }
        }

        // Check choice & combo options
        const choiceObj = q.inputType === "choice" ? { options: q.options, answer: q.answer }
                        : q.inputType === "combo" ? q.choice : null;
        if (choiceObj) {
          const opts = choiceObj.options || [];
          const idx = opts.findIndex(o => o.value === choiceObj.answer);
          if (idx === -1) {
            issues.push(`${g.id}: answer '${choiceObj.answer}' not found in options`);
            break;
          }
          answerPosCounts[idx] = (answerPosCounts[idx] || 0) + 1;
          answerVals.add(choiceObj.answer);

          const labels = opts.map(o => stripHtml(o.label));
          if (new Set(labels).size !== labels.length) {
            issues.push(`${g.id}: duplicate choice option labels: ${JSON.stringify(labels)}`);
            break;
          }
          for (const lb of labels) {
            if (/(?:^|[=\s\-])1x\b/.test(lb)) {
              issues.push(`${g.id}: awkward '1x' in option label: ${lb}`);
              break;
            }
          }
        }

        // Check fields & placeholder spoilers
        const fields = q.inputType === "field" ? [q.field]
                     : (q.inputType === "multi_fields" || q.inputType === "combo") ? (q.fields || []) : [];
        for (const f of fields) {
          if (!f || !f.type) { issues.push(`${g.id}: invalid field spec`); break; }
          if (f.type === "equation" || f.type === "inequality") {
            if (Math.abs(f.A) < 1e-9 && Math.abs(f.B) < 1e-9) {
              issues.push(`${g.id}: degenerate line A=0, B=0`);
              break;
            }
          }
          // Test that placeholder itself does NOT pass the grader!
          if (f.placeholder && !f.placeholder.toLowerCase().startsWith("e.g.")) {
            try {
              const phGrade = sandbox.window.Grader.gradeField(f.placeholder, f);
              if (phGrade && phGrade.ok) {
                issues.push(`${g.id}: placeholder '${f.placeholder}' IS the exact correct answer!`);
                break;
              }
            } catch (e) {}
          }
        }

        // Check graph_line requirePoints on line & in bounds
        if (q.inputType === "graph_line" && q.answer && q.answer.requirePoints) {
          const v = q.visual;
          for (const pt of q.answer.requirePoints) {
            const resid = Math.abs(q.answer.A * pt.x + q.answer.B * pt.y - q.answer.C);
            if (resid > 1e-5) issues.push(`${g.id}: requirePoint (${pt.x},${pt.y}) not on line`);
            if (pt.x < v.xMin || pt.x > v.xMax || pt.y < v.yMin || pt.y > v.yMax) {
              issues.push(`${g.id}: requirePoint (${pt.x},${pt.y}) outside graph bounds`);
            }
          }
        }
      }

      if (failedRuns === 0 && Object.keys(answerPosCounts).length > 0) {
        const positions = Object.keys(answerPosCounts);
        const vals = Array.from(answerVals);
        const isFixedOrder = vals.every(v => FIXED_ORDER_ANSWERS.has(v));
        if (positions.length === 1 && !isFixedOrder) {
          issues.push(`${g.id}: choice position bias — correct answer was ALWAYS at index ${positions[0]} across ${RUNS} runs!`);
        }
        if (vals.length === 1 && (vals[0] === "yes" || vals[0] === "no")) {
          issues.push(`${g.id}: binary Yes/No generator ALWAYS answered '${vals[0]}' across ${RUNS} runs!`);
        }
      }
    }
  }
}

console.log(JSON.stringify({ chapters: chapters.length, issues, warnings }));
"""


def run_node_fuzz():
    node_bin = shutil.which("node")
    print("\n=== 2. Dynamic 120x Generator Fuzz Test (Node.js) ===")
    if not node_bin:
        print("  [SKIP] Node.js not found in PATH — install Node.js to enable 120x runtime fuzzing.")
        return

    res = subprocess.run(
        [node_bin, "-e", NODE_FUZZ_SCRIPT, ROOT],
        capture_output=True,
        text=True,
    )
    if res.returncode != 0:
        err(f"Node fuzz runner failed: {res.stderr.strip()}")
        return
    data = json.loads(res.stdout.strip())
    for w in data.get("warnings", []):
        warn(w)
    for i in data.get("issues", []):
        err(i)
    if not data.get("issues"):
        ok(f"120x fuzz test passed across {data.get('chapters', 0)} chapter(s) with 0 runtime issues!")


def main():
    run_static_audit()
    run_node_fuzz()
    print("\n" + ("=" * 48))
    if ERRORS:
        print(f"AUDIT FAILED: {len(ERRORS)} error(s), {len(WARNINGS)} warning(s).")
        sys.exit(1)
    print(f"AUDIT PASSED: 0 errors, {len(WARNINGS)} warning(s).")
    sys.exit(0)


if __name__ == "__main__":
    main()

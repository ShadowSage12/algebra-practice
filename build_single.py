#!/usr/bin/env python3
"""
Compiles the modular algebra-practice folder into a single self-contained
HTML file (`algebra-practice.html`) for Sitecase Free or easy iPad transfer.

Usage:
    python3 build_single.py

Automatically discovers and bundles every `chapters/ch*.js` file in sorted order!
"""
import glob
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_FILE = os.path.join(ROOT, "algebra-practice.html")

ENGINE_FILES = [
    "engine/math_utils.js",
    "engine/grader.js",
    "engine/renderers.js",
    "engine/scratchpad.js",
    "engine/core.js",
]

def read_text(rel_path):
    with open(os.path.join(ROOT, rel_path), "r", encoding="utf-8") as f:
        return f.read()

def build():
    html = read_text("index.html")
    css = read_text("styles.css")

    # Inline stylesheet
    html = re.sub(
        r'<link\s+rel="stylesheet"\s+href="styles\.css"\s*/?>',
        lambda _: f"<style>\n{css}\n</style>",
        html,
        count=1,
    )

    # Auto-discover all chapter plugin scripts (chapters/ch*.js)
    chapter_paths = sorted(glob.glob(os.path.join(ROOT, "chapters", "ch*.js")))
    chapter_rel = [os.path.relpath(p, ROOT) for p in chapter_paths]

    bundled_scripts = []
    for rel in ENGINE_FILES + chapter_rel:
        code = read_text(rel).replace("</script>", r"<\/script>")
        bundled_scripts.append(f"  <!-- Bundled: {rel} -->\n  <script>\n{code}\n  </script>")

    bundle_block = "\n".join(bundled_scripts) + "\n  <script>window.AlgebraApp.init();</script>"

    # Replace external script tags + bootstrap block
    pattern = r"<!-- Core Engine[\s\S]*?</script>\s*(?=</body>)"
    if not re.search(pattern, html):
        raise RuntimeError("Could not locate script section markers in index.html")

    html = re.sub(pattern, lambda _: bundle_block, html, count=1)

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        f.write(html)

    size_kb = os.path.getsize(OUT_FILE) / 1024
    print(f"Built {OUT_FILE} ({size_kb:.1f} KB) with {len(chapter_rel)} chapter(s): {', '.join(chapter_rel)}")

if __name__ == "__main__":
    build()

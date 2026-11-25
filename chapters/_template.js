/*
 * CHAPTER PLUGIN TEMPLATE
 * -----------------------
 * How to add a new OpenStax chapter (e.g., Chapter 4: Systems of Linear Equations):
 *   1. Copy this file to chapters/ch04_systems.js
 *   2. Fill in `id`, `title`, and `sections` with your parametric generators
 *   3. If using Sitecase Pro (Folder Mode): add `<script src="chapters/ch04_systems.js"></script>` to index.html
 *   4. If using Sitecase Free (Single HTML): run `python3 build_single.py` — it auto-discovers every `chapters/ch*.js` file!
 */
(function () {
  "use strict";
  var M = window.MathUtil;

  function genExample() {
    var a = M.randInt(1, 5);
    var b = M.randInt(1, 5);
    return {
      prompt: "Solve for x: " + M.wrapMath("<i>x</i> + " + a + " = " + (a + b)),
      inputType: "field", // "field" | "multi_fields" | "combo" | "choice" | "checklist" | "graph_points" | "graph_line" | "graph_inequality" | "graph_two_lines"
      // Field types: "number" | "point" | "point_list" | "equation" | "expression" | "inequality" | "set" | "interval"
      field: { type: "number", value: b, label: "x =", placeholder: "number" },
      steps: [
        "Subtract " + a + " from both sides.",
        "x = " + (a + b) + " − " + a + " = " + b + "."
      ]
    };
  }

  // Uncomment below to activate this chapter:
  /*
  window.AlgebraApp.registerChapter({
    id: "ch04",
    title: "Chapter 4: Systems of Linear Equations",
    sections: [
      {
        id: "4.1",
        shortTitle: "Systems",
        title: "Solve Systems of Linear Equations with Two Variables",
        objectives: ["Solve a system by graphing or substitution"],
        generators: [
          { id: "4.1_ex", objective: "Solve a system by graphing or substitution", generate: genExample }
        ]
      }
    ]
  });
  */
})();

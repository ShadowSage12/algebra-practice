(function () {
  "use strict";

  var M = window.MathUtil;

  // =========================================================
  // SECTION 3.1: Graph Linear Equations in Two Variables
  // =========================================================

  function gen31Quadrant() {
    var kind = M.pick(["q1", "q2", "q3", "q4", "xaxis", "yaxis"]);
    var useFrac = Math.random() < 0.35;
    function makeCoord(sign) {
      if (!useFrac) return sign * M.randInt(1, 7);
      var d = M.pick([2, 3, 4, 5]);
      var n = M.randInt(1, 2 * d + 1);
      while (n % d === 0) n++;
      return M.simpFrac(sign * n, d);
    }
    var x, y, ans, reason, xSign, ySign;
    if (kind === "q1") {
      x = makeCoord(1); y = makeCoord(1); ans = "Quadrant I"; xSign = "positive"; ySign = "positive";
      reason = "Both x > 0 and y > 0, which places the point in Quadrant I (top-right).";
    } else if (kind === "q2") {
      x = makeCoord(-1); y = makeCoord(1); ans = "Quadrant II"; xSign = "negative"; ySign = "positive";
      reason = "x < 0 (left) and y > 0 (up), which is Quadrant II (top-left).";
    } else if (kind === "q3") {
      x = makeCoord(-1); y = makeCoord(-1); ans = "Quadrant III"; xSign = "negative"; ySign = "negative";
      reason = "Both x < 0 and y < 0, which puts the point in Quadrant III (bottom-left).";
    } else if (kind === "q4") {
      x = makeCoord(1); y = makeCoord(-1); ans = "Quadrant IV"; xSign = "positive"; ySign = "negative";
      reason = "x > 0 (right) and y < 0 (down), which is Quadrant IV (bottom-right).";
    } else if (kind === "xaxis") {
      x = makeCoord(M.pick([-1, 1])); y = 0; ans = "x-axis"; xSign = "non-zero"; ySign = "0";
      reason = "Because y = 0 and x ≠ 0, the point lies directly on the x-axis (not in any quadrant).";
    } else {
      x = 0; y = makeCoord(M.pick([-1, 1])); ans = "y-axis"; xSign = "0"; ySign = "non-zero";
      reason = "Because x = 0 and y ≠ 0, the point lies directly on the y-axis (not in any quadrant).";
    }
    return {
      prompt: "Identify the quadrant or axis where the point " + M.htmlPoint(x, y) + " is located.",
      inputType: "choice",
      options: [
        { value: "Quadrant I", label: "Quadrant I" },
        { value: "Quadrant II", label: "Quadrant II" },
        { value: "Quadrant III", label: "Quadrant III" },
        { value: "Quadrant IV", label: "Quadrant IV" },
        { value: "x-axis", label: "x-axis" },
        { value: "y-axis", label: "y-axis" }
      ],
      answer: ans,
      steps: [
        "Recall quadrant signs: I (+, +), II (−, +), III (−, −), IV (+, −). A 0 coordinate puts the point on an axis.",
        "For " + M.htmlPoint(x, y) + ": x is " + xSign + " and y is " + ySign + ".",
        reason
      ],
      successNote: M.htmlPoint(x, y) + " lies on/in " + ans + "."
    };
  }

  function gen31PlotPoints() {
    var pts = [];
    var used = {};
    while (pts.length < 3) {
      var x = M.randInt(-5, 5);
      var y = M.randInt(-5, 5);
      var k = x + "," + y;
      if (!used[k]) { used[k] = true; pts.push({ x: x, y: y }); }
    }
    var listHtml = pts.map(function (p) { return M.htmlPoint(p.x, p.y); }).join(", ");
    return {
      prompt: "Plot the following three points in the rectangular coordinate system: " + listHtml + ".",
      visual: { type: "coordinate_plane", xMin: -6, xMax: 6, yMin: -6, yMax: 6, labelStepX: 1, labelStepY: 1, interactive: "plot_points" },
      inputType: "graph_points",
      answer: { points: pts },
      graphInstructions: "Touch and drag (or tap) the 3 matching grid intersections, then tap <strong>Check Answer</strong>.",
      steps: pts.map(function (p) {
        var hDir = p.x > 0 ? p.x + " right" : p.x < 0 ? Math.abs(p.x) + " left" : "0 horizontally";
        var vDir = p.y > 0 ? p.y + " up" : p.y < 0 ? Math.abs(p.y) + " down" : "0 vertically";
        return "For " + M.htmlPoint(p.x, p.y) + ": start at (0, 0), move " + hDir + ", then " + vDir + ".";
      })
    };
  }

  function gen31VerifySolutions() {
    var slopes = [{ n: 1, d: 1 }, { n: -1, d: 1 }, { n: 2, d: 1 }, { n: 1, d: 2 }, { n: 1, d: 3 }, { n: -1, d: 2 }];
    var m = M.pick(slopes);
    var b = M.randInt(-3, 3);
    var abc = M.slopeIntToABC(m.n, m.d, b);

    var xs = [];
    for (var x = -6; x <= 6; x++) {
      if ((m.n * x) % m.d === 0) {
        var y = (m.n * x) / m.d + b;
        if (y >= -7 && y <= 7) xs.push({ x: x, y: y });
      }
    }
    xs = M.shuffle(xs);
    var truePts = xs.slice(0, 2);
    var falsePts = [];
    for (var i = 2; i < xs.length && falsePts.length < 2; i++) {
      var dy = M.pick([-2, -1, 1, 2]);
      var fy = xs[i].y + dy;
      if (fy >= -7 && fy <= 7) falsePts.push({ x: xs[i].x, y: fy });
    }
    while (falsePts.length < 2) {
      var rx = M.randInt(-5, 5), ry = M.randInt(-5, 5);
      if (Math.abs(abc.A * rx + abc.B * ry - abc.C) > 0.5) falsePts.push({ x: rx, y: ry });
    }

    var allOpts = M.shuffle([
      { pt: truePts[0], ok: true },
      { pt: truePts[1], ok: true },
      { pt: falsePts[0], ok: false },
      { pt: falsePts[1], ok: false }
    ]);

    return {
      prompt: "Select <strong>all</strong> ordered pairs that are solutions to " + M.htmlSlopeInt(m.n, m.d, b) + " (and therefore lie on the graphed line).",
      visual: {
        type: "coordinate_plane", xMin: -8, xMax: 8, yMin: -8, yMax: 8,
        lines: [{ A: abc.A, B: abc.B, C: abc.C }]
      },
      inputType: "checklist",
      options: allOpts.map(function (o, idx) { return { value: String(idx), label: M.htmlPoint(o.pt.x, o.pt.y) }; }),
      answer: allOpts.map(function (o, idx) { return o.ok ? String(idx) : null; }).filter(Boolean),
      steps: allOpts.map(function (o) {
        var rhs = (m.n * o.pt.x) / m.d + b;
        var rhsStr = Number.isInteger(rhs) ? String(rhs) : rhs.toFixed(2);
        return "Test " + M.htmlPoint(o.pt.x, o.pt.y) + ": substitute x = " + o.pt.x + " ⇒ y = " + rhsStr +
          (o.ok ? " — matches y = " + o.pt.y + " (Solution ✓)." : " ≠ " + o.pt.y + " (Not on line ✗).");
      })
    };
  }

  function gen31GraphLinear() {
    var slopes = [
      { n: 1, d: 1 }, { n: -1, d: 1 }, { n: 2, d: 1 }, { n: -2, d: 1 },
      { n: 1, d: 2 }, { n: -1, d: 2 }, { n: 2, d: 3 }, { n: -3, d: 2 }, { n: 1, d: 3 }
    ];
    var m = M.pick(slopes);
    var b = M.randInt(-3, 3);
    var abc = M.slopeIntToABC(m.n, m.d, b);
    var x1 = m.d, y1 = m.n + b;
    if (y1 > 6 || y1 < -6) { x1 = -m.d; y1 = -m.n + b; }
    return {
      prompt: "Graph the linear equation " + M.htmlSlopeInt(m.n, m.d, b) + " by plotting points.",
      visual: { type: "coordinate_plane", xMin: -6, xMax: 6, yMin: -6, yMax: 6, labelStepX: 1, labelStepY: 1, interactive: "plot_line" },
      inputType: "graph_line",
      answer: abc,
      steps: [
        "Choose x-values that are multiples of the denominator " + m.d + " to keep y an integer.",
        "Let x = 0: y = " + b + " ⇒ " + M.htmlPoint(0, b) + ".",
        "Let x = " + x1 + ": y = " + y1 + " ⇒ " + M.htmlPoint(x1, y1) + ".",
        "Plot both points on the grid to draw the line."
      ]
    };
  }

  function gen31GraphHV() {
    var isVert = Math.random() < 0.5;
    var c = M.randNonZero(-5, 5);
    var abc = isVert ? { A: 1, B: 0, C: c } : { A: 0, B: 1, C: c };
    var eqHtml = isVert ? M.wrapMath("<i>x</i> = " + c) : M.wrapMath("<i>y</i> = " + c);
    return {
      prompt: "Graph the " + (isVert ? "vertical" : "horizontal") + " line " + eqHtml + ".",
      visual: { type: "coordinate_plane", xMin: -6, xMax: 6, yMin: -6, yMax: 6, labelStepX: 1, labelStepY: 1, interactive: "plot_line" },
      inputType: "graph_line",
      answer: abc,
      steps: isVert ? [
        "x = " + c + " is a vertical line where every point has x-coordinate " + c + ".",
        "Plot any two points with x = " + c + ", such as " + M.htmlPoint(c, 0) + " and " + M.htmlPoint(c, 3) + "."
      ] : [
        "y = " + c + " is a horizontal line where every point has y-coordinate " + c + ".",
        "Plot any two points with y = " + c + ", such as " + M.htmlPoint(0, c) + " and " + M.htmlPoint(3, c) + "."
      ]
    };
  }

  function gen31InterceptsFromGraph() {
    var xInt = M.randNonZero(-5, 5);
    var yInt = M.randNonZero(-5, 5);
    var A = yInt, B = xInt, C = xInt * yInt;
    return {
      prompt: "Find the <em>x</em>-intercept and <em>y</em>-intercept of the line shown in the graph. Write each as an ordered pair.",
      visual: {
        type: "coordinate_plane", xMin: -6, xMax: 6, yMin: -6, yMax: 6,
        labelStepX: 1, labelStepY: 1,
        lines: [{ A: A, B: B, C: C }]
      },
      inputType: "multi_fields",
      fields: [
        { type: "point", x: xInt, y: 0, label: "x-intercept", shortLabel: "x-intercept", placeholder: "(a, 0)" },
        { type: "point", x: 0, y: yInt, label: "y-intercept", shortLabel: "y-intercept", placeholder: "(0, b)" }
      ],
      steps: [
        "The x-intercept is where the line crosses the x-axis (y = 0): " + M.htmlPoint(xInt, 0) + ".",
        "The y-intercept is where the line crosses the y-axis (x = 0): " + M.htmlPoint(0, yInt) + "."
      ]
    };
  }

  function gen31InterceptsFromEq() {
    var xInt = M.randNonZero(-6, 6);
    var yInt = M.randNonZero(-6, 6);
    var g = M.gcd(xInt, yInt);
    var A = yInt / g, B = xInt / g, C = (xInt * yInt) / g;
    if (A < 0) { A = -A; B = -B; C = -C; }
    return {
      prompt: "Find the <em>x</em>- and <em>y</em>-intercepts of the equation " + M.htmlStdForm(A, B, C) + ".",
      inputType: "multi_fields",
      fields: [
        { type: "point", x: xInt, y: 0, label: "x-intercept", shortLabel: "x-intercept", placeholder: "(a, 0)" },
        { type: "point", x: 0, y: yInt, label: "y-intercept", shortLabel: "y-intercept", placeholder: "(0, b)" }
      ],
      steps: [
        "Set y = 0: " + M.wrapMath(A + "<i>x</i> = " + C) + " ⇒ " + M.wrapMath("<i>x</i> = " + xInt) + " ⇒ " + M.htmlPoint(xInt, 0) + ".",
        "Set x = 0: " + M.wrapMath(B + "<i>y</i> = " + C) + " ⇒ " + M.wrapMath("<i>y</i> = " + yInt) + " ⇒ " + M.htmlPoint(0, yInt) + "."
      ]
    };
  }

  function gen31GraphIntercepts() {
    var xInt = M.randNonZero(-5, 5);
    var yInt = M.randNonZero(-5, 5);
    var g = M.gcd(xInt, yInt);
    var A = yInt / g, B = xInt / g, C = (xInt * yInt) / g;
    if (A < 0) { A = -A; B = -B; C = -C; }
    return {
      prompt: "Graph " + M.htmlStdForm(A, B, C) + " by plotting its actual <em>x</em>- and <em>y</em>-intercepts on the axes.",
      visual: { type: "coordinate_plane", xMin: -6, xMax: 6, yMin: -6, yMax: 6, labelStepX: 1, labelStepY: 1, interactive: "plot_line" },
      inputType: "graph_line",
      answer: {
        A: A, B: B, C: C,
        requirePoints: [{ x: xInt, y: 0 }, { x: 0, y: yInt }],
        requirePointsFeedback: "Right line! However, this exercise asks you to plot the actual x- and y-intercepts — clear the graph and tap the two points where the line crosses the axes."
      },
      graphInstructions: "Tap the <strong>x-intercept</strong> (on the x-axis) and the <strong>y-intercept</strong> (on the y-axis) to draw the line.",
      steps: [
        "Set y = 0 to find the x-intercept: " + M.htmlPoint(xInt, 0) + ".",
        "Set x = 0 to find the y-intercept: " + M.htmlPoint(0, yInt) + ".",
        "Plot both intercepts on the axes to draw the line."
      ]
    };
  }

  function gen31GraphPairLines() {
    // OpenStax #29-32: Graph y = kx and y = k on the same coordinate system
    var k = M.pick([2, 3, -2, -3, 4, -4]);
    var abcSlanted = M.slopeIntToABC(k, 1, 0);
    var abcHoriz = { A: 0, B: 1, C: k };
    var eq1Html = M.htmlSlopeInt(k, 1, 0);
    var eq2Html = M.wrapMath("<i>y</i> = " + k);
    return {
      prompt: "Graph both equations " + eq1Html + " and " + eq2Html + " on the <strong>same</strong> rectangular coordinate system.",
      visual: {
        type: "coordinate_plane", xMin: -6, xMax: 6, yMin: -6, yMax: 6,
        labelStepX: 1, labelStepY: 1,
        interactive: "plot_two_lines",
        lineLabels: ["Line 1: y = " + k + "x", "Line 2: y = " + k]
      },
      inputType: "graph_two_lines",
      answer: {
        unordered: true,
        lines: [
          { A: abcSlanted.A, B: abcSlanted.B, C: abcSlanted.C, plainLabel: "y = " + k + "x" },
          { A: abcHoriz.A, B: abcHoriz.B, C: abcHoriz.C, plainLabel: "y = " + k }
        ]
      },
      graphInstructions: "Plot 2 points for <strong>Line 1</strong> (blue), then it automatically switches to <strong>Line 2</strong> (purple) for its 2 points.",
      steps: [
        "For " + eq1Html + " (slanted line through the origin): plot (0, 0) and " + M.htmlPoint(1, k) + ".",
        "For " + eq2Html + " (horizontal line): every point has y = " + k + ", such as " + M.htmlPoint(0, k) + " and " + M.htmlPoint(3, k) + ".",
        "Notice how both lines intersect at " + M.htmlPoint(1, k) + "."
      ]
    };
  }

  function gen31OriginIntercepts() {
    var k = M.pick([-3, -2, -1, 1, 2, 3, 4]);
    var abc = M.slopeIntToABC(k, 1, 0);
    return {
      prompt: "Graph " + M.htmlSlopeInt(k, 1, 0) + " using the intercepts (and a second point since both intercepts are the origin).",
      visual: { type: "coordinate_plane", xMin: -6, xMax: 6, yMin: -6, yMax: 6, labelStepX: 1, labelStepY: 1, interactive: "plot_line" },
      inputType: "graph_line",
      answer: abc,
      steps: [
        "Setting x = 0 gives y = 0, and setting y = 0 gives x = 0 — so both the x- and y-intercept are the single point (0, 0).",
        "Because one point isn't enough to draw a line, pick another x-value such as x = 1: y = " + k + "(1) = " + k + ", giving " + M.htmlPoint(1, k) + ".",
        "Plot (0, 0) and " + M.htmlPoint(1, k) + " to graph the line."
      ]
    };
  }

  // =========================================================
  // SECTION 3.2: Slope of a Line
  // =========================================================

  function gen32SlopeFromGraph() {
    var slopes = [
      { n: 1, d: 2 }, { n: 2, d: 3 }, { n: 3, d: 2 }, { n: 3, d: 4 }, { n: 2, d: 5 },
      { n: -1, d: 2 }, { n: -2, d: 3 }, { n: -3, d: 4 }, { n: -5, d: 2 }, { n: 2, d: 1 }, { n: -3, d: 1 }
    ];
    var m = M.pick(slopes);
    var b = M.randInt(-3, 3);
    var abc = M.slopeIntToABC(m.n, m.d, b);
    var p1 = { x: 0, y: b };
    var p2 = { x: m.d, y: b + m.n };
    if (p2.y > 7 || p2.y < -7) { p2 = { x: -m.d, y: b - m.n }; }
    return {
      prompt: "Find the slope " + M.wrapMath("<i>m</i>") + " of the line shown in the graph.",
      visual: {
        type: "coordinate_plane", xMin: -8, xMax: 8, yMin: -8, yMax: 8,
        lines: [{ A: abc.A, B: abc.B, C: abc.C }]
      },
      inputType: "field",
      field: { type: "number", value: m.n / m.d, isSlope: true, label: "Slope (m)", placeholder: "e.g. -2/3 or 2" },
      steps: [
        "Pick two lattice points on the line, such as " + M.htmlPoint(p1.x, p1.y) + " and " + M.htmlPoint(p2.x, p2.y) + ".",
        "Count rise = " + (p2.y - p1.y) + " and run = " + (p2.x - p1.x) + ".",
        "Simplify m = rise / run = " + M.wrapMath(M.htmlFrac(m.n, m.d)) + "."
      ]
    };
  }

  function gen32SlopeHVEquation() {
    var isVert = Math.random() < 0.5;
    var c = M.randNonZero(-8, 8);
    var eqHtml = isVert ? M.wrapMath("<i>x</i> = " + c) : M.wrapMath("<i>y</i> = " + c);
    return {
      prompt: "Find the slope of the line " + eqHtml + ".",
      inputType: "field",
      field: isVert
        ? { type: "number", special: "undefined", isSlope: true, label: "Slope (m)", placeholder: "number or undefined" }
        : { type: "number", value: 0, isSlope: true, label: "Slope (m)", placeholder: "number or undefined" },
      steps: isVert ? [
        eqHtml + " is a vertical line (all points have x = " + c + ").",
        "Because the run (x₂ − x₁) is always 0, dividing by 0 makes the slope undefined."
      ] : [
        eqHtml + " is a horizontal line (y = 0x + " + c + ").",
        "Because the rise (y₂ − y₁) is always 0, the slope is 0."
      ]
    };
  }

  function gen32SlopeTwoPoints() {
    var roll = Math.random();
    var x1, y1, x2, y2, fieldSpec, steps;
    if (roll < 0.15) {
      x1 = M.randInt(-6, 2); x2 = x1 + M.randInt(2, 6);
      y1 = M.randInt(-6, 6); y2 = y1;
      fieldSpec = { type: "number", value: 0, isSlope: true, label: "Slope (m)", placeholder: "number, fraction, or undefined" };
      steps = [
        "Use m = (y₂ − y₁) / (x₂ − x₁).",
        "m = (" + y2 + " − (" + y1 + ")) / (" + x2 + " − (" + x1 + ")) = 0 / " + (x2 - x1) + " = 0."
      ];
    } else if (roll < 0.30) {
      x1 = M.randInt(-6, 6); x2 = x1;
      y1 = M.randInt(-6, 2); y2 = y1 + M.randInt(2, 6);
      fieldSpec = { type: "number", special: "undefined", isSlope: true, label: "Slope (m)", placeholder: "number, fraction, or undefined" };
      steps = [
        "Use m = (y₂ − y₁) / (x₂ − x₁).",
        "m = (" + y2 + " − (" + y1 + ")) / (" + x2 + " − (" + x1 + ")) = " + (y2 - y1) + " / 0.",
        "Division by 0 is undefined, so the slope is undefined."
      ];
    } else {
      x1 = M.randInt(-5, 3);
      x2 = x1 + M.randNonZero(-5, 5);
      while (x2 === x1) x2 = x1 + M.randNonZero(-4, 4);
      y1 = M.randInt(-6, 6);
      y2 = M.randInt(-6, 6);
      while (y2 === y1) y2 = M.randInt(-6, 6);
      var f = M.simpFrac(y2 - y1, x2 - x1);
      fieldSpec = { type: "number", value: f.n / f.d, isSlope: true, label: "Slope (m)", placeholder: "number, fraction, or undefined" };
      steps = [
        "Use m = (y₂ − y₁) / (x₂ − x₁).",
        "m = (" + y2 + " − (" + y1 + ")) / (" + x2 + " − (" + x1 + ")) = " + (y2 - y1) + " / " + (x2 - x1) + ".",
        "Simplify: m = " + M.wrapMath(M.htmlFrac(f.n, f.d)) + "."
      ];
    }
    return {
      prompt: "Use the slope formula to find the slope of the line passing through " + M.htmlPoint(x1, y1) + " and " + M.htmlPoint(x2, y2) + ".",
      inputType: "field",
      field: fieldSpec,
      steps: steps
    };
  }

  function gen32GraphPointSlope() {
    var slopes = [{ n: 1, d: 3 }, { n: -1, d: 2 }, { n: 3, d: 2 }, { n: -2, d: 3 }, { n: 2, d: 1 }, { n: -3, d: 1 }];
    var m = M.pick(slopes);
    var useIntercept = Math.random() < 0.3;
    var x1, y1, givenDesc;
    if (useIntercept) {
      if (Math.random() < 0.5) {
        x1 = 0; y1 = M.randInt(-3, 3);
        givenDesc = "<em>y</em>-intercept " + y1;
      } else {
        x1 = M.randInt(-3, 3); y1 = 0;
        givenDesc = "<em>x</em>-intercept " + x1;
      }
    } else {
      x1 = M.randInt(-3, 2);
      y1 = M.randInt(-3, 3);
      givenDesc = "the point " + M.htmlPoint(x1, y1);
    }
    var x2 = x1 + m.d, y2 = y1 + m.n;
    if (x2 > 6 || y2 > 6 || y2 < -6) { x2 = x1 - m.d; y2 = y1 - m.n; }
    var A = m.n, B = -m.d, C = A * x1 + B * y1;
    return {
      prompt: "Graph the line with " + givenDesc + " and slope " + M.wrapMath("<i>m</i> = " + M.htmlFrac(m.n, m.d)) + ".",
      visual: { type: "coordinate_plane", xMin: -6, xMax: 6, yMin: -6, yMax: 6, labelStepX: 1, labelStepY: 1, interactive: "plot_line" },
      inputType: "graph_line",
      answer: { A: A, B: B, C: C },
      steps: [
        "Start by plotting " + M.htmlPoint(x1, y1) + ".",
        "From " + M.htmlPoint(x1, y1) + ", apply m = " + M.plainFrac(m.n, m.d) + " to reach a second point " + M.htmlPoint(x2, y2) + ".",
        "Plot both points on the grid to draw the line."
      ]
    };
  }

  function gen32SlopeYIntFromEq() {
    var fromStd = Math.random() < 0.65;
    var slopes = [{ n: -3, d: 1 }, { n: 4, d: 1 }, { n: -2, d: 3 }, { n: 5, d: 2 }, { n: -4, d: 3 }, { n: 7, d: 3 }];
    var m = M.pick(slopes);
    var b = M.randNonZero(-6, 6);
    var eqHtml, steps;
    if (fromStd) {
      var abc = M.slopeIntToABC(m.n, m.d, b);
      var k = M.pick([1, 2]);
      var A = -abc.A * k, B = -abc.B * k, C = -abc.C * k;
      if (A < 0) { A = -A; B = -B; C = -C; }
      eqHtml = M.htmlStdForm(A, B, C);
      steps = [
        "Solve " + eqHtml + " for y to get slope-intercept form y = mx + b.",
        "Divide every term by " + B + ": " + M.htmlSlopeInt(m.n, m.d, b) + ".",
        "Read slope m = " + M.wrapMath(M.htmlFrac(m.n, m.d)) + " and y-intercept " + M.htmlPoint(0, b) + "."
      ];
    } else {
      eqHtml = M.htmlSlopeInt(m.n, m.d, b);
      steps = [
        "Compare " + eqHtml + " directly with y = mx + b.",
        "Slope m = " + M.wrapMath(M.htmlFrac(m.n, m.d)) + " and y-intercept " + M.htmlPoint(0, b) + "."
      ];
    }
    return {
      prompt: "Identify the slope and <em>y</em>-intercept of the line " + eqHtml + ".",
      inputType: "multi_fields",
      fields: [
        { type: "number", value: m.n / m.d, isSlope: true, label: "Slope (m)", shortLabel: "Slope", placeholder: "e.g. -2/3" },
        { type: "point", x: 0, y: b, label: "y-intercept", shortLabel: "y-intercept", placeholder: "(0, b)" }
      ],
      steps: steps
    };
  }

  function gen32GraphSlopeIntercept() {
    var fromStd = Math.random() < 0.45;
    var slopes = [{ n: 3, d: 1 }, { n: 2, d: 1 }, { n: -1, d: 1 }, { n: -2, d: 5 }, { n: -3, d: 4 }, { n: 3, d: 2 }, { n: 3, d: 4 }];
    var m = M.pick(slopes);
    var b = M.randInt(-3, 3);
    var abc = M.slopeIntToABC(m.n, m.d, b);
    var eqHtml, step1;
    if (fromStd) {
      var A = -abc.A, B = -abc.B, C = -abc.C;
      if (A < 0) { A = -A; B = -B; C = -C; }
      eqHtml = M.htmlStdForm(A, B, C);
      step1 = "Solve " + eqHtml + " for y: " + M.htmlSlopeInt(m.n, m.d, b) + ".";
    } else {
      eqHtml = M.htmlSlopeInt(m.n, m.d, b);
      step1 = "Read slope m = " + M.plainFrac(m.n, m.d) + " and y-intercept " + M.htmlPoint(0, b) + " directly.";
    }
    var x2 = m.d, y2 = b + m.n;
    if (y2 > 6 || y2 < -6 || x2 > 6) { x2 = -m.d; y2 = b - m.n; }
    return {
      prompt: "Graph the line " + eqHtml + " using its slope and <em>y</em>-intercept.",
      visual: { type: "coordinate_plane", xMin: -6, xMax: 6, yMin: -6, yMax: 6, labelStepX: 1, labelStepY: 1, interactive: "plot_line" },
      inputType: "graph_line",
      answer: abc,
      steps: [
        step1,
        "Plot the y-intercept " + M.htmlPoint(0, b) + ".",
        "Use rise/run = " + M.plainFrac(m.n, m.d) + " to locate a second point " + M.htmlPoint(x2, y2) + " and draw the line."
      ]
    };
  }

  function gen32ChooseMethod() {
    var mode = M.pick(["hv", "slope_int", "intercepts"]);
    var eqHtml, ans, why;
    if (mode === "hv") {
      var isX = Math.random() < 0.5;
      var c = M.randNonZero(-6, 6);
      eqHtml = isX ? M.wrapMath("<i>x</i> = " + c) : M.wrapMath("<i>y</i> = " + c);
      ans = "hv";
      why = "Only one variable appears in " + eqHtml + ", so it is immediately a " + (isX ? "vertical" : "horizontal") + " line.";
    } else if (mode === "slope_int") {
      var m = M.pick([{ n: -3, d: 1 }, { n: 2, d: 3 }, { n: -1, d: 2 }, { n: 4, d: 1 }]);
      var b = M.randNonZero(-5, 5);
      eqHtml = M.htmlSlopeInt(m.n, m.d, b);
      ans = "slope_int";
      why = eqHtml + " is already solved for y (y = mx + b), so plotting the y-intercept and counting the slope is fastest.";
    } else {
      var xInt = M.randNonZero(-5, 5), yInt = M.randNonZero(-5, 5);
      var g = M.gcd(xInt, yInt);
      var A = yInt / g, B = xInt / g, C = (xInt * yInt) / g;
      if (A < 0) { A = -A; B = -B; C = -C; }
      eqHtml = M.htmlStdForm(A, B, C);
      ans = "intercepts";
      why = eqHtml + " is in standard form Ax + By = C where both A and B divide C cleanly (" + M.htmlPoint(xInt, 0) + " and " + M.htmlPoint(0, yInt) + "), making the intercepts method easiest.";
    }
    return {
      prompt: "Determine the <strong>most convenient method</strong> to graph the line " + eqHtml + ".",
      inputType: "choice",
      options: [
        { value: "hv", label: "Vertical or Horizontal Line" },
        { value: "slope_int", label: "Slope and y-Intercept" },
        { value: "intercepts", label: "Finding x- and y-Intercepts" }
      ],
      answer: ans,
      steps: [
        "OpenStax Strategy: 1 variable ⇒ Vertical/Horizontal; solved for y ⇒ Slope-Intercept; standard form Ax + By = C with clean divisors ⇒ Intercepts.",
        why
      ]
    };
  }

  function gen32LinearApp() {
    var scenarios = [
      function () {
        var base = M.pick([28, 31, 35, 40]);
        var rate = M.pick([1.5, 1.75, 2.25, 2.5]);
        var units = M.pick([12, 16, 20]);
        var total = Math.round((base + rate * units) * 100) / 100;
        var yStep = 20;
        var yMax = Math.ceil((base + rate * 25) / yStep) * yStep;
        return {
          prompt: "The equation " + M.wrapMath("<i>P</i> = " + base + " + " + rate + "<i>w</i>") +
            " (graphed in the first quadrant) models a monthly water bill payment <em>P</em> (in dollars) for <em>w</em> units of water used.",
          visual: {
            type: "coordinate_plane", xMin: 0, xMax: 25, yMin: 0, yMax: yMax,
            gridStepX: 5, gridStepY: yStep,
            labelStepX: 5, labelStepY: yStep,
            xAxisLabel: "w", yAxisLabel: "P",
            lines: [{ A: -rate, B: 1, C: base }],
            points: [{ x: 0, y: base }, { x: units, y: total }]
          },
          choice: {
            label: "Which statement correctly interprets the slope and P-intercept?",
            shortLabel: "Interpretation",
            options: M.shuffle([
              { value: "right", label: "Slope $" + rate + ": cost increases by $" + rate + " per unit; P-intercept $" + base + ": fixed charge at 0 units" },
              { value: "swapped", label: "Slope $" + base + ": cost increases by $" + base + " per unit; P-intercept $" + rate + ": fixed charge at 0 units" },
              { value: "inverted", label: "Slope $" + rate + ": units used per dollar; P-intercept $" + base + ": maximum units allowed" }
            ]),
            answer: "right",
            wrongHint: "In P = b + mw, the constant " + base + " is the starting charge when w = 0, and " + rate + " is the rate of change per unit."
          },
          fields: [
            { type: "number", value: base, label: "Payment when 0 units are used ($)", shortLabel: "Payment at 0", placeholder: "dollars" },
            { type: "number", value: total, label: "Payment when " + units + " units are used ($)", shortLabel: "Payment at " + units, placeholder: "dollars" }
          ],
          steps: [
            "At w = 0: P = " + base + " + " + rate + "(0) = $" + base + " (the P-intercept is the fixed base monthly charge).",
            "At w = " + units + ": P = " + base + " + " + rate + "(" + units + ") = $" + total + ".",
            "The slope is " + rate + ", meaning each additional unit of water adds $" + rate + " to the bill."
          ]
        };
      },
      function () {
        var base = M.pick([400, 450, 600, 750]);
        var rate = M.pick([25, 28, 35, 40]);
        var guests = M.pick([40, 50, 60, 80]);
        var total = base + rate * guests;
        var yStep = 1000;
        var yMax = Math.ceil((base + rate * 100) / yStep) * yStep;
        return {
          prompt: "The equation " + M.wrapMath("<i>C</i> = " + base + " + " + rate + "<i>g</i>") +
            " (graphed in the first quadrant) models the cost <em>C</em> (in dollars) of a banquet for <em>g</em> guests.",
          visual: {
            type: "coordinate_plane", xMin: 0, xMax: 100, yMin: 0, yMax: yMax,
            gridStepX: 20, gridStepY: yStep,
            labelStepX: 20, labelStepY: yStep,
            xAxisLabel: "g", yAxisLabel: "C",
            lines: [{ A: -rate, B: 1, C: base }],
            points: [{ x: 0, y: base }, { x: guests, y: total }]
          },
          choice: {
            label: "Which statement correctly interprets the slope and C-intercept?",
            shortLabel: "Interpretation",
            options: M.shuffle([
              { value: "right", label: "Slope $" + rate + ": cost rises by $" + rate + " per guest; C-intercept $" + base + ": fixed venue cost for 0 guests" },
              { value: "swapped", label: "Slope $" + base + ": cost rises by $" + base + " per guest; C-intercept $" + rate + ": fixed venue cost" },
              { value: "inverted", label: "Slope $" + rate + ": total guests per banquet; C-intercept $" + base + ": discount per guest" }
            ]),
            answer: "right",
            wrongHint: "The coefficient of g (" + rate + ") is the cost per guest; the constant (" + base + ") is the fixed setup cost."
          },
          fields: [
            { type: "number", value: base, label: "Fixed cost for 0 guests ($)", shortLabel: "Cost at 0", placeholder: "dollars" },
            { type: "number", value: total, label: "Total cost for " + guests + " guests ($)", shortLabel: "Cost for " + guests, placeholder: "dollars" }
          ],
          steps: [
            "Set g = 0: C = $" + base + " (the C-intercept represents the fixed banquet fee).",
            "Set g = " + guests + ": C = " + base + " + " + rate + "(" + guests + ") = $" + total + ".",
            "The slope is " + rate + ", meaning each additional guest increases the banquet cost by $" + rate + "."
          ]
        };
      },
      function () {
        var base = M.pick([400, 500, 750]);
        var pct = M.pick([0.08, 0.10, 0.15]);
        var sales = M.pick([2000, 3000, 4000]);
        var total = Math.round((base + pct * sales) * 100) / 100;
        var yStep = 250;
        var yMax = Math.ceil((base + pct * 5000) / yStep) * yStep;
        return {
          prompt: "The equation " + M.wrapMath("<i>S</i> = " + base + " + " + pct + "<i>c</i>") +
            " (graphed in the first quadrant) models a retail worker's weekly salary <em>S</em> (in dollars) for weekly sales <em>c</em> (in dollars).",
          visual: {
            type: "coordinate_plane", xMin: 0, xMax: 5000, yMin: 0, yMax: yMax,
            gridStepX: 1000, gridStepY: yStep,
            labelStepX: 1000, labelStepY: yStep * 2,
            xAxisLabel: "c", yAxisLabel: "S",
            lines: [{ A: -pct, B: 1, C: base }],
            points: [{ x: 0, y: base }, { x: sales, y: total }]
          },
          choice: {
            label: "Which statement correctly interprets the slope and S-intercept?",
            shortLabel: "Interpretation",
            options: M.shuffle([
              { value: "right", label: "Slope " + pct + ": salary increases by $" + pct + " per $1 of sales (" + Math.round(pct * 100) + "% commission); S-intercept $" + base + ": weekly base pay" },
              { value: "swapped", label: "Slope $" + base + ": commission per sale; S-intercept $" + pct + ": weekly base pay" },
              { value: "inverted", label: "Slope " + pct + ": sales needed per hour; S-intercept $" + base + ": maximum weekly salary" }
            ]),
            answer: "right",
            wrongHint: "The S-intercept (" + base + ") is the base salary at $0 sales, and the slope (" + pct + ") is the commission earned per $1 of sales."
          },
          fields: [
            { type: "number", value: base, label: "Weekly salary when sales are $0", shortLabel: "Base salary", placeholder: "dollars" },
            { type: "number", value: total, label: "Weekly salary when sales are $" + sales, shortLabel: "Salary at $" + sales, placeholder: "dollars" }
          ],
          steps: [
            "At c = 0: S = $" + base + " (the S-intercept is the guaranteed base weekly salary).",
            "At c = " + sales + ": S = " + base + " + " + pct + "(" + sales + ") = $" + total + ".",
            "Slope = " + pct + " means salary increases by $" + pct + " for every $1 in sales (" + Math.round(pct * 100) + "% commission)."
          ]
        };
      }
    ];
    var sc = M.pick(scenarios)();
    return {
      prompt: sc.prompt,
      visual: sc.visual,
      inputType: "combo",
      choice: sc.choice,
      fields: sc.fields,
      steps: sc.steps
    };
  }

  function gen32ParallelPerp() {
    var kind = M.pick(["par_sloped", "perp_sloped", "neither_sloped", "par_hv", "perp_hv", "same_line"]);
    var eq1, eq2, ans, steps;

    if (kind === "par_hv") {
      var isVert = Math.random() < 0.5;
      var c1 = M.randInt(-6, 0), c2 = M.randInt(1, 6);
      eq1 = isVert ? M.wrapMath("<i>x</i> = " + c1) : M.wrapMath("<i>y</i> = " + c1);
      eq2 = isVert ? M.wrapMath("<i>x</i> = " + c2) : M.wrapMath("<i>y</i> = " + c2);
      ans = "Parallel";
      steps = [
        isVert ? "Both equations are vertical lines (undefined slope) with different x-intercepts." : "Both equations are horizontal lines (slope m = 0) with different y-intercepts.",
        "Therefore, the lines are Parallel."
      ];
    } else if (kind === "perp_hv") {
      var cx = M.randNonZero(-6, 6), cy = M.randNonZero(-6, 6);
      eq1 = M.wrapMath("<i>x</i> = " + cx);
      eq2 = M.wrapMath("<i>y</i> = " + cy);
      ans = "Perpendicular";
      steps = [
        eq1 + " is a vertical line, and " + eq2 + " is a horizontal line.",
        "Vertical and horizontal lines always meet at a 90° angle, so they are Perpendicular."
      ];
    } else if (kind === "same_line") {
      var m0 = M.pick([{ n: 1, d: 2 }, { n: -2, d: 3 }, { n: 3, d: 2 }]);
      var b0 = M.randNonZero(-4, 4);
      var abc0 = M.slopeIntToABC(m0.n, m0.d, b0);
      eq1 = M.htmlStdForm(-abc0.A, -abc0.B, -abc0.C);
      eq2 = M.htmlStdForm(-abc0.A * 2, -abc0.B * 2, -abc0.C * 2);
      ans = "Neither";
      steps = [
        "Solve both equations for y: both simplify to " + M.htmlSlopeInt(m0.n, m0.d, b0) + ".",
        "Because they have the same slope AND the same y-intercept, they are the SAME (coincident) line — not distinct parallel lines — so choose Neither."
      ];
    } else {
      var baseSlopes = [{ n: 3, d: 4 }, { n: 2, d: 3 }, { n: -2, d: 5 }, { n: 4, d: 1 }, { n: -3, d: 2 }];
      var m1 = M.pick(baseSlopes);
      var m2;
      if (kind === "par_sloped") { m2 = { n: m1.n, d: m1.d }; ans = "Parallel"; }
      else if (kind === "perp_sloped") { m2 = M.simpFrac(-m1.d, m1.n); ans = "Perpendicular"; }
      else {
        m2 = Math.random() < 0.5 ? M.simpFrac(m1.d, m1.n) : M.simpFrac(-m1.n, m1.d);
        if (m1.n * m2.n === -m1.d * m2.d) m2 = { n: m1.n + 1, d: m1.d };
        ans = "Neither";
      }
      var b1 = M.randInt(-4, 4);
      var b2 = b1 + M.randNonZero(-3, 3);
      var abc1 = M.slopeIntToABC(m1.n, m1.d, b1);
      var abc2 = M.slopeIntToABC(m2.n, m2.d, b2);
      eq1 = M.htmlStdForm(-abc1.A, -abc1.B, -abc1.C);
      eq2 = M.htmlStdForm(-abc2.A * 2, -abc2.B * 2, -abc2.C * 2);
      steps = [
        "Line 1 in slope-intercept form: " + M.htmlSlopeInt(m1.n, m1.d, b1) + " ⇒ m₁ = " + M.wrapMath(M.htmlFrac(m1.n, m1.d)) + ".",
        "Line 2 in slope-intercept form: " + M.htmlSlopeInt(m2.n, m2.d, b2) + " ⇒ m₂ = " + M.wrapMath(M.htmlFrac(m2.n, m2.d)) + ".",
        ans === "Parallel"
          ? "Same slope and different y-intercepts (" + b1 + " ≠ " + b2 + ") ⇒ Parallel."
          : ans === "Perpendicular"
            ? "Slopes are negative reciprocals (m₁ · m₂ = −1) ⇒ Perpendicular."
            : "Slopes are neither equal nor negative reciprocals ⇒ Neither."
      ];
    }

    return {
      prompt: "Determine whether the lines " + eq1 + " and " + eq2 + " are parallel, perpendicular, or neither.",
      inputType: "choice",
      options: [
        { value: "Parallel", label: "Parallel" },
        { value: "Perpendicular", label: "Perpendicular" },
        { value: "Neither", label: "Neither" }
      ],
      answer: ans,
      steps: steps
    };
  }

  // =========================================================
  // SECTION 3.3: Find the Equation of a Line
  // =========================================================

  function gen33SlopeYInt() {
    var slopes = [{ n: 3, d: 1 }, { n: -4, d: 1 }, { n: 1, d: 5 }, { n: -3, d: 4 }, { n: 0, d: 1 }, { n: -1, d: 1 }];
    var m = M.pick(slopes);
    var b = M.randInt(-6, 6);
    var abc = M.slopeIntToABC(m.n, m.d, b);
    return {
      prompt: "Find the equation of the line with slope " + M.wrapMath("<i>m</i> = " + M.htmlFrac(m.n, m.d)) +
        " and <em>y</em>-intercept " + M.htmlPoint(0, b) + ". Write your answer in slope-intercept form.",
      inputType: "field",
      field: {
        type: "equation", A: abc.A, B: abc.B, C: abc.C, requireSlopeIntercept: true,
        label: "Equation (slope-intercept form)", placeholder: "y = mx + b"
      },
      steps: [
        "Start with y = mx + b.",
        "Substitute m = " + M.plainFrac(m.n, m.d) + " and b = " + b + ": " + M.htmlSlopeInt(m.n, m.d, b) + "."
      ]
    };
  }

  function gen33EqFromGraph() {
    var slopes = [{ n: 1, d: 2 }, { n: 2, d: 1 }, { n: -2, d: 1 }, { n: -3, d: 2 }, { n: 3, d: 4 }, { n: 0, d: 1 }];
    var m = M.pick(slopes);
    var b = M.randInt(-4, 4);
    var abc = M.slopeIntToABC(m.n, m.d, b);
    var hiX = m.d === 1 ? M.pick([1, 2, -2]) : m.d;
    var hiY = (m.n * hiX) / m.d + b;
    if (hiY > 7 || hiY < -7) { hiX = -m.d; hiY = -m.n + b; }
    return {
      prompt: "Find the equation of the line shown in the graph. Write the equation in slope-intercept form.",
      visual: {
        type: "coordinate_plane", xMin: -8, xMax: 8, yMin: -8, yMax: 8,
        lines: [{ A: abc.A, B: abc.B, C: abc.C }],
        points: [{ x: hiX, y: hiY }]
      },
      inputType: "field",
      field: {
        type: "equation", A: abc.A, B: abc.B, C: abc.C, requireSlopeIntercept: true,
        label: "Equation", placeholder: "y = mx + b"
      },
      steps: [
        "Read the y-intercept: " + M.htmlPoint(0, b) + " ⇒ b = " + b + ".",
        "Count rise over run from " + M.htmlPoint(0, b) + " to " + M.htmlPoint(hiX, hiY) + ": m = " + M.wrapMath(M.htmlFrac(m.n, m.d)) + ".",
        "Write y = mx + b: " + M.htmlSlopeInt(m.n, m.d, b) + "."
      ]
    };
  }

  function gen33PointSlope() {
    if (Math.random() < 0.2) {
      var xh = M.randInt(-6, 6), yh = M.randNonZero(-7, 7);
      return {
        prompt: "Find the equation of the <strong>horizontal line</strong> containing the point " + M.htmlPoint(xh, yh) + ".",
        inputType: "field",
        field: { type: "equation", A: 0, B: 1, C: yh, requireSlopeIntercept: true, label: "Equation", placeholder: "y = b" },
        steps: [
          "A horizontal line has slope m = 0 and keeps the same y-coordinate everywhere.",
          "Since it contains " + M.htmlPoint(xh, yh) + ", the equation is y = " + yh + "."
        ]
      };
    }
    var slopes = [
      { n: 5, d: 8 }, { n: 5, d: 6 }, { n: -3, d: 5 }, { n: -3, d: 4 },
      { n: -3, d: 2 }, { n: -5, d: 2 }, { n: -7, d: 1 }, { n: 4, d: 1 }
    ];
    var m = M.pick(slopes);
    var k = m.d >= 6 ? M.pick([-1, 1]) : M.pick([-2, -1, 1, 2]);
    var x1 = m.d * k;
    var b = M.randInt(-5, 5);
    var y1 = m.n * k + b;
    var abc = M.slopeIntToABC(m.n, m.d, b);
    return {
      prompt: "Find the equation of the line with slope " + M.wrapMath("<i>m</i> = " + M.htmlFrac(m.n, m.d)) +
        " containing the point " + M.htmlPoint(x1, y1) + ". Write your answer in slope-intercept form.",
      inputType: "field",
      field: {
        type: "equation", A: abc.A, B: abc.B, C: abc.C, requireSlopeIntercept: true,
        label: "Equation (slope-intercept form)", placeholder: "y = mx + b"
      },
      steps: [
        "Start with point-slope form: y − y₁ = m(x − x₁).",
        "Substitute m = " + M.plainFrac(m.n, m.d) + " and " + M.htmlPoint(x1, y1) + ".",
        "Distribute: y − (" + y1 + ") = " + M.plainFrac(m.n, m.d) + "x + (" + (-m.n * k) + ").",
        "Solve for y: " + M.htmlSlopeInt(m.n, m.d, b) + "."
      ]
    };
  }

  function gen33TwoPoints() {
    if (Math.random() < 0.16) {
      var xv = M.randNonZero(-6, 6);
      var y1v = M.randInt(-5, 0), y2v = M.randInt(1, 6);
      return {
        prompt: "Find the equation of the line containing " + M.htmlPoint(xv, y1v) + " and " + M.htmlPoint(xv, y2v) + ".",
        inputType: "field",
        field: { type: "equation", A: 1, B: 0, C: xv, label: "Equation", placeholder: "e.g. x = 3 or y = mx + b" },
        steps: [
          "Both points share the same x-coordinate (" + xv + "), so the line is vertical.",
          "Equation: x = " + xv + "."
        ]
      };
    }
    var slopes = [{ n: -1, d: 1 }, { n: 2, d: 1 }, { n: -3, d: 1 }, { n: 1, d: 2 }, { n: -1, d: 2 }, { n: -1, d: 3 }, { n: 0, d: 1 }];
    var m = M.pick(slopes);
    var b = M.randInt(-5, 5);
    var k1 = M.randInt(-2, 1);
    var k2 = k1 + M.pick([1, 2]);
    var x1 = m.d * k1, y1 = m.n * k1 + b;
    var x2 = m.d * k2, y2 = m.n * k2 + b;
    var abc = M.slopeIntToABC(m.n, m.d, b);
    return {
      prompt: "Find the equation of the line containing " + M.htmlPoint(x1, y1) + " and " + M.htmlPoint(x2, y2) + ". Write the equation in slope-intercept form.",
      inputType: "field",
      field: {
        type: "equation", A: abc.A, B: abc.B, C: abc.C, requireSlopeIntercept: true,
        label: "Equation (slope-intercept form)", placeholder: "y = mx + b"
      },
      steps: [
        "Find slope: m = (" + y2 + " − (" + y1 + ")) / (" + x2 + " − (" + x1 + ")) = " + M.wrapMath(M.htmlFrac(m.n, m.d)) + ".",
        "Use y − y₁ = m(x − x₁) with " + M.htmlPoint(x1, y1) + ".",
        "Solve for y: " + M.htmlSlopeInt(m.n, m.d, b) + "."
      ]
    };
  }

  function gen33Parallel() {
    var givenSlopes = [{ n: 2, d: 1 }, { n: -3, d: 1 }, { n: 2, d: 3 }, { n: -3, d: 4 }, { n: 1, d: 2 }, { n: 4, d: 1 }];
    var gm = M.pick(givenSlopes);
    var gb = M.randInt(-4, 4);
    var k = M.pick([-2, -1, 1, 2]);
    var x1 = gm.d * k;
    var tb = M.randInt(-5, 5);
    if (tb === gb) tb += 2;
    var y1 = gm.n * k + tb;

    var useStd = Math.random() < 0.5;
    var gAbc = M.slopeIntToABC(gm.n, gm.d, gb);
    var givenEq = useStd ? M.htmlStdForm(-gAbc.A, -gAbc.B, -gAbc.C) : M.htmlSlopeInt(gm.n, gm.d, gb);
    var tAbc = M.slopeIntToABC(gm.n, gm.d, tb);

    return {
      prompt: "Find the equation of the line <strong>parallel</strong> to " + givenEq +
        " containing the point " + M.htmlPoint(x1, y1) + ". Write your answer in slope-intercept form.",
      inputType: "field",
      field: {
        type: "equation", A: tAbc.A, B: tAbc.B, C: tAbc.C, requireSlopeIntercept: true,
        label: "Equation (slope-intercept form)", placeholder: "y = mx + b"
      },
      steps: [
        "Find the slope of the given line: " + M.htmlSlopeInt(gm.n, gm.d, gb) + " ⇒ m₁ = " + M.wrapMath(M.htmlFrac(gm.n, gm.d)) + ".",
        "Parallel lines have the exact same slope: m = " + M.wrapMath(M.htmlFrac(gm.n, gm.d)) + ".",
        "Substitute m and " + M.htmlPoint(x1, y1) + " into y − y₁ = m(x − x₁) and solve for y: " + M.htmlSlopeInt(gm.n, gm.d, tb) + "."
      ]
    };
  }

  function gen33ParallelSpecial() {
    var px = M.randNonZero(-5, 5), py = M.randNonZero(-5, 5);
    var c = M.randNonZero(-6, 6);
    // Guarantee (px, py) is strictly off the given line in all 4 templates
    while (c === px || Math.abs(c) === px || -c === py || c === py) {
      c = M.randNonZero(-6, 6);
    }
    var cases = [
      {
        given: M.wrapMath("<i>x</i> = " + c),
        ans: { A: 1, B: 0, C: px },
        steps: [
          "x = " + c + " is a vertical line, so a parallel line is also vertical (form x = a).",
          "Using the x-coordinate of " + M.htmlPoint(px, py) + " gives x = " + px + "."
        ]
      },
      {
        given: M.wrapMath("<i>x</i> &minus; " + Math.abs(c) + " = 0"),
        ans: { A: 1, B: 0, C: px },
        steps: [
          "Solving for x gives x = " + Math.abs(c) + ", a vertical line.",
          "A parallel vertical line through " + M.htmlPoint(px, py) + " is x = " + px + "."
        ]
      },
      {
        given: M.wrapMath("<i>y</i> " + (c > 0 ? "+ " + c : "&minus; " + Math.abs(c)) + " = 0"),
        ans: { A: 0, B: 1, C: py },
        steps: [
          "Solving for y gives y = " + (-c) + ", a horizontal line.",
          "A parallel horizontal line through " + M.htmlPoint(px, py) + " is y = " + py + "."
        ]
      },
      {
        given: M.wrapMath("<i>y</i> = " + c),
        ans: { A: 0, B: 1, C: py },
        steps: [
          "y = " + c + " is a horizontal line (slope 0), so a parallel line is also horizontal (form y = b).",
          "Passing through " + M.htmlPoint(px, py) + " gives y = " + py + "."
        ]
      }
    ];
    var cs = M.pick(cases);
    return {
      prompt: "Find an equation of the line <strong>parallel</strong> to " + cs.given + " that contains the point " + M.htmlPoint(px, py) + ".",
      inputType: "field",
      field: { type: "equation", A: cs.ans.A, B: cs.ans.B, C: cs.ans.C, label: "Equation", placeholder: "e.g. x = 2 or y = -4" },
      steps: cs.steps
    };
  }

  function gen33Perpendicular() {
    var givenSlopes = [{ n: -2, d: 1 }, { n: -1, d: 1 }, { n: 3, d: 4 }, { n: 2, d: 3 }, { n: -2, d: 5 }, { n: 4, d: 3 }];
    var gm = M.pick(givenSlopes);
    var gb = M.randInt(-4, 4);
    var targetM = M.simpFrac(-gm.d, gm.n);
    var k = M.pick([-2, -1, 1, 2]);
    var x1 = targetM.d * k;
    var tb = M.randInt(-5, 5);
    var y1 = targetM.n * k + tb;

    var useStd = Math.random() < 0.5;
    var gAbc = M.slopeIntToABC(gm.n, gm.d, gb);
    var givenEq = useStd ? M.htmlStdForm(-gAbc.A, -gAbc.B, -gAbc.C) : M.htmlSlopeInt(gm.n, gm.d, gb);
    var tAbc = M.slopeIntToABC(targetM.n, targetM.d, tb);

    return {
      prompt: "Find the equation of the line <strong>perpendicular</strong> to " + givenEq +
        " containing the point " + M.htmlPoint(x1, y1) + ". Write your answer in slope-intercept form.",
      inputType: "field",
      field: {
        type: "equation", A: tAbc.A, B: tAbc.B, C: tAbc.C, requireSlopeIntercept: true,
        label: "Equation (slope-intercept form)", placeholder: "y = mx + b"
      },
      steps: [
        "Find the slope of the given line: " + M.htmlSlopeInt(gm.n, gm.d, gb) + " ⇒ m₁ = " + M.wrapMath(M.htmlFrac(gm.n, gm.d)) + ".",
        "Perpendicular lines have negative reciprocal slopes: m = " + M.wrapMath(M.htmlFrac(targetM.n, targetM.d)) + ".",
        "Substitute m and " + M.htmlPoint(x1, y1) + " into y − y₁ = m(x − x₁) and solve for y: " + M.htmlSlopeInt(targetM.n, targetM.d, tb) + "."
      ]
    };
  }

  function gen33PerpendicularSpecial() {
    var px = M.randNonZero(-5, 5), py = M.randNonZero(-5, 5);
    var c = M.randNonZero(-6, 6);
    var cases = [
      {
        given: M.wrapMath("<i>x</i> = " + c),
        ans: { A: 0, B: 1, C: py },
        steps: [
          "x = " + c + " is vertical, so a perpendicular line must be horizontal (form y = b).",
          "Passing through " + M.htmlPoint(px, py) + " gives y = " + py + "."
        ]
      },
      {
        given: M.wrapMath("<i>y</i> &minus; " + Math.abs(c) + " = 0"),
        ans: { A: 1, B: 0, C: px },
        steps: [
          "y = " + Math.abs(c) + " is horizontal, so a perpendicular line must be vertical (form x = a).",
          "Passing through " + M.htmlPoint(px, py) + " gives x = " + px + "."
        ]
      },
      {
        given: "the <em>y</em>-axis",
        ans: { A: 0, B: 1, C: py },
        steps: [
          "The y-axis is the vertical line x = 0.",
          "A line perpendicular to a vertical line is horizontal, so through " + M.htmlPoint(px, py) + " it is y = " + py + "."
        ]
      },
      {
        given: "the <em>x</em>-axis",
        ans: { A: 1, B: 0, C: px },
        steps: [
          "The x-axis is the horizontal line y = 0.",
          "A line perpendicular to a horizontal line is vertical, so through " + M.htmlPoint(px, py) + " it is x = " + px + "."
        ]
      }
    ];
    var cs = M.pick(cases);
    return {
      prompt: "Find an equation of the line <strong>perpendicular</strong> to " + cs.given + " that contains the point " + M.htmlPoint(px, py) + ".",
      inputType: "field",
      field: { type: "equation", A: cs.ans.A, B: cs.ans.B, C: cs.ans.C, label: "Equation", placeholder: "e.g. x = 2 or y = -4" },
      steps: cs.steps
    };
  }

  // =========================================================
  // SECTION 3.4: Graph Linear Inequalities in Two Variables
  // =========================================================

  function gen34VerifyIneq() {
    var useStd = Math.random() < 0.5;
    var op = M.pick([">", "<", ">=", "<="]);
    var A, B, C, eqHtml;
    if (useStd) {
      A = M.pick([2, 3, 4]);
      B = M.pick([-4, -3, -2, 2, 3]);
      C = M.randNonZero(-4, 6);
      eqHtml = M.htmlStdForm(A, B, C, op);
    } else {
      var m = M.pick([1, -2, 3, -1]);
      var b = M.randInt(-3, 4);
      A = -m; B = 1; C = b;
      eqHtml = M.htmlSlopeInt(m, 1, b, op);
    }
    var candidates = [];
    var used = {};
    while (candidates.length < 4) {
      var x = M.randInt(-5, 5), y = M.randInt(-5, 5);
      var key = x + "," + y;
      if (used[key]) continue;
      used[key] = true;
      var lhs = A * x + B * y;
      var ok = op === ">" ? lhs > C : op === "<" ? lhs < C : op === ">=" ? lhs >= C : lhs <= C;
      candidates.push({ x: x, y: y, lhs: lhs, ok: ok });
    }
    if (candidates.every(function (c) { return c.ok; }) || candidates.every(function (c) { return !c.ok; })) {
      return gen34VerifyIneq();
    }
    return {
      prompt: "Select <strong>all</strong> ordered pairs that are solutions to the inequality " + eqHtml + ".",
      inputType: "checklist",
      options: candidates.map(function (c, idx) { return { value: String(idx), label: M.htmlPoint(c.x, c.y) }; }),
      answer: candidates.map(function (c, idx) { return c.ok ? String(idx) : null; }).filter(Boolean),
      steps: candidates.map(function (c) {
        return "Test " + M.htmlPoint(c.x, c.y) + ": substitute into the inequality ⇒ " +
          (useStd ? (c.lhs + " " + op + " " + C) : (c.y + " " + op + " " + (-A * c.x + C))) + " is " + (c.ok ? "True ✓" : "False ✗") + ".";
      })
    };
  }

  function gen34ReadIneqGraph() {
    var useStd = Math.random() < 0.45;
    var op = M.pick([">", "<", ">=", "<="]);
    var A, B, C, boundaryHtml, ansHtml;
    if (useStd) {
      var combos = [
        { A: 1, B: 1, C: 5 }, { A: 1, B: 1, C: 3 }, { A: 3, B: -1, C: 6 },
        { A: 2, B: -1, C: 4 }, { A: 2, B: 1, C: 4 }, { A: 1, B: -1, C: 3 }
      ];
      var cb = M.pick(combos);
      A = cb.A; B = cb.B; C = cb.C;
      boundaryHtml = M.htmlStdForm(A, B, C);
      ansHtml = M.htmlStdForm(A, B, C, op);
    } else {
      var m = M.pick([{ n: 3, d: 1 }, { n: 2, d: 1 }, { n: 1, d: 2 }, { n: -1, d: 3 }, { n: -1, d: 1 }]);
      var b = M.randInt(-4, 4);
      var abc = M.slopeIntToABC(m.n, m.d, b);
      A = abc.A; B = abc.B; C = abc.C;
      boundaryHtml = M.htmlSlopeInt(m.n, m.d, b);
      ansHtml = M.htmlSlopeInt(m.n, m.d, b, op);
    }
    var isStrict = op === "<" || op === ">";
    // Pick a clean test point strictly off the boundary line
    var tx = 0, ty = 0;
    if (Math.abs(A * tx + B * ty - C) < 1e-5) { tx = 0; ty = 4; }
    var tv = A * tx + B * ty;
    var testIn = op === ">" ? tv > C : op === ">=" ? tv >= C : op === "<" ? tv < C : tv <= C;

    return {
      prompt: "Write the inequality shown by the shaded region in the graph with boundary line " + boundaryHtml + ".",
      visual: {
        type: "coordinate_plane", xMin: -10, xMax: 10, yMin: -10, yMax: 10,
        gridStepX: 2, gridStepY: 2, labelStepX: 5, labelStepY: 5,
        inequalities: [{ A: A, B: B, C: C, op: op }]
      },
      inputType: "field",
      field: {
        type: "inequality", A: A, B: B, C: C, op: op,
        label: "Inequality", placeholder: "e.g. y <= 2x - 4 or x + y >= 5"
      },
      steps: [
        "Boundary line style is " + (isStrict ? "dashed ⇒ use < or >." : "solid ⇒ use ≤ or ≥."),
        "Test point " + M.htmlPoint(tx, ty) + " lies " + (testIn ? "INSIDE" : "OUTSIDE") + " the shaded region.",
        "Therefore " + M.htmlPoint(tx, ty) + " must make the inequality " + (testIn ? "TRUE" : "FALSE") + ", giving " + ansHtml + "."
      ]
    };
  }

  function gen34GraphIneqSlopeInt() {
    var slopes = [{ n: 2, d: 3 }, { n: -1, d: 2 }, { n: 2, d: 1 }, { n: -2, d: 1 }, { n: 1, d: 1 }, { n: -1, d: 1 }];
    var m = M.pick(slopes);
    var b = M.randInt(-3, 3);
    var op = M.pick([">", "<", ">=", "<="]);
    var abc = M.slopeIntToABC(m.n, m.d, b);
    var isStrict = op === "<" || op === ">";
    var x2 = m.d, y2 = m.n + b;
    if (y2 > 6 || y2 < -6) { x2 = -m.d; y2 = -m.n + b; }
    var tx = 0, ty = b !== 0 ? 0 : 3;
    var rhs = (m.n * tx) / m.d + b;
    var holds = op === ">" ? ty > rhs : op === ">=" ? ty >= rhs : op === "<" ? ty < rhs : ty <= rhs;
    return {
      prompt: "Graph the linear inequality " + M.htmlSlopeInt(m.n, m.d, b, op) + ".",
      visual: { type: "coordinate_plane", xMin: -6, xMax: 6, yMin: -6, yMax: 6, labelStepX: 1, labelStepY: 1, interactive: "plot_inequality" },
      inputType: "graph_inequality",
      answer: { A: abc.A, B: abc.B, C: abc.C, op: op },
      graphInstructions: "1) Place 2 points for the boundary line. 2) Select <strong>Solid</strong> or <strong>Dashed</strong>. 3) Tap the side to shade.",
      steps: [
        "Boundary line " + M.htmlSlopeInt(m.n, m.d, b) + " passes through " + M.htmlPoint(0, b) + " and " + M.htmlPoint(x2, y2) + ".",
        "Because the sign is " + op + ", draw a " + (isStrict ? "dashed" : "solid") + " boundary line.",
        "Test " + M.htmlPoint(tx, ty) + ": " + ty + " " + op + " " + rhs + " is " + (holds ? "TRUE — shade the side WITH " : "FALSE — shade the side OPPOSITE ") + M.htmlPoint(tx, ty) + "."
      ]
    };
  }

  function gen34GraphIneqStdAndHV() {
    var op = M.pick([">", "<", ">=", "<="]);
    var isStrict = op === "<" || op === ">";
    var flipOp = { ">": "<", "<": ">", ">=": "<=", "<=": ">=" };

    if (Math.random() < 0.3) {
      // Vertical or horizontal inequality like x <= 4 or y > -2
      var isVert = Math.random() < 0.5;
      var c = M.randInt(-4, 4);
      var A = isVert ? 1 : 0, B = isVert ? 0 : 1, C = c;
      var eqHtml = M.wrapMath((isVert ? "<i>x</i>" : "<i>y</i>") + " " + (op === "<=" ? "&le;" : op === ">=" ? "&ge;" : op === "<" ? "&lt;" : "&gt;") + " " + c);
      var dirWord = isVert
        ? ((op === ">" || op === ">=") ? "right of" : "left of")
        : ((op === ">" || op === ">=") ? "above" : "below");
      return {
        prompt: "Graph the linear inequality " + eqHtml + ".",
        visual: { type: "coordinate_plane", xMin: -6, xMax: 6, yMin: -6, yMax: 6, labelStepX: 1, labelStepY: 1, interactive: "plot_inequality" },
        inputType: "graph_inequality",
        answer: { A: A, B: B, C: C, op: op },
        steps: [
          "Boundary line is the " + (isVert ? "vertical line x = " : "horizontal line y = ") + c + ".",
          "Make the line " + (isStrict ? "dashed (< or >)." : "solid (≤ or ≥)."),
          "Shade the region " + dirWord + " the line."
        ]
      };
    }

    // Standard form with negative y-coefficient ~65% of the time (the key sign-flip skill!)
    var templates = [
      { A: 1, B: -1, C: 3, xI: 3, yI: -3 },
      { A: 1, B: -1, C: -2, xI: -2, yI: 2 },
      { A: 2, B: -5, C: 10, xI: 5, yI: -2 },
      { A: 3, B: -2, C: 6, xI: 2, yI: -3 },
      { A: 4, B: -3, C: 12, xI: 3, yI: -4 },
      { A: 2, B: -1, C: 4, xI: 2, yI: -4 },
      { A: 3, B: 2, C: -6, xI: -2, yI: -3 },
      { A: 2, B: 3, C: 6, xI: 3, yI: 2 }
    ];
    var t = M.pick(templates);
    var tx = 0, ty = 0;
    var tv = 0;
    var holds = op === ">" ? tv > t.C : op === ">=" ? tv >= t.C : op === "<" ? tv < t.C : tv <= t.C;
    var flippedMsg = t.B < 0
      ? "Watch out: B = " + t.B + " is negative! Solving for y flips " + op + " to " + flipOp[op] + " (or verify directly with test point (0, 0))."
      : "Solve for y or plug in (0, 0) to pick the shaded half-plane.";

    return {
      prompt: "Graph the linear inequality " + M.htmlStdForm(t.A, t.B, t.C, op) + ".",
      visual: { type: "coordinate_plane", xMin: -6, xMax: 6, yMin: -6, yMax: 6, labelStepX: 1, labelStepY: 1, interactive: "plot_inequality" },
      inputType: "graph_inequality",
      answer: { A: t.A, B: t.B, C: t.C, op: op },
      steps: [
        "Find the boundary intercepts of " + M.htmlStdForm(t.A, t.B, t.C) + ": " + M.htmlPoint(t.xI, 0) + " and " + M.htmlPoint(0, t.yI) + ".",
        "Use a " + (isStrict ? "dashed" : "solid") + " boundary line.",
        flippedMsg,
        "Test (0, 0): 0 " + op + " " + t.C + " is " + (holds ? "TRUE — shade the side containing (0, 0)." : "FALSE — shade the side NOT containing (0, 0).")
      ]
    };
  }

  function gen34IneqApp() {
    var kind = M.pick(["jobs", "calories"]);
    var wantMeet = Math.random() < 0.5;
    if (kind === "jobs") {
      var w1 = M.pick([10, 11, 12, 14]);
      var w2 = M.pick([15, 16.5, 18, 20]);
      var target = M.pick([300, 330, 360, 420]);
      var testX, testY;
      if (wantMeet) {
        testX = Math.ceil(target / (2 * w1)) + M.randInt(1, 3);
        testY = Math.ceil(target / (2 * w2)) + M.randInt(1, 3);
      } else {
        testX = Math.max(2, Math.floor(target / (3 * w1)));
        testY = Math.max(2, Math.floor(target / (3 * w2)));
      }
      var earned = Math.round((w1 * testX + w2 * testY) * 100) / 100;
      var meets = earned >= target;
      return {
        prompt: "A student works two part-time jobs: tutoring pays $" + w1 + "/hr (<em>x</em> hours) and lab work pays $" + w2 + "/hr (<em>y</em> hours). They want to earn <strong>at least $" + target + "</strong> this week. Write an inequality modeling this situation, then check whether working " + testX + " hours tutoring and " + testY + " hours in the lab meets the goal.",
        inputType: "combo",
        choice: {
          label: "Does working (" + testX + ", " + testY + ") meet the weekly earnings goal?",
          shortLabel: "Check (" + testX + ", " + testY + ")",
          options: [
            { value: "yes", label: "Yes — meets or exceeds $" + target },
            { value: "no", label: "No — falls short of $" + target }
          ],
          answer: meets ? "yes" : "no"
        },
        fields: [
          { type: "inequality", A: w1, B: w2, C: target, op: ">=", label: "Modeling inequality (in x and y)", shortLabel: "Inequality", placeholder: "e.g. 12x + 15y >= 300" }
        ],
        steps: [
          "Total weekly earnings = " + w1 + "x + " + w2 + "y.",
          "'At least $" + target + "' means greater than or equal to (≥): " + w1 + "x + " + w2 + "y ≥ " + target + ".",
          "Substitute (" + testX + ", " + testY + "): " + w1 + "(" + testX + ") + " + w2 + "(" + testY + ") = $" + earned + ", which is " + (meets ? "≥ $" + target + " (Yes)." : "< $" + target + " (No).")
        ]
      };
    } else {
      var r1 = M.pick([12, 15]), r2 = M.pick([8, 10]);
      var goal = M.pick([400, 500, 600]);
      var tx, ty;
      if (wantMeet) {
        tx = Math.ceil(goal / (2 * r1)) + M.randInt(2, 6);
        ty = Math.ceil(goal / (2 * r2)) + M.randInt(2, 6);
      } else {
        tx = Math.max(5, Math.floor(goal / (3 * r1)));
        ty = Math.max(5, Math.floor(goal / (3 * r2)));
      }
      var burned = r1 * tx + r2 * ty;
      var meetsGoal = burned >= goal;
      return {
        prompt: "An athlete burns " + r1 + " calories/min running (<em>x</em> minutes) and " + r2 + " calories/min biking (<em>y</em> minutes), and wants to burn <strong>at least " + goal + " calories</strong> today.",
        inputType: "combo",
        choice: {
          label: "Does running " + tx + " min and biking " + ty + " min reach the goal?",
          shortLabel: "Workout check",
          options: [
            { value: "yes", label: "Yes — meets or exceeds " + goal + " cal" },
            { value: "no", label: "No — burns fewer than " + goal + " cal" }
          ],
          answer: meetsGoal ? "yes" : "no"
        },
        fields: [
          { type: "inequality", A: r1, B: r2, C: goal, op: ">=", label: "Modeling inequality (in x and y)", shortLabel: "Inequality", placeholder: "e.g. 12x + 8y >= 400" }
        ],
        steps: [
          "Total calories burned = " + r1 + "x + " + r2 + "y.",
          "'At least " + goal + "' gives " + r1 + "x + " + r2 + "y ≥ " + goal + ".",
          "At (" + tx + ", " + ty + "): " + r1 + "(" + tx + ") + " + r2 + "(" + ty + ") = " + burned + " calories, which is " + (meetsGoal ? "≥ " + goal + " (Yes)." : "< " + goal + " (No).")
        ]
      };
    }
  }

  // =========================================================
  // SECTION 3.5: Relations and Functions
  // =========================================================

  function gen35DomainRangePairs() {
    var xs = M.shuffle([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]).slice(0, 4);
    var pairs = [];
    if (Math.random() < 0.5) {
      xs.forEach(function (x) { pairs.push([x, M.randInt(-6, 9)]); });
    } else {
      var yA = M.randInt(-5, 3), yB = yA + M.randInt(2, 5);
      pairs.push([xs[0], yA], [xs[0], yB], [xs[1], M.randInt(-5, 6)], [xs[2], M.randInt(-5, 6)]);
      pairs = M.shuffle(pairs);
    }
    var dom = [], rng = [];
    pairs.forEach(function (p) {
      if (dom.indexOf(p[0]) === -1) dom.push(p[0]);
      if (rng.indexOf(p[1]) === -1) rng.push(p[1]);
    });
    dom.sort(function (a, b) { return a - b; });
    rng.sort(function (a, b) { return a - b; });
    var relHtml = M.wrapMath("{" + pairs.map(function (p) { return "(" + p[0] + ", " + p[1] + ")"; }).join(", ") + "}");
    return {
      prompt: "For the relation " + relHtml + ", find the domain and range (list unique elements in braces like {-2, 0, 3}).",
      inputType: "multi_fields",
      fields: [
        { type: "set", isNumeric: true, values: dom, label: "Domain", shortLabel: "Domain", placeholder: "{...}" },
        { type: "set", isNumeric: true, values: rng, label: "Range", shortLabel: "Range", placeholder: "{...}" }
      ],
      steps: [
        "Domain = unique x-values: {" + dom.join(", ") + "}.",
        "Range = unique y-values: {" + rng.join(", ") + "}."
      ]
    };
  }

  function gen35MappingDomainRange() {
    var xs = M.shuffle([-4, -2, -1, 0, 1, 2, 3, 5]).slice(0, 4).sort(function (a, b) { return a - b; });
    var ys = M.shuffle([-6, -3, 0, 2, 4, 7, 9]).slice(0, 4).sort(function (a, b) { return a - b; });
    var arrows = [];
    var usedRight = {};
    xs.forEach(function (_, i) {
      var target = Math.random() < 0.75 ? i : M.randInt(0, ys.length - 1);
      arrows.push({ from: i, to: target });
      usedRight[target] = true;
    });
    // Ensure every right item shown is in range (or list only mapped ones)
    var rangeVals = ys.filter(function (_, idx) { return !!usedRight[idx]; });
    return {
      prompt: "Use the mapping diagram to find the <strong>domain</strong> and <strong>range</strong> of the relation.",
      visual: {
        type: "mapping",
        leftTitle: "Input (x)",
        rightTitle: "Output (y)",
        left: xs,
        right: ys,
        arrows: arrows
      },
      inputType: "multi_fields",
      fields: [
        { type: "set", isNumeric: true, values: xs, label: "Domain", shortLabel: "Domain", placeholder: "{...}" },
        { type: "set", isNumeric: true, values: rangeVals, label: "Range (outputs with incoming arrows)", shortLabel: "Range", placeholder: "{...}" }
      ],
      steps: [
        "Domain = all inputs on the left with outgoing arrows: {" + xs.join(", ") + "}.",
        "Range = all outputs on the right that receive at least one arrow: {" + rangeVals.join(", ") + "}."
      ]
    };
  }

  function gen35GraphPointsDomainRange() {
    var pts = [];
    var used = {};
    while (pts.length < 5) {
      var x = M.randInt(-4, 4), y = M.randInt(-4, 4);
      var k = x + "," + y;
      if (!used[k]) { used[k] = true; pts.push({ x: x, y: y }); }
    }
    var dom = [], rng = [];
    pts.forEach(function (p) {
      if (dom.indexOf(p.x) === -1) dom.push(p.x);
      if (rng.indexOf(p.y) === -1) rng.push(p.y);
    });
    dom.sort(function (a, b) { return a - b; });
    rng.sort(function (a, b) { return a - b; });
    return {
      prompt: "Use the graph of the discrete relation to find its <strong>domain</strong> and <strong>range</strong>.",
      visual: {
        type: "coordinate_plane", xMin: -5, xMax: 5, yMin: -5, yMax: 5,
        labelStepX: 1, labelStepY: 1,
        points: pts
      },
      inputType: "multi_fields",
      fields: [
        { type: "set", isNumeric: true, values: dom, label: "Domain", shortLabel: "Domain", placeholder: "{...}" },
        { type: "set", isNumeric: true, values: rng, label: "Range", shortLabel: "Range", placeholder: "{...}" }
      ],
      steps: [
        "Plotted points: " + pts.map(function (p) { return "(" + p.x + ", " + p.y + ")"; }).join(", ") + ".",
        "Domain (unique x-values): {" + dom.join(", ") + "}.",
        "Range (unique y-values): {" + rng.join(", ") + "}."
      ]
    };
  }

  function gen35IsRelationFunction() {
    var isFunc = Math.random() < 0.5;
    var xs = M.shuffle([-3, -2, -1, 0, 1, 2, 3, 4]).slice(0, 4);
    var pairs = [];
    var dupX = null;
    if (isFunc) {
      var sharedY = M.randInt(-3, 5);
      // Often give two x's the SAME y to test the classic misconception (still a function!)
      pairs.push([xs[0], sharedY], [xs[1], sharedY], [xs[2], M.randInt(-4, 6)], [xs[3], M.randInt(-4, 6)]);
    } else {
      dupX = xs[0];
      var y1 = M.randInt(-4, 2), y2 = y1 + M.randInt(2, 5);
      pairs.push([dupX, y1], [dupX, y2], [xs[1], M.randInt(-4, 6)], [xs[2], M.randInt(-4, 6)]);
    }
    pairs = M.shuffle(pairs);
    var dom = [], rng = [];
    pairs.forEach(function (p) {
      if (dom.indexOf(p[0]) === -1) dom.push(p[0]);
      if (rng.indexOf(p[1]) === -1) rng.push(p[1]);
    });
    dom.sort(function (a, b) { return a - b; });
    rng.sort(function (a, b) { return a - b; });
    var relHtml = M.wrapMath("{" + pairs.map(function (p) { return "(" + p[0] + ", " + p[1] + ")"; }).join(", ") + "}");
    return {
      prompt: "For the relation " + relHtml + ", determine whether it is a <strong>function</strong>, and state its domain and range.",
      inputType: "combo",
      choice: {
        label: "Is this relation a function?",
        shortLabel: "Function?",
        options: [
          { value: "yes", label: "Yes — Function" },
          { value: "no", label: "No — Not a Function" }
        ],
        answer: isFunc ? "yes" : "no",
        wrongHint: isFunc
          ? "Repeated y-values are fine as long as no x-value maps to two different y-values!"
          : "Look for an x-value that appears with two different y-values."
      },
      fields: [
        { type: "set", isNumeric: true, values: dom, label: "Domain", shortLabel: "Domain", placeholder: "{...}" },
        { type: "set", isNumeric: true, values: rng, label: "Range", shortLabel: "Range", placeholder: "{...}" }
      ],
      steps: [
        isFunc
          ? "Every x-value in the relation is paired with only one y-value ⇒ YES, it is a function."
          : "The input x = " + dupX + " is paired with two different y-values ⇒ NO, it is not a function.",
        "Domain = {" + dom.join(", ") + "}, Range = {" + rng.join(", ") + "}."
      ]
    };
  }

  function gen35MappingIsFunction() {
    var mode = M.pick(["many_to_one", "one_to_one", "not_func_names", "not_func_nums"]);
    var leftItems, rightItems, arrows, isFunc, leftTitle, rightTitle, reason;

    if (mode === "many_to_one") {
      var rule = M.pick(["square", "abs"]);
      var shift = M.randInt(0, 2);
      leftItems = [-2, -1, 0, 1, 2];
      var outSet = [];
      leftItems.forEach(function (v) {
        var out = rule === "square" ? v * v + shift : Math.abs(v) + shift;
        if (outSet.indexOf(out) === -1) outSet.push(out);
      });
      outSet.sort(function (a, b) { return a - b; });
      rightItems = outSet;
      arrows = leftItems.map(function (v, idx) {
        var out = rule === "square" ? v * v + shift : Math.abs(v) + shift;
        return { from: idx, to: rightItems.indexOf(out) };
      });
      leftTitle = "Number"; rightTitle = rule === "square" ? "Output" : "Value";
      isFunc = true;
      reason = "Each input on the left has exactly ONE outgoing arrow (two inputs sharing an output is still a function).";
    } else if (mode === "one_to_one") {
      var namePool = ["Amy", "Carol", "Devon", "Luis", "Karen", "Paul", "Ebony", "Mason", "Natalie"];
      var datePool = ["Jan 5", "Feb 15", "Mar 1", "Apr 7", "Jun 23", "Jul 20", "Aug 19", "Nov 6"];
      leftItems = M.shuffle(namePool).slice(0, 4);
      rightItems = M.shuffle(datePool).slice(0, 4);
      var perm = M.shuffle([0, 1, 2, 3]);
      arrows = leftItems.map(function (_, i) { return { from: i, to: perm[i] }; });
      leftTitle = "Name"; rightTitle = "Birthday";
      isFunc = true;
      reason = "Every person in the domain maps to exactly one birthday ⇒ YES, it is a function.";
    } else if (mode === "not_func_names") {
      var people = M.shuffle(["Jenny", "Randy", "Dennis", "Raul", "Beth", "Chris", "Liz", "Matt"]).slice(0, 4);
      var dupIdx = M.randInt(0, 3);
      leftItems = people;
      var rawEmails = [
        people[0].toLowerCase() + "@edu",
        people[1].toLowerCase() + "@mail",
        people[2].toLowerCase() + "@aol",
        people[3].toLowerCase() + "@mail",
        people[dupIdx].toLowerCase() + "2@edu"
      ];
      rightItems = M.shuffle(rawEmails);
      arrows = [
        { from: 0, to: rightItems.indexOf(rawEmails[0]) },
        { from: 1, to: rightItems.indexOf(rawEmails[1]) },
        { from: 2, to: rightItems.indexOf(rawEmails[2]) },
        { from: 3, to: rightItems.indexOf(rawEmails[3]) },
        { from: dupIdx, to: rightItems.indexOf(rawEmails[4]) }
      ];
      leftTitle = "Name"; rightTitle = "Email";
      isFunc = false;
      reason = "'" + people[dupIdx] + "' has TWO arrows leaving it (two email addresses), so it is NOT a function.";
    } else {
      var nums = M.shuffle([-3, -2, -1, 1, 2, 3, 4]).slice(0, 4).sort(function (a, b) { return a - b; });
      var outs = M.shuffle([-5, -2, 0, 3, 5, 7, 9]).slice(0, 5);
      var badIdx = M.randInt(0, 3);
      leftItems = nums;
      rightItems = outs.slice().sort(function (a, b) { return a - b; });
      arrows = [
        { from: 0, to: rightItems.indexOf(outs[0]) },
        { from: 1, to: rightItems.indexOf(outs[1]) },
        { from: 2, to: rightItems.indexOf(outs[2]) },
        { from: 3, to: rightItems.indexOf(outs[3]) },
        { from: badIdx, to: rightItems.indexOf(outs[4]) }
      ];
      leftTitle = "Input"; rightTitle = "Output";
      isFunc = false;
      reason = "Input " + nums[badIdx] + " maps to TWO outputs (" + outs[badIdx] + " and " + outs[4] + "), so it is NOT a function.";
    }

    return {
      prompt: "Use the mapping diagram to determine whether the relation is a <strong>function</strong>.",
      visual: { type: "mapping", leftTitle: leftTitle, rightTitle: rightTitle, left: leftItems, right: rightItems, arrows: arrows },
      inputType: "choice",
      options: [
        { value: "yes", label: "Yes — it is a function" },
        { value: "no", label: "No — not a function" }
      ],
      answer: isFunc ? "yes" : "no",
      steps: [
        "Check every element in the left column: a function has at most ONE outgoing arrow per input.",
        reason
      ]
    };
  }

  function gen35EqIsFunction() {
    var a = M.randInt(2, 5), b = M.randInt(1, 6);
    var templates = [
      { eq: M.htmlStdForm(a, 1, -b), isFunc: true, s1: "Solve for y: y = −" + a + "x − " + b + ".", s2: "One y per x ⇒ YES, function." },
      { eq: M.wrapMath("<i>y</i> = <i>x</i><sup>2</sup> + " + b), isFunc: true, s1: "Already solved for y: y = x² + " + b + ".", s2: "One y per x ⇒ YES, function." },
      { eq: M.wrapMath("<i>x</i> + <i>y</i><sup>2</sup> = " + b), isFunc: false, s1: "Solve for y: y = ±√(" + b + " − x).", s2: "± produces two y-values for one x ⇒ NO." },
      { eq: M.wrapMath("<i>y</i><sup>2</sup> = <i>x</i> + " + b), isFunc: false, s1: "Solve for y: y = ±√(x + " + b + ").", s2: "± produces two y-values for one x ⇒ NO." },
      { eq: M.wrapMath("<i>y</i> &minus; " + a + "<i>x</i><sup>3</sup> = " + b), isFunc: true, s1: "Solve for y: y = " + a + "x³ + " + b + ".", s2: "One y per x ⇒ YES, function." }
    ];
    var t = M.pick(templates);
    return {
      prompt: "Determine whether the equation " + t.eq + " defines <em>y</em> as a function of <em>x</em>.",
      inputType: "choice",
      options: [
        { value: "yes", label: "Yes — it is a function" },
        { value: "no", label: "No — not a function" }
      ],
      answer: t.isFunc ? "yes" : "no",
      steps: [t.s1, t.s2]
    };
  }

  function gen35EvalFunctionNum() {
    var kind = M.pick(["linear", "quadratic", "abs", "rational"]);
    if (kind === "linear") {
      var m = M.randNonZero(-6, 6), b = M.randNonZero(-7, 7), c = M.randInt(-4, 5);
      var val = m * c + b;
      return {
        prompt: "Evaluate " + M.wrapMath("<i>f</i>(" + c + ")") + " for " + M.htmlSlopeInt(m, 1, b, "=", "<i>f</i>(<i>x</i>)") + ".",
        inputType: "field",
        field: { type: "number", value: val, label: M.wrapMath("<i>f</i>(" + c + ")"), placeholder: "number" },
        steps: [
          "Substitute x = " + c + ": f(" + c + ") = " + m + "(" + c + ") + (" + b + ").",
          "Simplify: " + (m * c) + " + (" + b + ") = " + val + "."
        ]
      };
    } else if (kind === "quadratic") {
      var a = M.pick([1, 2, 3]), b = M.randNonZero(-4, 4), k = M.randInt(-3, 4), c = M.pick([-2, -1, 2, 3]);
      var val = a * c * c + b * c + k;
      var poly = M.htmlPoly([{ coef: a, deg: 2 }, { coef: b, deg: 1 }, { coef: k, deg: 0 }]);
      return {
        prompt: "Evaluate " + M.wrapMath("<i>f</i>(" + c + ")") + " for " + M.wrapMath("<i>f</i>(<i>x</i>) = ") + poly + ".",
        inputType: "field",
        field: { type: "number", value: val, label: M.wrapMath("<i>f</i>(" + c + ")"), placeholder: "number" },
        steps: [
          "Substitute x = " + c + ": f(" + c + ") = " + a + "(" + c + ")² + (" + b + ")(" + c + ") + (" + k + ").",
          "Evaluate (" + c + ")² = " + (c * c) + " first.",
          "Simplify: " + (a * c * c) + " + (" + (b * c) + ") + (" + k + ") = " + val + "."
        ]
      };
    } else if (kind === "abs") {
      var a = M.pick([2, 3]), h = M.randInt(1, 5), k = M.randNonZero(-4, 5), c = M.randInt(-4, 1);
      var val = a * Math.abs(c - h) + k;
      return {
        prompt: "Evaluate " + M.wrapMath("<i>h</i>(" + c + ")") + " for " + M.wrapMath("<i>h</i>(<i>t</i>) = " + a + "|<i>t</i> &minus; " + h + "|" + (k > 0 ? " + " + k : " &minus; " + Math.abs(k))) + ".",
        inputType: "field",
        field: { type: "number", value: val, label: M.wrapMath("<i>h</i>(" + c + ")"), placeholder: "number" },
        steps: [
          "Substitute t = " + c + ": h(" + c + ") = " + a + "|" + c + " − " + h + "| + (" + k + ").",
          "|" + (c - h) + "| = " + Math.abs(c - h) + ".",
          a + "(" + Math.abs(c - h) + ") + (" + k + ") = " + val + "."
        ]
      };
    } else {
      var a = M.randNonZero(-4, 4), b = M.randNonZero(-3, 3), c = M.randInt(2, 5);
      while (c + b === 0) c++;
      var f = M.simpFrac(c + a, c + b);
      var numStr = "<i>x</i>" + (a > 0 ? " + " + a : " &minus; " + Math.abs(a));
      var denStr = "<i>x</i>" + (b > 0 ? " + " + b : " &minus; " + Math.abs(b));
      return {
        prompt: "Evaluate " + M.wrapMath("<i>g</i>(" + c + ")") + " for " + M.wrapMath("<i>g</i>(<i>x</i>) = <span class='m-frac'><span class='m-num'>" + numStr + "</span><span class='m-den'>" + denStr + "</span></span>") + ".",
        inputType: "field",
        field: { type: "number", value: f.n / f.d, label: M.wrapMath("<i>g</i>(" + c + ")"), placeholder: "number or fraction" },
        steps: [
          "Substitute x = " + c + ": (" + c + " + (" + a + ")) / (" + c + " + (" + b + ")).",
          "Simplify: " + (c + a) + " / " + (c + b) + " = " + M.plainFrac(f.n, f.d) + "."
        ]
      };
    }
  }

  function gen35CompareFuncOps() {
    // OpenStax #315-320: contrast g(h^2), g(x + 2), and g(x) + g(2)!
    var m = M.randNonZero(-6, 5);
    var b = M.randNonZero(-7, 7);
    var c = M.pick([2, 3]);
    var gPlusIn = m + "*x + (" + (m * c + b) + ")";
    var gPlusOut = m + "*x + (" + (m * c + 2 * b) + ")";
    var gH2 = m + "*h^2 + (" + b + ")";
    return {
      prompt: "For " + M.htmlSlopeInt(m, 1, b, "=", "<i>g</i>(<i>x</i>)") + ", evaluate and simplify all three expressions (notice the difference between the last two!).",
      inputType: "multi_fields",
      fields: [
        { type: "expression", variable: "h", canonical: gH2, label: M.wrapMath("<i>g</i>(<i>h</i><sup>2</sup>)"), shortLabel: "g(h²)", placeholder: "in terms of h" },
        { type: "expression", variable: "x", canonical: gPlusIn, label: M.wrapMath("<i>g</i>(<i>x</i> + " + c + ")"), shortLabel: "g(x+" + c + ")", placeholder: "in terms of x" },
        { type: "expression", variable: "x", canonical: gPlusOut, label: M.wrapMath("<i>g</i>(<i>x</i>) + <i>g</i>(" + c + ")"), shortLabel: "g(x)+g(" + c + ")", placeholder: "in terms of x" }
      ],
      steps: [
        "g(h²): replace x with h² ⇒ " + M.htmlPoly([{ coef: m, deg: 2, v: "h" }, { coef: b, deg: 0, v: "h" }]) + ".",
        "g(x + " + c + ") = " + m + "(x + " + c + ") + (" + b + ") = " + M.htmlPoly([{ coef: m, deg: 1 }, { coef: m * c + b, deg: 0 }]) + ".",
        "g(" + c + ") = " + (m * c + b) + ", so g(x) + g(" + c + ") = (" + m + "x + " + b + ") + " + (m * c + b) + " = " + M.htmlPoly([{ coef: m, deg: 1 }, { coef: m * c + 2 * b, deg: 0 }]) + "."
      ]
    };
  }

  function gen35FunctionApp() {
    var kind = M.pick(["printing", "dvr"]);
    if (kind === "printing") {
      var perBook = M.pick([3.25, 4.5, 6.25, 7.25]);
      var fixed = M.pick([1200, 1500, 2000, 2500]);
      var qty = M.pick([400, 500, 1000]);
      var cQty = Math.round((perBook * qty + fixed) * 100) / 100;
      return {
        prompt: "The daily cost to print books is modeled by " + M.wrapMath("<i>C</i>(<i>x</i>) = " + perBook + "<i>x</i> + " + fixed) + ", where <em>C</em> is total daily cost (dollars) and <em>x</em> is the number of books printed.",
        inputType: "combo",
        choice: {
          label: "Which is the independent variable and which is the dependent variable?",
          shortLabel: "Variables",
          options: M.shuffle([
            { value: "x_ind", label: "Independent: x (books); Dependent: C (cost)" },
            { value: "c_ind", label: "Independent: C (cost); Dependent: x (books)" }
          ]),
          answer: "x_ind"
        },
        fields: [
          { type: "number", value: fixed, label: M.wrapMath("Find <i>C</i>(0) — fixed daily cost ($)"), shortLabel: "C(0)", placeholder: "dollars" },
          { type: "number", value: cQty, label: M.wrapMath("Find <i>C</i>(" + qty + ") — daily cost for " + qty + " books ($)"), shortLabel: "C(" + qty + ")", placeholder: "dollars" }
        ],
        steps: [
          "Cost C depends on the number of books x, so x is independent and C is dependent.",
          "C(0) = " + perBook + "(0) + " + fixed + " = $" + fixed + " (fixed overhead even when 0 books are printed).",
          "C(" + qty + ") = " + perBook + "(" + qty + ") + " + fixed + " = $" + cQty + "."
        ]
      };
    } else {
      var init = M.randInt(40, 95);
      var rate = M.pick([10, 15, 20, 25]);
      var weeks = M.pick([4, 6, 8, 10]);
      var val = init + rate * weeks;
      return {
        prompt: "A DVR starts with " + init + " unwatched shows and adds " + rate + " shows per week, modeled by " + M.wrapMath("<i>N</i>(<i>t</i>) = " + init + " + " + rate + "<i>t</i>") + " (<em>t</em> in weeks).",
        inputType: "combo",
        choice: {
          label: "Identify the independent and dependent variables:",
          shortLabel: "Variables",
          options: M.shuffle([
            { value: "t_ind", label: "Independent: t (weeks); Dependent: N (shows)" },
            { value: "n_ind", label: "Independent: N (shows); Dependent: t (weeks)" }
          ]),
          answer: "t_ind"
        },
        fields: [
          { type: "number", value: val, label: M.wrapMath("Find <i>N</i>(" + weeks + ") — unwatched shows after " + weeks + " weeks"), shortLabel: "N(" + weeks + ")", placeholder: "number of shows" }
        ],
        steps: [
          "The number of shows N depends on time t, so t is independent and N is dependent.",
          "N(" + weeks + ") = " + init + " + " + rate + "(" + weeks + ") = " + init + " + " + (rate * weeks) + " = " + val + " unwatched shows."
        ]
      };
    }
  }

  // =========================================================
  // SECTION 3.6: Graphs of Functions
  // =========================================================

  function gen36VerticalLineTest() {
    var h = M.randInt(-2, 2), k = M.randInt(-2, 2);
    var flip = M.pick([-1, 1]);
    var shapes = [
      {
        isFunc: true,
        curves: [{ kind: "fn", fn: function (x) { return flip * 0.45 * (x - h) * (x - h) + k; }, arrowStart: true, arrowEnd: true }],
        reason: "Every vertical line intersects this parabola at most once ⇒ YES, function."
      },
      {
        isFunc: false,
        curves: [{ kind: "parametric", fx: function (t) { return flip * 0.45 * t * t + h; }, fy: function (t) { return t + k; }, tMin: -4.4, tMax: 4.4, arrowStart: true, arrowEnd: true }],
        reason: "A vertical line at x = " + (h + 2 * flip) + " hits the sideways parabola twice ⇒ NO, not a function."
      },
      {
        isFunc: true,
        curves: [{ kind: "fn", fn: function (x) { return flip * 0.35 * Math.pow(x - h, 3) + k; }, domain: [h - 3.2, h + 3.2], arrowStart: true, arrowEnd: true }],
        reason: "Every vertical line crosses this cubic curve exactly once ⇒ YES, function."
      },
      {
        isFunc: false,
        curves: [{ kind: "parametric", fx: function (t) { return flip * Math.abs(t) + h; }, fy: function (t) { return t + k; }, tMin: -6, tMax: 6, arrowStart: true, arrowEnd: true }],
        reason: "Vertical lines cross both branches of this sideways V-shape twice ⇒ NO, not a function."
      },
      {
        isFunc: false,
        curves: [{ kind: "parametric", fx: function (t) { return h + 3 * Math.cos(t); }, fy: function (t) { return k + 3 * Math.sin(t); }, tMin: 0, tMax: 2 * Math.PI }],
        reason: "A vertical line through x = " + h + " intersects the circle at top and bottom (twice) ⇒ NO, not a function."
      },
      {
        isFunc: false,
        curves: [
          { kind: "parametric", fx: function (t) { return 2 * Math.cosh(t); }, fy: function (t) { return 2.8 * Math.sinh(t) + k; }, tMin: -1.6, tMax: 1.6, arrowStart: true, arrowEnd: true },
          { kind: "parametric", fx: function (t) { return -2 * Math.cosh(t); }, fy: function (t) { return 2.8 * Math.sinh(t) + k; }, tMin: -1.6, tMax: 1.6, arrowStart: true, arrowEnd: true }
        ],
        reason: "Vertical lines at x = ±4 cross the hyperbola twice ⇒ NO, not a function."
      },
      {
        isFunc: true,
        curves: [{ kind: "fn", fn: function (x) { return flip * Math.abs(x - h) + k; }, arrowStart: true, arrowEnd: true }],
        reason: "Every vertical line hits this V-shaped absolute value graph once ⇒ YES, function."
      }
    ];
    var sh = M.pick(shapes);
    return {
      prompt: "Use the <strong>Vertical Line Test</strong> to determine whether the graph represents a function.",
      visual: {
        type: "coordinate_plane", xMin: -8, xMax: 8, yMin: -8, yMax: 8,
        gridStepX: 2, gridStepY: 2, labelStepX: 4, labelStepY: 4,
        curves: sh.curves
      },
      inputType: "choice",
      options: [
        { value: "yes", label: "Yes — Function" },
        { value: "no", label: "No — Not a Function" }
      ],
      answer: sh.isFunc ? "yes" : "no",
      steps: [
        "Vertical Line Test: a graph is a function if no vertical line intersects it more than once.",
        sh.reason
      ]
    };
  }

  function gen36BasicFuncFromEq() {
    // OpenStax #341-376: identify basic function family (including Constant) + domain & range from equation
    var c = M.randNonZero(-4, 4);
    var a = M.pick([2, 3, -2, -3]);
    var kinds = [
      {
        eq: M.htmlSlopeInt(a, 1, c, "=", "<i>f</i>(<i>x</i>)"),
        family: "linear", dom: "(-inf, inf)", rng: "(-inf, inf)",
        steps: [
          "f(x) = mx + b (m ≠ 0) is a slanted Linear function.",
          "Any real number x works and every real y is reached: Domain = (−∞, ∞), Range = (−∞, ∞)."
        ]
      },
      {
        eq: M.wrapMath("<i>f</i>(<i>x</i>) = " + c),
        family: "constant", dom: "(-inf, inf)", rng: "[" + c + ", " + c + "]",
        steps: [
          "f(x) = " + c + " has no x-term — it is a Constant function (horizontal line at y = " + c + ").",
          "Domain = (−∞, ∞). Every input maps to the single output " + c + ", so Range = {" + c + "}."
        ]
      },
      {
        eq: M.wrapMath("<i>f</i>(<i>x</i>) = " + (a > 0 ? a : "&minus;" + Math.abs(a)) + "<i>x</i><sup>2</sup>"),
        family: "square", dom: "(-inf, inf)", rng: a > 0 ? "[0, inf)" : "(-inf, 0]",
        steps: [
          "The x² term makes this a Square (quadratic) function — a parabola with vertex at (0, 0).",
          "Domain = (−∞, ∞). Because " + a + " is " + (a > 0 ? "positive, it opens UP: Range = [0, ∞)." : "negative, it opens DOWN: Range = (−∞, 0].")
        ]
      },
      {
        eq: M.wrapMath("<i>f</i>(<i>x</i>) = <i>x</i><sup>2</sup>" + (c > 0 ? " + " + c : " &minus; " + Math.abs(c))),
        family: "square", dom: "(-inf, inf)", rng: "[" + c + ", inf)",
        steps: [
          "This is a Square function shifted vertically by " + c + " (vertex at (0, " + c + "), opening upward).",
          "Domain = (−∞, ∞), Range = [" + c + ", ∞)."
        ]
      },
      {
        eq: M.wrapMath("<i>f</i>(<i>x</i>) = <i>x</i><sup>3</sup>" + (c > 0 ? " + " + c : " &minus; " + Math.abs(c))),
        family: "cube", dom: "(-inf, inf)", rng: "(-inf, inf)",
        steps: [
          "The x³ term makes this a Cube function.",
          "Cube functions extend forever in all directions: Domain = (−∞, ∞), Range = (−∞, ∞)."
        ]
      },
      {
        eq: M.wrapMath("<i>f</i>(<i>x</i>) = &radic;<span style='text-decoration:overline'><i>x</i>" + (c > 0 ? " + " + c : " &minus; " + Math.abs(c)) + "</span>"),
        family: "sqrt", dom: "[" + (-c) + ", inf)", rng: "[0, inf)",
        steps: [
          "This is a Square Root function. The radicand must be ≥ 0: x + (" + c + ") ≥ 0 ⇒ x ≥ " + (-c) + ".",
          "Domain = [" + (-c) + ", ∞). Square roots are non-negative, so Range = [0, ∞)."
        ]
      },
      {
        eq: M.wrapMath("<i>f</i>(<i>x</i>) = " + (a > 0 ? a : "&minus;" + Math.abs(a)) + "&radic;<span style='text-decoration:overline'><i>x</i></span>"),
        family: "sqrt", dom: "[0, inf)", rng: a > 0 ? "[0, inf)" : "(-inf, 0]",
        steps: [
          "This is a Square Root function, requiring x ≥ 0 ⇒ Domain = [0, ∞).",
          "Since √x ≥ 0 and the multiplier is " + a + ", Range = " + (a > 0 ? "[0, ∞)." : "(−∞, 0].")
        ]
      },
      {
        eq: M.wrapMath("<i>f</i>(<i>x</i>) = |<i>x</i>|" + (c > 0 ? " + " + c : " &minus; " + Math.abs(c))),
        family: "abs", dom: "(-inf, inf)", rng: "[" + c + ", inf)",
        steps: [
          "This is an Absolute Value function (V-shape opening upward from y = " + c + ").",
          "Domain = (−∞, ∞). Because |x| ≥ 0, f(x) ≥ " + c + " ⇒ Range = [" + c + ", ∞)."
        ]
      },
      {
        eq: M.wrapMath("<i>f</i>(<i>x</i>) = &minus;" + Math.abs(a) + "|<i>x</i>|"),
        family: "abs", dom: "(-inf, inf)", rng: "(-inf, 0]",
        steps: [
          "This is an Absolute Value function reflected downward by −" + Math.abs(a) + ".",
          "Domain = (−∞, ∞). Highest value is 0 at x = 0 ⇒ Range = (−∞, 0]."
        ]
      }
    ];

    var g = M.pick(kinds);
    return {
      prompt: "Identify the basic function family for " + g.eq + ", and state its <strong>domain</strong> and <strong>range</strong> (use interval notation, or {c} for a constant function's range).",
      inputType: "combo",
      choice: {
        label: "Basic Function Family",
        shortLabel: "Function Family",
        options: [
          { value: "linear", label: "Linear" },
          { value: "constant", label: "Constant" },
          { value: "square", label: "Square (Quadratic)" },
          { value: "cube", label: "Cube" },
          { value: "sqrt", label: "Square Root" },
          { value: "abs", label: "Absolute Value" }
        ],
        answer: g.family
      },
      fields: [
        { type: "interval", canonical: g.dom, label: "Domain", shortLabel: "Domain", placeholder: "e.g. (-∞, ∞) or [0, ∞)" },
        { type: "interval", canonical: g.rng, label: "Range", shortLabel: "Range", placeholder: "e.g. [0, ∞), (-∞, 0], or {5}" }
      ],
      steps: g.steps
    };
  }

  function gen36MatchBasicGraph() {
    // Visual Graph-to-Equation matching across all 6 OpenStax basic function families (#341-376)
    var k = M.pick([-3, -2, -1, 1, 2, 3]);
    var a = M.pick([-2, 2]);
    var cases = [
      {
        family: "Constant",
        curves: [{ kind: "fn", fn: function () { return k; }, arrowStart: true, arrowEnd: true }],
        correct: M.wrapMath("<i>f</i>(<i>x</i>) = " + (k < 0 ? "&minus;" + Math.abs(k) : k)),
        distractors: [
          M.htmlSlopeInt(k, 1, 0, "=", "<i>f</i>(<i>x</i>)"),
          M.htmlSlopeInt(1, 1, k, "=", "<i>f</i>(<i>x</i>)"),
          M.wrapMath("<i>f</i>(<i>x</i>) = " + (-k < 0 ? "&minus;" + Math.abs(k) : (-k)))
        ],
        dom: "(-inf, inf)", rng: "[" + k + ", " + k + "]",
        steps: [
          "A horizontal line at y = " + k + " is the Constant function f(x) = " + k + ".",
          "Domain = (−∞, ∞), Range = {" + k + "}."
        ]
      },
      {
        family: "Linear",
        curves: [{ kind: "fn", fn: function (x) { return a * x + k; }, arrowStart: true, arrowEnd: true }],
        correct: M.htmlSlopeInt(a, 1, k, "=", "<i>f</i>(<i>x</i>)"),
        distractors: [
          M.htmlSlopeInt(-a, 1, k, "=", "<i>f</i>(<i>x</i>)"),
          M.htmlSlopeInt(a, 1, -k, "=", "<i>f</i>(<i>x</i>)"),
          M.wrapMath("<i>f</i>(<i>x</i>) = " + (a < 0 ? "&minus;" + Math.abs(a) : a) + "|<i>x</i>|" + (k > 0 ? " + " + k : " &minus; " + Math.abs(k)))
        ],
        dom: "(-inf, inf)", rng: "(-inf, inf)",
        steps: [
          "A straight slanted line with y-intercept (0, " + k + ") and slope " + a + " matches " + M.htmlSlopeInt(a, 1, k, "=", "<i>f</i>(<i>x</i>)") + ".",
          "Domain = (−∞, ∞), Range = (−∞, ∞)."
        ]
      },
      {
        family: "Square",
        curves: [{ kind: "fn", fn: function (x) { return x * x + k; }, arrowStart: true, arrowEnd: true }],
        correct: M.wrapMath("<i>f</i>(<i>x</i>) = <i>x</i><sup>2</sup>" + (k > 0 ? " + " + k : " &minus; " + Math.abs(k))),
        distractors: [
          M.wrapMath("<i>f</i>(<i>x</i>) = &minus;<i>x</i><sup>2</sup>" + (k > 0 ? " + " + k : " &minus; " + Math.abs(k))),
          M.wrapMath("<i>f</i>(<i>x</i>) = |<i>x</i>|" + (k > 0 ? " + " + k : " &minus; " + Math.abs(k))),
          M.wrapMath("<i>f</i>(<i>x</i>) = <i>x</i><sup>2</sup>" + (-k > 0 ? " + " + (-k) : " &minus; " + Math.abs(k)))
        ],
        dom: "(-inf, inf)", rng: "[" + k + ", inf)",
        steps: [
          "The smooth U-shaped parabola opening upward with vertex (0, " + k + ") is f(x) = x²" + (k > 0 ? " + " + k : " − " + Math.abs(k)) + ".",
          "Domain = (−∞, ∞), Range = [" + k + ", ∞)."
        ]
      },
      {
        family: "Cube",
        curves: [{ kind: "fn", fn: function (x) { return x * x * x + k; }, domain: [-2.4, 2.4], arrowStart: true, arrowEnd: true }],
        correct: M.wrapMath("<i>f</i>(<i>x</i>) = <i>x</i><sup>3</sup>" + (k > 0 ? " + " + k : " &minus; " + Math.abs(k))),
        distractors: [
          M.wrapMath("<i>f</i>(<i>x</i>) = &minus;<i>x</i><sup>3</sup>" + (k > 0 ? " + " + k : " &minus; " + Math.abs(k))),
          M.wrapMath("<i>f</i>(<i>x</i>) = <i>x</i><sup>2</sup>" + (k > 0 ? " + " + k : " &minus; " + Math.abs(k))),
          M.wrapMath("<i>f</i>(<i>x</i>) = <i>x</i><sup>3</sup>" + (-k > 0 ? " + " + (-k) : " &minus; " + Math.abs(k)))
        ],
        dom: "(-inf, inf)", rng: "(-inf, inf)",
        steps: [
          "The S-shaped curve rising left-to-right and crossing the y-axis at (0, " + k + ") is the Cube function f(x) = x³" + (k > 0 ? " + " + k : " − " + Math.abs(k)) + ".",
          "Domain = (−∞, ∞), Range = (−∞, ∞)."
        ]
      },
      {
        family: "Square Root",
        curves: [{ kind: "fn", fn: function (x) { return x >= k ? Math.sqrt(x - k) : NaN; }, domain: [k, 6], arrowEnd: true }],
        points: [{ x: k, y: 0 }],
        correct: M.wrapMath("<i>f</i>(<i>x</i>) = &radic;<span style='text-decoration:overline'><i>x</i>" + (k > 0 ? " &minus; " + k : " + " + Math.abs(k)) + "</span>"),
        distractors: [
          M.wrapMath("<i>f</i>(<i>x</i>) = &radic;<span style='text-decoration:overline'><i>x</i>" + (k > 0 ? " + " + k : " &minus; " + Math.abs(k)) + "</span>"),
          M.wrapMath("<i>f</i>(<i>x</i>) = &minus;&radic;<span style='text-decoration:overline'><i>x</i>" + (k > 0 ? " &minus; " + k : " + " + Math.abs(k)) + "</span>"),
          M.wrapMath("<i>f</i>(<i>x</i>) = |<i>x</i>" + (k > 0 ? " &minus; " + k : " + " + Math.abs(k)) + "|")
        ],
        dom: "[" + k + ", inf)", rng: "[0, inf)",
        steps: [
          "A half-parabola starting at (" + k + ", 0) and curving right/upward is a Square Root function: x − (" + k + ") ≥ 0.",
          "Domain = [" + k + ", ∞), Range = [0, ∞)."
        ]
      },
      {
        family: "Absolute Value",
        curves: [{ kind: "fn", fn: function (x) { return (a > 0 ? 1 : -1) * Math.abs(x) + k; }, arrowStart: true, arrowEnd: true }],
        correct: M.wrapMath("<i>f</i>(<i>x</i>) = " + (a > 0 ? "" : "&minus;") + "|<i>x</i>|" + (k > 0 ? " + " + k : " &minus; " + Math.abs(k))),
        distractors: [
          M.wrapMath("<i>f</i>(<i>x</i>) = " + (a > 0 ? "&minus;" : "") + "|<i>x</i>|" + (k > 0 ? " + " + k : " &minus; " + Math.abs(k))),
          M.wrapMath("<i>f</i>(<i>x</i>) = " + (a > 0 ? "" : "&minus;") + "<i>x</i><sup>2</sup>" + (k > 0 ? " + " + k : " &minus; " + Math.abs(k))),
          M.wrapMath("<i>f</i>(<i>x</i>) = " + (a > 0 ? "" : "&minus;") + "|<i>x</i>|" + (-k > 0 ? " + " + (-k) : " &minus; " + Math.abs(k)))
        ],
        dom: "(-inf, inf)", rng: a > 0 ? "[" + k + ", inf)" : "(-inf, " + k + "]",
        steps: [
          "The sharp V-shape with corner at (0, " + k + ") opening " + (a > 0 ? "upward" : "downward") + " is an Absolute Value function.",
          "Domain = (−∞, ∞), Range = " + (a > 0 ? "[" + k + ", ∞)." : "(−∞, " + k + "].")
        ]
      }
    ];

    var g = M.pick(cases);
    var opts = M.shuffle([
      { value: "correct", label: g.correct },
      { value: "d1", label: g.distractors[0] },
      { value: "d2", label: g.distractors[1] },
      { value: "d3", label: g.distractors[2] }
    ]);

    return {
      prompt: "Identify the equation of the basic function shown in the graph, and state its <strong>domain</strong> and <strong>range</strong>.",
      visual: {
        type: "coordinate_plane", xMin: -6, xMax: 6, yMin: -6, yMax: 6,
        gridStepX: 1, gridStepY: 1, labelStepX: 2, labelStepY: 2,
        curves: g.curves,
        points: g.points || []
      },
      inputType: "combo",
      choice: {
        label: "Which equation matches this graph?",
        shortLabel: "Equation",
        options: opts,
        answer: "correct"
      },
      fields: [
        { type: "interval", canonical: g.dom, label: "Domain", shortLabel: "Domain", placeholder: "e.g. (-∞, ∞) or [0, ∞)" },
        { type: "interval", canonical: g.rng, label: "Range", shortLabel: "Range", placeholder: "e.g. [0, ∞), (-∞, 0], or {3}" }
      ],
      steps: g.steps
    };
  }

  function gen36BasicDomainRange() {
    var k = M.randInt(-3, 3);
    var h = M.randInt(-2, 3);
    var r = M.pick([2, 3, 4]);
    var kinds = [
      {
        curves: [{ kind: "fn", fn: function (x) { return Math.abs(x) + k; }, arrowStart: true, arrowEnd: true }],
        dom: "(-inf, inf)", rng: "[" + k + ", inf)",
        stepD: "Extends indefinitely left and right ⇒ Domain = (−∞, ∞).",
        stepR: "Lowest point is y = " + k + " and rises forever ⇒ Range = [" + k + ", ∞)."
      },
      {
        curves: [{ kind: "fn", fn: function (x) { return -0.5 * x * x + k; }, arrowStart: true, arrowEnd: true }],
        dom: "(-inf, inf)", rng: "(-inf, " + k + "]",
        stepD: "Extends indefinitely left and right ⇒ Domain = (−∞, ∞).",
        stepR: "Highest point is y = " + k + " and falls forever ⇒ Range = (−∞, " + k + "]."
      },
      {
        curves: [{ kind: "fn", fn: function (x) { return x >= h ? 2 * Math.sqrt(x - h) : NaN; }, domain: [h, 8], arrowEnd: true }],
        points: [{ x: h, y: 0 }],
        dom: "[" + h + ", inf)", rng: "[0, inf)",
        stepD: "Starts at x = " + h + " (included) and extends right forever ⇒ Domain = [" + h + ", ∞).",
        stepR: "Starts at y = 0 (included) and rises forever ⇒ Range = [0, ∞)."
      },
      {
        curves: [{ kind: "fn", fn: function (x) { var v = r * r - x * x; return v >= 0 ? Math.sqrt(v) : NaN; }, domain: [-r, r] }],
        dom: "[" + (-r) + ", " + r + "]", rng: "[0, " + r + "]",
        stepD: "Spans x = " + (-r) + " to x = " + r + " ⇒ Domain = [" + (-r) + ", " + r + "].",
        stepR: "Spans y = 0 to y = " + r + " ⇒ Range = [0, " + r + "]."
      }
    ];
    var g = M.pick(kinds);
    return {
      prompt: "Use the graph of the function to find its <strong>domain</strong> and <strong>range</strong> in interval notation.",
      visual: {
        type: "coordinate_plane", xMin: -6, xMax: 6, yMin: -6, yMax: 6,
        gridStepX: 1, gridStepY: 1, labelStepX: 2, labelStepY: 2,
        curves: g.curves,
        points: g.points || []
      },
      inputType: "multi_fields",
      fields: [
        { type: "interval", canonical: g.dom, label: "Domain (interval notation)", shortLabel: "Domain", placeholder: "e.g. (-∞, ∞) or [-3, 3]" },
        { type: "interval", canonical: g.rng, label: "Range (interval notation)", shortLabel: "Range", placeholder: "e.g. [0, ∞)" }
      ],
      steps: [g.stepD, g.stepR]
    };
  }

  function gen36ReadGraphValues() {
    var mode = M.pick(["semicircle_axis", "semicircle_lifted", "cosine"]);
    if (mode === "semicircle_axis" || mode === "semicircle_lifted") {
      var r = M.pick([3, 4]);
      var vShift = mode === "semicircle_axis" ? 0 : 2;
      var zeros = vShift === 0 ? [-r, r] : [];
      var xInts = vShift === 0 ? [{ x: -r, y: 0 }, { x: r, y: 0 }] : [];
      return {
        prompt: "Use the graph of " + M.wrapMath("<i>f</i>") + " to find the indicated values, <em>x</em>-intercepts, and domain/range.",
        visual: {
          type: "coordinate_plane", xMin: -6, xMax: 6, yMin: -2, yMax: 8,
          gridStepX: 1, gridStepY: 1, labelStepX: 2, labelStepY: 2,
          curves: [{ kind: "fn", fn: function (x) { var v = r * r - x * x; return v >= 0 ? Math.sqrt(v) + vShift : NaN; }, domain: [-r, r] }]
        },
        inputType: "multi_fields",
        fields: [
          { type: "number", value: r + vShift, label: M.wrapMath("Find <i>f</i>(0)"), shortLabel: "f(0)", placeholder: "number" },
          { type: "set", isNumeric: true, values: zeros, label: M.wrapMath("Values of <i>x</i> when <i>f</i>(<i>x</i>) = 0"), shortLabel: "x when f(x)=0", placeholder: "e.g. -2, 2 or none" },
          { type: "point_list", points: xInts, label: "x-intercept(s)", shortLabel: "x-intercepts", placeholder: "e.g. (-2, 0), (2, 0) or none" },
          { type: "interval", canonical: "[" + (-r) + ", " + r + "]", label: "Domain", shortLabel: "Domain", placeholder: "[a, b]" },
          { type: "interval", canonical: "[" + vShift + ", " + (r + vShift) + "]", label: "Range", shortLabel: "Range", placeholder: "[c, d]" }
        ],
        steps: [
          "At x = 0, the peak is y = " + (r + vShift) + " ⇒ f(0) = " + (r + vShift) + ".",
          vShift === 0
            ? "The curve touches the x-axis (y = 0) at x = " + (-r) + " and x = " + r + ", giving x-intercepts (" + (-r) + ", 0) and (" + r + ", 0)."
            : "The entire semicircle stays at y ≥ " + vShift + " and never touches the x-axis ⇒ 'none' for both f(x) = 0 and x-intercepts.",
          "Domain = [" + (-r) + ", " + r + "], Range = [" + vShift + ", " + (r + vShift) + "]."
        ]
      };
    } else {
      var amp = M.pick([1, 2]);
      var sign = M.pick([1, -1]);
      var fn = function (x) { return sign * amp * Math.sin(x); };
      var zeros = [-2 * Math.PI, -Math.PI, 0, Math.PI, 2 * Math.PI];
      return {
        prompt: "Use the periodic graph shown on " + M.wrapMath("[&minus;2&pi;, 2&pi;]") + " to read the values, zeros on " + M.wrapMath("[&minus;2&pi;, 2&pi;]") + ", and domain/range.",
        visual: {
          type: "coordinate_plane", xMin: -2 * Math.PI, xMax: 2 * Math.PI, yMin: -4, yMax: 4,
          piTicks: true, gridStepY: 1, labelStepY: 2,
          curves: [{ kind: "fn", fn: fn, domain: [-2 * Math.PI, 2 * Math.PI], arrowStart: true, arrowEnd: true }]
        },
        inputType: "multi_fields",
        fields: [
          { type: "number", value: 0, label: M.wrapMath("Find <i>f</i>(0)"), shortLabel: "f(0)", placeholder: "number" },
          { type: "number", value: sign * amp, label: M.wrapMath("Find <i>f</i>(<span class='m-frac'><span class='m-num'>&pi;</span><span class='m-den'>2</span></span>)"), shortLabel: "f(π/2)", placeholder: "number" },
          { type: "set", isNumeric: true, values: zeros, label: M.wrapMath("Values of <i>x</i> on [&minus;2&pi;, 2&pi;] where <i>f</i>(<i>x</i>) = 0"), shortLabel: "Zeros", placeholder: "e.g. -π, 0, π or none" },
          { type: "interval", canonical: "(-inf, inf)", label: "Domain", shortLabel: "Domain", placeholder: "interval" },
          { type: "interval", canonical: "[" + (-amp) + ", " + amp + "]", label: "Range", shortLabel: "Range", placeholder: "[min, max]" }
        ],
        steps: [
          "At x = 0, the curve passes through the origin: f(0) = 0.",
          "At x = π/2 (halfway between 0 and π), the curve reaches " + (sign * amp) + " ⇒ f(π/2) = " + (sign * amp) + ".",
          "The curve crosses the x-axis at x = −2π, −π, 0, π, 2π.",
          "Arrows show Domain = (−∞, ∞); y oscillates between " + (-amp) + " and " + amp + " ⇒ Range = [" + (-amp) + ", " + amp + "]."
        ]
      };
    }
  }

  // =========================================================
  // REGISTER CHAPTER 3 PLUGIN (46 Generators, 26/26 OpenStax Objectives)
  // =========================================================
  window.AlgebraApp.registerChapter({
    id: "ch03",
    title: "Chapter 3: Graphs and Functions",
    sections: [
      {
        id: "3.1",
        shortTitle: "Linear Graphs",
        title: "Graph Linear Equations in Two Variables",
        objectives: [
          "Plot points in a rectangular coordinate system",
          "Graph a linear equation by plotting points",
          "Graph vertical and horizontal lines",
          "Find the x- and y-intercepts",
          "Graph a line using the intercepts"
        ],
        generators: [
          { id: "3.1_quad", objective: "Plot points in a rectangular coordinate system", generate: gen31Quadrant },
          { id: "3.1_plot", objective: "Plot points in a rectangular coordinate system", generate: gen31PlotPoints },
          { id: "3.1_sol", objective: "Plot points in a rectangular coordinate system", generate: gen31VerifySolutions },
          { id: "3.1_lin", objective: "Graph a linear equation by plotting points", generate: gen31GraphLinear },
          { id: "3.1_hv", objective: "Graph vertical and horizontal lines", generate: gen31GraphHV },
          { id: "3.1_pair", objective: "Graph vertical and horizontal lines", generate: gen31GraphPairLines },
          { id: "3.1_intg", objective: "Find the x- and y-intercepts", generate: gen31InterceptsFromGraph },
          { id: "3.1_inte", objective: "Find the x- and y-intercepts", generate: gen31InterceptsFromEq },
          { id: "3.1_gint", objective: "Graph a line using the intercepts", generate: gen31GraphIntercepts },
          { id: "3.1_orig", objective: "Graph a line using the intercepts", generate: gen31OriginIntercepts }
        ]
      },
      {
        id: "3.2",
        shortTitle: "Slope",
        title: "Slope of a Line",
        objectives: [
          "Find the slope of a line",
          "Graph a line given a point and the slope",
          "Graph a line using its slope and intercept",
          "Choose the most convenient method to graph a line",
          "Graph and interpret applications of slope-intercept",
          "Use slopes to identify parallel and perpendicular lines"
        ],
        generators: [
          { id: "3.2_sg", objective: "Find the slope of a line", generate: gen32SlopeFromGraph },
          { id: "3.2_shv", objective: "Find the slope of a line", generate: gen32SlopeHVEquation },
          { id: "3.2_s2p", objective: "Find the slope of a line", generate: gen32SlopeTwoPoints },
          { id: "3.2_gps", objective: "Graph a line given a point and the slope", generate: gen32GraphPointSlope },
          { id: "3.2_syi", objective: "Graph a line using its slope and intercept", generate: gen32SlopeYIntFromEq },
          { id: "3.2_gsyi", objective: "Graph a line using its slope and intercept", generate: gen32GraphSlopeIntercept },
          { id: "3.2_meth", objective: "Choose the most convenient method to graph a line", generate: gen32ChooseMethod },
          { id: "3.2_app", objective: "Graph and interpret applications of slope-intercept", generate: gen32LinearApp },
          { id: "3.2_pp", objective: "Use slopes to identify parallel and perpendicular lines", generate: gen32ParallelPerp }
        ]
      },
      {
        id: "3.3",
        shortTitle: "Line Equations",
        title: "Find the Equation of a Line",
        objectives: [
          "Find an equation of the line given the slope and y-intercept",
          "Find an equation of the line given the slope and a point",
          "Find an equation of the line given two points",
          "Find an equation of a line parallel to a given line",
          "Find an equation of a line perpendicular to a given line"
        ],
        generators: [
          { id: "3.3_syi", objective: "Find an equation of the line given the slope and y-intercept", generate: gen33SlopeYInt },
          { id: "3.3_gr", objective: "Find an equation of the line given the slope and y-intercept", generate: gen33EqFromGraph },
          { id: "3.3_ps", objective: "Find an equation of the line given the slope and a point", generate: gen33PointSlope },
          { id: "3.3_2p", objective: "Find an equation of the line given two points", generate: gen33TwoPoints },
          { id: "3.3_par", objective: "Find an equation of a line parallel to a given line", generate: gen33Parallel },
          { id: "3.3_pars", objective: "Find an equation of a line parallel to a given line", generate: gen33ParallelSpecial },
          { id: "3.3_perp", objective: "Find an equation of a line perpendicular to a given line", generate: gen33Perpendicular },
          { id: "3.3_perps", objective: "Find an equation of a line perpendicular to a given line", generate: gen33PerpendicularSpecial }
        ]
      },
      {
        id: "3.4",
        shortTitle: "Inequalities",
        title: "Graph Linear Inequalities in Two Variables",
        objectives: [
          "Verify solutions to an inequality in two variables",
          "Recognize the relation between the solutions of an inequality and its graph",
          "Graph linear inequalities in two variables",
          "Solve applications using linear inequalities in two variables"
        ],
        generators: [
          { id: "3.4_ver", objective: "Verify solutions to an inequality in two variables", generate: gen34VerifyIneq },
          { id: "3.4_read", objective: "Recognize the relation between the solutions of an inequality and its graph", generate: gen34ReadIneqGraph },
          { id: "3.4_grsi", objective: "Graph linear inequalities in two variables", generate: gen34GraphIneqSlopeInt },
          { id: "3.4_grstd", objective: "Graph linear inequalities in two variables", generate: gen34GraphIneqStdAndHV },
          { id: "3.4_app", objective: "Solve applications using linear inequalities in two variables", generate: gen34IneqApp }
        ]
      },
      {
        id: "3.5",
        shortTitle: "Functions",
        title: "Relations and Functions",
        objectives: [
          "Find the domain and range of a relation",
          "Determine if a relation is a function",
          "Find the value of a function"
        ],
        generators: [
          { id: "3.5_dr", objective: "Find the domain and range of a relation", generate: gen35DomainRangePairs },
          { id: "3.5_mdr", objective: "Find the domain and range of a relation", generate: gen35MappingDomainRange },
          { id: "3.5_gp", objective: "Find the domain and range of a relation", generate: gen35GraphPointsDomainRange },
          { id: "3.5_isrel", objective: "Determine if a relation is a function", generate: gen35IsRelationFunction },
          { id: "3.5_map", objective: "Determine if a relation is a function", generate: gen35MappingIsFunction },
          { id: "3.5_eqf", objective: "Determine if a relation is a function", generate: gen35EqIsFunction },
          { id: "3.5_evn", objective: "Find the value of a function", generate: gen35EvalFunctionNum },
          { id: "3.5_cmp", objective: "Find the value of a function", generate: gen35CompareFuncOps },
          { id: "3.5_app", objective: "Find the value of a function", generate: gen35FunctionApp }
        ]
      },
      {
        id: "3.6",
        shortTitle: "Function Graphs",
        title: "Graphs of Functions",
        objectives: [
          "Use the vertical line test",
          "Identify graphs of basic functions",
          "Read information from a graph of a function"
        ],
        generators: [
          { id: "3.6_vlt", objective: "Use the vertical line test", generate: gen36VerticalLineTest },
          { id: "3.6_match", objective: "Identify graphs of basic functions", generate: gen36MatchBasicGraph },
          { id: "3.6_eq", objective: "Identify graphs of basic functions", generate: gen36BasicFuncFromEq },
          { id: "3.6_dr", objective: "Read information from a graph of a function", generate: gen36BasicDomainRange },
          { id: "3.6_rd", objective: "Read information from a graph of a function", generate: gen36ReadGraphValues }
        ]
      }
    ]
  });
})();

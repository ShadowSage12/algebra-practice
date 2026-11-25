(function () {
  "use strict";

  var EPS = 1e-5;

  function normalizeText(raw) {
    return String(raw || "")
      .replace(/\u2212|\u2013|\u2014/g, "-")
      .replace(/\u00d7|\u00b7/g, "*")
      .replace(/\u00f7/g, "/")
      .replace(/\u2264/g, "<=")
      .replace(/\u2265/g, ">=")
      .replace(/\u221e/g, "inf")
      .replace(/\u03c0/g, "pi")
      .replace(/\u221a/g, "sqrt")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Strip optional "$", thousand-separator commas inside numbers, or label prefixes like "f(2) =", "m ="
  function cleanValueInput(raw, allowPrefixStrip) {
    var s = normalizeText(raw);
    if (allowPrefixStrip) {
      // Strip leading label like "f(2) =", "g(x+2) =", "C(0) =", "m =", "slope ="
      var m = s.match(/^(?:[a-zA-Z]\s*\([^=]*\)|slope|m|ans|answer|[a-zA-Z])\s*=\s*(.+)$/);
      if (m) s = m[1].trim();
    }
    // Strip dollar signs and commas between digits (e.g. $1,620 -> 1620)
    s = s.replace(/\$/g, "").replace(/(\d),(\d{3})(?!\d)/g, "$1$2");
    return s.trim();
  }

  // Safe Tokenizer for algebraic expressions (no eval/Function)
  function tokenize(str) {
    var s = normalizeText(str).toLowerCase();
    var tokens = [];
    var i = 0;
    while (i < s.length) {
      var ch = s[i];
      if (ch === " ") { i++; continue; }
      if ((ch >= "0" && ch <= "9") || ch === ".") {
        var start = i;
        var hasDot = ch === ".";
        i++;
        while (i < s.length && ((s[i] >= "0" && s[i] <= "9") || (!hasDot && s[i] === "."))) {
          if (s[i] === ".") hasDot = true;
          i++;
        }
        var num = parseFloat(s.slice(start, i));
        if (isNaN(num)) throw new Error("Invalid number");
        tokens.push({ type: "num", val: num });
        continue;
      }
      if (ch >= "a" && ch <= "z") {
        var idStart = i;
        while (i < s.length && s[i] >= "a" && s[i] <= "z") i++;
        var word = s.slice(idStart, i);
        if (word === "sqrt" || word === "abs") {
          tokens.push({ type: "fn", val: word });
        } else if (word === "pi") {
          tokens.push({ type: "num", val: Math.PI });
        } else if (word === "inf" || word === "infinity") {
          tokens.push({ type: "num", val: Infinity });
        } else {
          for (var k = 0; k < word.length; k++) {
            tokens.push({ type: "var", val: word[k] });
          }
        }
        continue;
      }
      if ("+-*/^()|".indexOf(ch) !== -1) {
        tokens.push({ type: "op", val: ch });
        i++;
        continue;
      }
      throw new Error("Unexpected character: " + ch);
    }
    return tokens;
  }

  function parseExpression(str) {
    var tokens = tokenize(str);
    if (tokens.length === 0) throw new Error("Empty expression");
    var pos = 0;

    function peek() { return tokens[pos] || null; }
    function consume() { return tokens[pos++]; }

    function canStartImplicitMul(tok) {
      if (!tok) return false;
      return tok.type === "var" || tok.type === "fn" || (tok.type === "op" && tok.val === "(") || (tok.type === "num" && tok.val === Math.PI);
    }

    function parseAddSub() {
      var left = parseMulDiv();
      while (peek() && peek().type === "op" && (peek().val === "+" || peek().val === "-")) {
        var op = consume().val;
        var right = parseMulDiv();
        left = { type: "bin", op: op, left: left, right: right };
      }
      return left;
    }

    function parseMulDiv() {
      var left = parseUnary();
      while (peek()) {
        var t = peek();
        if (t.type === "op" && (t.val === "*" || t.val === "/")) {
          var op = consume().val;
          var right = parseUnary();
          left = { type: "bin", op: op, left: left, right: right };
        } else if (canStartImplicitMul(t)) {
          var rightImp = parsePow();
          left = { type: "bin", op: "*", left: left, right: rightImp };
        } else {
          break;
        }
      }
      return left;
    }

    function parseUnary() {
      var t = peek();
      if (t && t.type === "op" && t.val === "+") {
        consume();
        return parseUnary();
      }
      if (t && t.type === "op" && t.val === "-") {
        consume();
        return { type: "neg", expr: parseUnary() };
      }
      return parsePow();
    }

    function parsePow() {
      var base = parsePrimary();
      if (peek() && peek().type === "op" && peek().val === "^") {
        consume();
        var exp = parseUnary();
        return { type: "bin", op: "^", left: base, right: exp };
      }
      return base;
    }

    function parsePrimary() {
      var t = peek();
      if (!t) throw new Error("Unexpected end");
      if (t.type === "num") {
        consume();
        return { type: "num", val: t.val };
      }
      if (t.type === "var") {
        consume();
        return { type: "var", val: t.val };
      }
      if (t.type === "fn") {
        var fnName = consume().val;
        var arg;
        if (peek() && peek().type === "op" && peek().val === "(") {
          consume();
          arg = parseAddSub();
          if (!peek() || peek().val !== ")") throw new Error("Missing ')'");
          consume();
        } else {
          arg = parsePrimary();
        }
        return { type: "fn", fn: fnName, arg: arg };
      }
      if (t.type === "op" && t.val === "(") {
        consume();
        var inner = parseAddSub();
        if (!peek() || peek().val !== ")") throw new Error("Missing ')'");
        consume();
        return inner;
      }
      if (t.type === "op" && t.val === "|") {
        consume();
        var absInner = parseAddSub();
        if (!peek() || peek().val !== "|") throw new Error("Missing '|'");
        consume();
        return { type: "fn", fn: "abs", arg: absInner };
      }
      throw new Error("Unexpected token: " + t.val);
    }

    var ast = parseAddSub();
    if (pos < tokens.length) throw new Error("Trailing tokens");
    return ast;
  }

  function evalAST(node, env) {
    if (node.type === "num") return node.val;
    if (node.type === "var") {
      if (Object.prototype.hasOwnProperty.call(env, node.val)) return env[node.val];
      throw new Error("Unknown variable: " + node.val);
    }
    if (node.type === "neg") return -evalAST(node.expr, env);
    if (node.type === "fn") {
      var v = evalAST(node.arg, env);
      if (node.fn === "abs") return Math.abs(v);
      if (node.fn === "sqrt") return v < 0 ? NaN : Math.sqrt(v);
    }
    if (node.type === "bin") {
      var l = evalAST(node.left, env);
      var r = evalAST(node.right, env);
      if (node.op === "+") return l + r;
      if (node.op === "-") return l - r;
      if (node.op === "*") return l * r;
      if (node.op === "/") return r === 0 ? NaN : l / r;
      if (node.op === "^") return Math.pow(l, r);
    }
    return NaN;
  }

  function astVars(node, out) {
    out = out || {};
    if (!node) return out;
    if (node.type === "var") out[node.val] = true;
    else if (node.type === "neg") astVars(node.expr, out);
    else if (node.type === "fn") astVars(node.arg, out);
    else if (node.type === "bin") { astVars(node.left, out); astVars(node.right, out); }
    return out;
  }

  function isNoneToken(s) {
    var low = normalizeText(s).toLowerCase();
    return low === "none" || low === "no" || low === "dne" || low === "no solution" || low === "empty" || low === "{}" || low === "∅";
  }

  function parseNumericValue(raw, allowPrefixStrip) {
    var s = cleanValueInput(raw, allowPrefixStrip).toLowerCase();
    if (!s) return { ok: false };
    if (s === "undefined" || s === "undef" || s === "no slope") {
      return { ok: true, special: "undefined" };
    }
    if (isNoneToken(s)) {
      return { ok: true, special: "none" };
    }
    try {
      var ast = parseExpression(s);
      var vars = astVars(ast);
      if (Object.keys(vars).length > 0) return { ok: false };
      var val = evalAST(ast, {});
      if (isNaN(val)) return { ok: false };
      return { ok: true, val: val };
    } catch (e) {
      return { ok: false };
    }
  }

  // 1. Number / Fraction / Slope Grader
  function gradeNumber(raw, spec) {
    var parsed = parseNumericValue(raw, true);
    if (!parsed.ok) {
      return { ok: false, feedback: "Enter a number, fraction (like -3/5), or 'undefined' / 'none' if applicable." };
    }
    if (spec.special) {
      if (parsed.special === spec.special) return { ok: true };
      if (spec.special === "undefined" && parsed.val === 0) {
        return { ok: false, feedback: "Careful: horizontal lines have slope 0, while vertical lines have an undefined slope." };
      }
      return { ok: false, feedback: "Check whether this value is " + spec.special + "." };
    }
    if (parsed.special) {
      if (spec.value === 0 && parsed.special === "undefined") {
        return { ok: false, feedback: "Careful: division of 0 by a non-zero number is 0, not undefined." };
      }
      return { ok: false, feedback: "This value is a finite number—try evaluating it again." };
    }
    var tol = spec.tolerance || EPS;
    if (Math.abs(parsed.val - spec.value) < tol) {
      return { ok: true };
    }
    if (Math.abs(parsed.val + spec.value) < tol && spec.value !== 0) {
      return { ok: false, feedback: "Almost! Your magnitude is right, but check the sign (+ vs. −)." };
    }
    if (spec.isSlope && spec.value !== 0 && Math.abs(parsed.val - (1 / spec.value)) < tol) {
      return { ok: false, feedback: "Your fraction is flipped! Remember slope is rise over run (change in y divided by change in x)." };
    }
    return { ok: false, feedback: "Not quite—double-check your arithmetic or reveal a hint." };
  }

  // 2. Ordered Pair Grader: (x, y)
  function gradePoint(raw, spec) {
    var s = normalizeText(raw).toLowerCase();
    if (spec.special === "none" && isNoneToken(s)) {
      return { ok: true };
    }
    var m = s.match(/^\(?\s*([^,]+)\s*,\s*([^,]+)\s*\)?$/);
    if (!m) {
      return { ok: false, feedback: "Write your answer as an ordered pair like (3, -2)" + (spec.special === "none" ? " or 'none'." : ".") };
    }
    var px = parseNumericValue(m[1], false);
    var py = parseNumericValue(m[2], false);
    if (!px.ok || !py.ok || px.special || py.special) {
      return { ok: false, feedback: "Both coordinates should be numbers or fractions, like (3/2, 0)." };
    }
    if (Math.abs(px.val - spec.x) < EPS && Math.abs(py.val - spec.y) < EPS) {
      return { ok: true };
    }
    if (Math.abs(px.val - spec.y) < EPS && Math.abs(py.val - spec.x) < EPS && spec.x !== spec.y) {
      return { ok: false, feedback: "Your coordinates are swapped! Remember ordered pairs are written (x, y)." };
    }
    return { ok: false, feedback: "Check your x- and y-coordinates carefully." };
  }

  // 2b. Point List Grader: e.g. (-4, 0), (4, 0) or none
  function gradePointList(raw, spec) {
    var s = normalizeText(raw);
    if (!s) return { ok: false, feedback: "Enter ordered pairs like (-4, 0), (4, 0), or 'none'." };
    if (spec.points.length === 0) {
      if (isNoneToken(s)) return { ok: true };
      return { ok: false, feedback: "Look closely—does this graph cross that axis at all? (If not, enter 'none'.)" };
    }
    if (isNoneToken(s)) {
      return { ok: false, feedback: "This graph does have intercept(s)—check where it touches the axis." };
    }
    var matches = [];
    var re = /\(\s*([^,()]+)\s*,\s*([^,()]+)\s*\)/g;
    var m;
    while ((m = re.exec(s)) !== null) {
      var px = parseNumericValue(m[1], false);
      var py = parseNumericValue(m[2], false);
      if (!px.ok || !py.ok || px.special || py.special) {
        return { ok: false, feedback: "Could not parse one of your ordered pairs—use format (x, y)." };
      }
      matches.push({ x: px.val, y: py.val });
    }
    if (matches.length === 0) {
      return { ok: false, feedback: "Write intercepts as ordered pairs in parentheses, e.g. (-4, 0), (4, 0)." };
    }
    // Deduplicate student points
    var unique = [];
    matches.forEach(function (pt) {
      if (!unique.some(function (u) { return Math.abs(u.x - pt.x) < EPS && Math.abs(u.y - pt.y) < EPS; })) {
        unique.push(pt);
      }
    });
    if (unique.length !== spec.points.length) {
      return { ok: false, feedback: "Expected " + spec.points.length + " distinct ordered pair(s); you entered " + unique.length + "." };
    }
    var allFound = spec.points.every(function (exp) {
      return unique.some(function (u) { return Math.abs(u.x - exp.x) < EPS && Math.abs(u.y - exp.y) < EPS; });
    });
    if (allFound) return { ok: true };
    return { ok: false, feedback: "Check the coordinates of each intercept carefully." };
  }

  // 3. Equation Grader: line Ax + By = C
  function checkLineAST(lhsAst, rhsAst, A, B, C) {
    var onPts = [];
    if (Math.abs(B) > EPS) {
      var xs = [-4.3, -1.7, 0.25, 1.9, 3.4, 5.1];
      for (var i = 0; i < xs.length; i++) {
        onPts.push({ x: xs[i], y: (C - A * xs[i]) / B });
      }
    } else {
      var xConst = C / A;
      var ys = [-4.3, -1.7, 0.25, 1.9, 3.4, 5.1];
      for (var j = 0; j < ys.length; j++) {
        onPts.push({ x: xConst, y: ys[j] });
      }
    }
    for (var k = 0; k < onPts.length; k++) {
      var diff = evalAST(lhsAst, onPts[k]) - evalAST(rhsAst, onPts[k]);
      if (isNaN(diff) || Math.abs(diff) > 1e-3) return { onLine: false };
    }
    var offHits = 0;
    for (var m = 0; m < 3; m++) {
      var pt = { x: onPts[m].x + A * 0.7 + 0.13 * (m + 1), y: onPts[m].y + B * 0.7 };
      var offDiff = evalAST(lhsAst, pt) - evalAST(rhsAst, pt);
      if (!isNaN(offDiff) && Math.abs(offDiff) > 1e-3) offHits++;
    }
    return { onLine: offHits >= 2 };
  }

  function gradeEquation(raw, spec) {
    var s = normalizeText(raw).replace(/\$/g, "");
    var parts = s.split("=");
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
      return { ok: false, feedback: "Write a complete equation with an '=' sign, such as y = 2x - 3 or x = 4." };
    }
    var lhsAst, rhsAst;
    try {
      lhsAst = parseExpression(parts[0]);
      rhsAst = parseExpression(parts[1]);
    } catch (e) {
      return { ok: false, feedback: "Could not parse your equation. Check parentheses and operators." };
    }
    var vars = astVars(lhsAst, astVars(rhsAst));
    var allowed = spec.variables || ["x", "y"];
    for (var v in vars) {
      if (allowed.indexOf(v) === -1) {
        return { ok: false, feedback: "Unexpected variable '" + v + "'. Use " + allowed.join(" and ") + "." };
      }
    }
    var res;
    try {
      res = checkLineAST(lhsAst, rhsAst, spec.A, spec.B, spec.C);
    } catch (e2) {
      return { ok: false, feedback: "Could not evaluate your equation." };
    }
    if (!res.onLine) {
      if (spec.B !== 0) {
        try {
          var flipped = checkLineAST(lhsAst, rhsAst, -spec.A, spec.B, spec.C);
          if (flipped.onLine) {
            return { ok: false, feedback: "Your y-intercept looks right, but check the sign of your slope." };
          }
        } catch (e3) {}
      }
      return { ok: false, feedback: "That equation does not match the required line. Check your slope and intercept." };
    }
    if (spec.requireSlopeIntercept && Math.abs(spec.B) > EPS) {
      var lhsV = Object.keys(astVars(lhsAst));
      var rhsV = Object.keys(astVars(rhsAst));
      var lhsIsY = lhsAst.type === "var" && lhsAst.val === "y" && rhsV.indexOf("y") === -1;
      var rhsIsY = rhsAst.type === "var" && rhsAst.val === "y" && lhsV.indexOf("y") === -1;
      if (!lhsIsY && !rhsIsY) {
        return { ok: false, feedback: "Right line! Now solve for y so it is in slope-intercept form (y = mx + b)." };
      }
    }
    return { ok: true };
  }

  // 4. Algebraic Expression Grader (e.g. f(a), g(x+2), g(h^2))
  function gradeExpression(raw, spec) {
    var s = cleanValueInput(raw, true);
    if (!s) return { ok: false, feedback: "Enter an algebraic expression." };
    var studentAst, targetAst;
    try {
      studentAst = parseExpression(s);
      targetAst = parseExpression(spec.canonical);
    } catch (e) {
      return { ok: false, feedback: "Could not parse your expression. Check parentheses and exponents (use ^)." };
    }
    var vName = spec.variable || "x";
    var testVals = [-3.7, -1.4, -0.3, 0.6, 1.8, 2.9, 4.2, 5.5];
    for (var i = 0; i < testVals.length; i++) {
      var env = {};
      env[vName] = testVals[i];
      var sv, tv;
      try {
        sv = evalAST(studentAst, env);
        tv = evalAST(targetAst, env);
      } catch (e2) {
        return { ok: false, feedback: "Make sure you use the variable '" + vName + "' in your answer." };
      }
      if (isNaN(sv) || Math.abs(sv - tv) > 1e-4) {
        return { ok: false, feedback: "Not quite equivalent—check your distribution and combining like terms." };
      }
    }
    return { ok: true };
  }

  // 5. Linear Inequality Grader: Ax + By <op> C
  function gradeInequality(raw, spec) {
    var s = normalizeText(raw).replace(/\$/g, "").replace(/(\d),(\d{3})(?!\d)/g, "$1$2");
    var m = s.match(/^(.+?)(<=|>=|<|>)(.+)$/);
    if (!m) {
      return { ok: false, feedback: "Write an inequality using <, >, ≤, or ≥ (for example: y >= 2x - 4 or 11x + 16.5y >= 330)." };
    }
    var lhsStr = m[1].trim(), stOp = m[2], rhsStr = m[3].trim();
    var lhsAst, rhsAst;
    try {
      lhsAst = parseExpression(lhsStr);
      rhsAst = parseExpression(rhsStr);
    } catch (e) {
      return { ok: false, feedback: "Could not parse your inequality." };
    }
    var boundaryCheck;
    try {
      boundaryCheck = checkLineAST(lhsAst, rhsAst, spec.A, spec.B, spec.C);
    } catch (e2) {
      return { ok: false, feedback: "Use variables x and y in your inequality." };
    }
    if (!boundaryCheck.onLine) {
      return { ok: false, feedback: "Check your boundary equation / coefficients first." };
    }
    var x0, y0;
    if (Math.abs(spec.B) > EPS) { x0 = 0; y0 = spec.C / spec.B; }
    else { x0 = spec.C / spec.A; y0 = 0; }
    var dir = (spec.op === ">" || spec.op === ">=") ? 1 : -1;
    var truePt = { x: x0 + dir * spec.A, y: y0 + dir * spec.B };
    var falsePt = { x: x0 - dir * spec.A, y: y0 - dir * spec.B };

    function evalIneq(op, l, r) {
      if (op === "<") return l < r - EPS;
      if (op === "<=") return l <= r + EPS;
      if (op === ">") return l > r + EPS;
      if (op === ">=") return l >= r - EPS;
      return false;
    }

    var holdsTrue = evalIneq(stOp, evalAST(lhsAst, truePt), evalAST(rhsAst, truePt));
    var holdsFalse = evalIneq(stOp, evalAST(lhsAst, falsePt), evalAST(rhsAst, falsePt));

    if (!holdsTrue || holdsFalse) {
      return { ok: false, feedback: "Right boundary line, but the inequality points the wrong way! Remember to flip the sign when dividing by a negative, or check a test point." };
    }
    var expStrict = spec.op === "<" || spec.op === ">";
    var stStrict = stOp === "<" || stOp === ">";
    if (expStrict !== stStrict) {
      return { ok: false, feedback: "Right boundary and direction, but check inclusive (≤, ≥) vs. strict (<, >)!" };
    }
    return { ok: true };
  }

  // 6. Finite Set Grader: {a, b, c} or none
  function gradeSet(raw, spec) {
    var s = normalizeText(raw);
    if (!s) return { ok: false, feedback: "Enter values separated by commas (like {-2, 0, 4})" + (spec.values.length === 0 ? " or 'none'." : ".") };
    if (spec.values.length === 0) {
      if (isNoneToken(s)) return { ok: true };
      return { ok: false, feedback: "There are no solutions here—enter 'none'." };
    }
    if (isNoneToken(s)) {
      return { ok: false, feedback: "There is at least one value in this set—check carefully." };
    }
    s = s.replace(/^\{|\}$/g, "").trim();
    if (!s) return { ok: false, feedback: "The set cannot be empty." };
    var items = s.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
    var normStudent = [];
    var seen = {};
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var key;
      if (spec.isNumeric) {
        var pv = parseNumericValue(item, false);
        if (!pv.ok || pv.special) return { ok: false, feedback: "Every item in this set should be a number (or expression like -pi)." };
        key = String(Math.round(pv.val * 10000) / 10000);
      } else {
        key = item.toLowerCase();
      }
      if (!seen[key]) { seen[key] = true; normStudent.push(key); }
    }
    var normExp = [];
    var expSeen = {};
    for (var j = 0; j < spec.values.length; j++) {
      var ek = spec.isNumeric ? String(Math.round(spec.values[j] * 10000) / 10000) : String(spec.values[j]).toLowerCase();
      if (!expSeen[ek]) { expSeen[ek] = true; normExp.push(ek); }
    }
    normStudent.sort();
    normExp.sort();
    if (normStudent.length === normExp.length && normStudent.every(function (v, idx) { return v === normExp[idx]; })) {
      return { ok: true };
    }
    if (normStudent.length < normExp.length) {
      return { ok: false, feedback: "You're missing one or more values in the set. Remember to list each unique value." };
    }
    if (normStudent.length > normExp.length) {
      return { ok: false, feedback: "You have an extra value that does not belong in this set." };
    }
    return { ok: false, feedback: "Double-check the elements of your set (Domain = inputs/x-values, Range = outputs/y-values)." };
  }

  // 7. Interval Notation Grader: [-4, 4], (-∞, ∞), [0, ∞)
  function parseIntervalStr(raw) {
    var s = normalizeText(raw).toLowerCase();
    if (s === "all real numbers" || s === "r" || s === "real numbers") {
      return { ok: true, lBr: "(", rBr: ")", lo: -Infinity, hi: Infinity };
    }
    // Singleton set notation {c} (used by OpenStax for constant function ranges)
    var sm = s.match(/^\{\s*([^,{}]+)\s*\}$/);
    if (sm) {
      var sv = parseNumericValue(sm[1], false);
      if (sv.ok && !sv.special) {
        return { ok: true, lBr: "[", rBr: "]", lo: sv.val, hi: sv.val, isSingleton: true };
      }
      return { ok: false };
    }
    var m = s.match(/^([\(\[])\s*([^,]+)\s*,\s*([^,]+)\s*([\)\]])$/);
    if (!m) return { ok: false };
    var lBr = m[1], rBr = m[4];
    var loP = parseNumericValue(m[2], false);
    var hiP = parseNumericValue(m[3], false);
    if (!loP.ok || !hiP.ok || loP.special || hiP.special) return { ok: false };
    return { ok: true, lBr: lBr, rBr: rBr, lo: loP.val, hi: hiP.val };
  }

  function sameBound(a, b) {
    if (!isFinite(a) || !isFinite(b)) return a === b;
    return Math.abs(a - b) < EPS;
  }

  function gradeInterval(raw, spec) {
    var ex = parseIntervalStr(spec.canonical);
    var st = parseIntervalStr(raw);
    if (!st.ok) {
      if (ex.ok && sameBound(ex.lo, ex.hi)) {
        return { ok: false, feedback: "For a constant function's single output value, write a singleton set like {" + ex.lo + "} (or [" + ex.lo + ", " + ex.lo + "])." };
      }
      return { ok: false, feedback: "Use interval notation like (-∞, ∞), [-4, 4], or [0, ∞)." };
    }
    var boundsMatch = sameBound(st.lo, ex.lo) && sameBound(st.hi, ex.hi);
    var brMatch = st.lBr === ex.lBr && st.rBr === ex.rBr;
    if (boundsMatch && brMatch) return { ok: true };
    if (boundsMatch && !brMatch) {
      return { ok: false, feedback: "Your endpoints are right! Check brackets [ ] (included) vs. parentheses ( ) (excluded; ∞ always uses parentheses)." };
    }
    if (sameBound(st.lo, ex.hi) && sameBound(st.hi, ex.lo)) {
      return { ok: false, feedback: "Interval notation always goes from smallest to largest (left to right, or bottom to top)." };
    }
    if (sameBound(ex.lo, ex.hi)) {
      return { ok: false, feedback: "A constant function has only ONE output value — write it as {c} (or [c, c])." };
    }
    return { ok: false, feedback: "Check the minimum and maximum values carefully." };
  }

  // 8. Interactive Graph Graders
  function gradeGraphPoints(state, spec) {
    var pts = (state && state.points) || [];
    if (pts.length === 0) {
      return { ok: false, feedback: "Tap (or touch and drag to) grid intersections to plot the required points." };
    }
    if (pts.length !== spec.points.length) {
      return { ok: false, feedback: "Plot exactly " + spec.points.length + " points (currently plotted: " + pts.length + ")." };
    }
    var matched = 0;
    for (var i = 0; i < spec.points.length; i++) {
      var target = spec.points[i];
      var found = pts.some(function (p) { return Math.abs(p.x - target.x) < EPS && Math.abs(p.y - target.y) < EPS; });
      if (found) matched++;
    }
    if (matched === spec.points.length) return { ok: true };
    return { ok: false, feedback: matched + " of " + spec.points.length + " points are right. Tap a plotted point to remove it and adjust." };
  }

  function gradeGraphLine(state, spec) {
    var pts = (state && state.points) || [];
    if (pts.length < 2) {
      return { ok: false, feedback: "Tap 2 points on the grid to draw your line." };
    }
    var p1 = pts[0], p2 = pts[1];
    if (Math.abs(p1.x - p2.x) < EPS && Math.abs(p1.y - p2.y) < EPS) {
      return { ok: false, feedback: "Pick two distinct points to define the line." };
    }
    var e1 = Math.abs(spec.A * p1.x + spec.B * p1.y - spec.C);
    var e2 = Math.abs(spec.A * p2.x + spec.B * p2.y - spec.C);
    if (e1 < EPS && e2 < EPS) {
      if (spec.requirePoints && spec.requirePoints.length === 2) {
        var r0 = spec.requirePoints[0], r1 = spec.requirePoints[1];
        var matchA = Math.abs(p1.x - r0.x) < EPS && Math.abs(p1.y - r0.y) < EPS && Math.abs(p2.x - r1.x) < EPS && Math.abs(p2.y - r1.y) < EPS;
        var matchB = Math.abs(p1.x - r1.x) < EPS && Math.abs(p1.y - r1.y) < EPS && Math.abs(p2.x - r0.x) < EPS && Math.abs(p2.y - r0.y) < EPS;
        if (!matchA && !matchB) {
          return {
            ok: false,
            feedback: spec.requirePointsFeedback || "Right line! However, this exercise asks you to plot the actual x- and y-intercepts — clear and tap the two points where the line crosses the axes."
          };
        }
      }
      return { ok: true };
    }

    var stDx = p2.x - p1.x, stDy = p2.y - p1.y;
    var parallel = Math.abs(spec.A * stDx + spec.B * stDy) < EPS;
    if (parallel) {
      return { ok: false, feedback: "Your slope is right (parallel to the target), but it passes through the wrong intercept/point!" };
    }
    if (e1 < EPS || e2 < EPS) {
      return { ok: false, feedback: "One of your points is on the line, but the second point is off—re-check your rise over run." };
    }
    return { ok: false, feedback: "Your line doesn't match the equation yet. Tap 'Clear Graph' and try plotting two verified points." };
  }

  function gradeGraphInequality(state, spec) {
    var pts = (state && state.points) || [];
    if (pts.length < 2) {
      return { ok: false, feedback: "Step 1: Tap 2 points on the grid to plot the boundary line." };
    }
    var lineCheck = gradeGraphLine(state, spec);
    if (!lineCheck.ok) {
      return { ok: false, feedback: "Boundary line check: " + lineCheck.feedback };
    }
    var expStyle = (spec.op === "<" || spec.op === ">") ? "dashed" : "solid";
    if (state.lineStyle !== expStyle) {
      return {
        ok: false,
        feedback: "Your boundary line is in the right spot! Check whether it should be Solid (≤, ≥) or Dashed (<, >)."
      };
    }
    if (!state.shadePoint) {
      return { ok: false, feedback: "Step 3: Now tap the side of the line you want to shade." };
    }
    var val = spec.A * state.shadePoint.x + spec.B * state.shadePoint.y;
    var sideOk = (spec.op === ">" || spec.op === ">=") ? (val > spec.C + EPS) : (val < spec.C - EPS);
    if (!sideOk) {
      return { ok: false, feedback: "Your boundary line and solid/dashed style are right, but you shaded the wrong side! Test a point like (0, 0)." };
    }
    return { ok: true };
  }

  function gradeGraphTwoLines(state, spec) {
    var l1Pts = (state && state.line1) || [];
    var l2Pts = (state && state.line2) || [];
    var exp1 = spec.lines[0];
    var exp2 = spec.lines[1];

    if (l1Pts.length < 2 && l2Pts.length < 2) {
      return { ok: false, feedback: "Plot 2 points for Line 1 and 2 points for Line 2." };
    }
    if (l1Pts.length < 2) {
      return { ok: false, feedback: "Line 1 needs 2 points on the grid." };
    }
    if (l2Pts.length < 2) {
      return { ok: false, feedback: "Line 2 needs 2 points on the grid (tap the Line 2 button to plot it)." };
    }

    // Check direct assignment (Line 1 -> exp1, Line 2 -> exp2) AND swapped assignment
    var d1 = gradeGraphLine({ points: l1Pts }, exp1);
    var d2 = gradeGraphLine({ points: l2Pts }, exp2);
    if (d1.ok && d2.ok) return { ok: true };

    if (spec.unordered !== false) {
      var s1 = gradeGraphLine({ points: l1Pts }, exp2);
      var s2 = gradeGraphLine({ points: l2Pts }, exp1);
      if (s1.ok && s2.ok) return { ok: true };
    }

    var msgs = [];
    if (!d1.ok) msgs.push("<strong>" + (exp1.plainLabel || "Line 1") + ":</strong> " + d1.feedback);
    if (!d2.ok) msgs.push("<strong>" + (exp2.plainLabel || "Line 2") + ":</strong> " + d2.feedback);
    return { ok: false, feedback: msgs.join("<br>") };
  }

  function gradeField(raw, fieldSpec) {
    switch (fieldSpec.type) {
      case "number": return gradeNumber(raw, fieldSpec);
      case "point": return gradePoint(raw, fieldSpec);
      case "point_list": return gradePointList(raw, fieldSpec);
      case "equation": return gradeEquation(raw, fieldSpec);
      case "expression": return gradeExpression(raw, fieldSpec);
      case "inequality": return gradeInequality(raw, fieldSpec);
      case "set": return gradeSet(raw, fieldSpec);
      case "interval": return gradeInterval(raw, fieldSpec);
      default: return { ok: false, feedback: "Unsupported field type." };
    }
  }

  window.Grader = {
    normalizeText: normalizeText,
    parseExpression: parseExpression,
    evalAST: evalAST,
    gradeNumber: gradeNumber,
    gradePoint: gradePoint,
    gradePointList: gradePointList,
    gradeEquation: gradeEquation,
    gradeExpression: gradeExpression,
    gradeInequality: gradeInequality,
    gradeSet: gradeSet,
    gradeInterval: gradeInterval,
    gradeGraphPoints: gradeGraphPoints,
    gradeGraphLine: gradeGraphLine,
    gradeGraphInequality: gradeGraphInequality,
    gradeGraphTwoLines: gradeGraphTwoLines,
    gradeField: gradeField
  };
})();

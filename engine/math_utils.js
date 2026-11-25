(function () {
  "use strict";

  function gcd(a, b) {
    a = Math.abs(Math.round(a));
    b = Math.abs(Math.round(b));
    while (b !== 0) {
      var t = b;
      b = a % b;
      a = t;
    }
    return a || 1;
  }

  function simpFrac(n, d) {
    if (d === 0) return { n: 1, d: 0 };
    if (n === 0) return { n: 0, d: 1 };
    var sign = (n < 0) !== (d < 0) ? -1 : 1;
    var g = gcd(n, d);
    return { n: sign * Math.abs(n) / g, d: Math.abs(d) / g };
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randNonZero(min, max) {
    var v = 0;
    while (v === 0) v = randInt(min, max);
    return v;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function shuffle(arr) {
    var out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function htmlFrac(n, d) {
    var f = simpFrac(n, d);
    if (f.d === 1) return String(f.n);
    var sign = f.n < 0 ? "&minus;" : "";
    return sign + '<span class="m-frac"><span class="m-num">' + Math.abs(f.n) + '</span><span class="m-den">' + f.d + '</span></span>';
  }

  function plainFrac(n, d) {
    var f = simpFrac(n, d);
    if (f.d === 1) return String(f.n);
    return f.n + "/" + f.d;
  }

  function wrapMath(inner) {
    return '<span class="math">' + inner + '</span>';
  }

  function fmtSignedNum(val, isFirst) {
    if (val === 0) return "";
    if (isFirst) return val < 0 ? "&minus;" + Math.abs(val) : String(val);
    return val < 0 ? " &minus; " + Math.abs(val) : " + " + val;
  }

  // Format slope-intercept HTML: y = mx + b (or inequality op)
  function htmlSlopeInt(mNum, mDen, b, op, lhsVar, rhsVar) {
    op = op || "=";
    lhsVar = lhsVar || "<i>y</i>";
    rhsVar = rhsVar || "<i>x</i>";
    var opHtml = op === "<=" ? "&le;" : op === ">=" ? "&ge;" : op === "<" ? "&lt;" : op === ">" ? "&gt;" : "=";
    var f = simpFrac(mNum, mDen);
    var rhs = "";
    if (f.n === 0) {
      rhs = b < 0 ? "&minus;" + Math.abs(b) : String(b);
    } else {
      if (f.d === 1) {
        if (f.n === 1) rhs = rhsVar;
        else if (f.n === -1) rhs = "&minus;" + rhsVar;
        else rhs = (f.n < 0 ? "&minus;" + Math.abs(f.n) : String(f.n)) + rhsVar;
      } else {
        rhs = htmlFrac(f.n, f.d) + rhsVar;
      }
      if (b !== 0) {
        rhs += b > 0 ? " + " + b : " &minus; " + Math.abs(b);
      }
    }
    return wrapMath(lhsVar + " " + opHtml + " " + rhs);
  }

  function plainSlopeInt(mNum, mDen, b, op) {
    op = op || "=";
    var f = simpFrac(mNum, mDen);
    var rhs = "";
    if (f.n === 0) {
      rhs = String(b);
    } else {
      if (f.d === 1) {
        if (f.n === 1) rhs = "x";
        else if (f.n === -1) rhs = "-x";
        else rhs = f.n + "x";
      } else {
        rhs = f.n + "/" + f.d + "x";
      }
      if (b > 0) rhs += " + " + b;
      else if (b < 0) rhs += " - " + Math.abs(b);
    }
    return "y " + op + " " + rhs;
  }

  // Format standard form Ax + By = C (or inequality op)
  function htmlStdForm(A, B, C, op) {
    op = op || "=";
    var opHtml = op === "<=" ? "&le;" : op === ">=" ? "&ge;" : op === "<" ? "&lt;" : op === ">" ? "&gt;" : "=";
    var parts = "";
    if (A !== 0) {
      if (A === 1) parts += "<i>x</i>";
      else if (A === -1) parts += "&minus;<i>x</i>";
      else parts += (A < 0 ? "&minus;" + Math.abs(A) : String(A)) + "<i>x</i>";
    }
    if (B !== 0) {
      var absB = Math.abs(B);
      var bTerm = (absB === 1 ? "" : String(absB)) + "<i>y</i>";
      if (parts === "") {
        parts += (B < 0 ? "&minus;" : "") + bTerm;
      } else {
        parts += (B < 0 ? " &minus; " : " + ") + bTerm;
      }
    }
    var cStr = C < 0 ? "&minus;" + Math.abs(C) : String(C);
    return wrapMath(parts + " " + opHtml + " " + cStr);
  }

  function plainStdForm(A, B, C, op) {
    op = op || "=";
    var parts = "";
    if (A !== 0) {
      parts += (A === 1 ? "" : A === -1 ? "-" : A) + "x";
    }
    if (B !== 0) {
      var absB = Math.abs(B);
      var bTerm = (absB === 1 ? "" : absB) + "y";
      if (!parts) parts += (B < 0 ? "-" : "") + bTerm;
      else parts += (B < 0 ? " - " : " + ") + bTerm;
    }
    return parts + " " + op + " " + C;
  }

  function htmlPoint(x, y) {
    var xs = typeof x === "object" ? htmlFrac(x.n, x.d) : (x < 0 ? "&minus;" + Math.abs(x) : String(x));
    var ys = typeof y === "object" ? htmlFrac(y.n, y.d) : (y < 0 ? "&minus;" + Math.abs(y) : String(y));
    return wrapMath("(" + xs + ", " + ys + ")");
  }

  function plainPoint(x, y) {
    var xs = typeof x === "object" ? plainFrac(x.n, x.d) : String(x);
    var ys = typeof y === "object" ? plainFrac(y.n, y.d) : String(y);
    return "(" + xs + ", " + ys + ")";
  }

  function htmlPoly(terms) {
    // terms: [{coef, deg, v}]
    var out = "";
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      if (t.coef === 0) continue;
      var v = t.v || "x";
      var absC = Math.abs(t.coef);
      var sign = out === "" ? (t.coef < 0 ? "&minus;" : "") : (t.coef < 0 ? " &minus; " : " + ");
      var coefStr = (t.deg > 0 && absC === 1) ? "" : String(absC);
      var varStr = t.deg === 0 ? "" : (t.deg === 1 ? "<i>" + v + "</i>" : "<i>" + v + "</i><sup>" + t.deg + "</sup>");
      out += sign + coefStr + varStr;
    }
    return wrapMath(out || "0");
  }

  // Convert slope-intercept y = (mNum/mDen)x + b to integer A*x + B*y = C
  function slopeIntToABC(mNum, mDen, b) {
    var f = simpFrac(mNum, mDen);
    // mDen*y = mNum*x + mDen*b  =>  -mNum*x + mDen*y = mDen*b
    return { A: -f.n, B: f.d, C: f.d * b };
  }

  window.MathUtil = {
    gcd: gcd,
    simpFrac: simpFrac,
    randInt: randInt,
    randNonZero: randNonZero,
    pick: pick,
    shuffle: shuffle,
    htmlFrac: htmlFrac,
    plainFrac: plainFrac,
    wrapMath: wrapMath,
    fmtSignedNum: fmtSignedNum,
    htmlSlopeInt: htmlSlopeInt,
    plainSlopeInt: plainSlopeInt,
    htmlStdForm: htmlStdForm,
    plainStdForm: plainStdForm,
    htmlPoint: htmlPoint,
    plainPoint: plainPoint,
    htmlPoly: htmlPoly,
    slopeIntToABC: slopeIntToABC
  };
})();

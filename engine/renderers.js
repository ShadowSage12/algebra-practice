(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var markerUid = 0;

  function el(tag, attrs, parent) {
    var node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      for (var k in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, k)) {
          node.setAttribute(k, String(attrs[k]));
        }
      }
    }
    if (parent) parent.appendChild(node);
    return node;
  }

  function clipLineToBox(A, B, C, xMin, xMax, yMin, yMax) {
    var pts = [];
    var eps = 1e-7;
    function add(x, y) {
      if (x >= xMin - eps && x <= xMax + eps && y >= yMin - eps && y <= yMax + eps) {
        for (var i = 0; i < pts.length; i++) {
          if (Math.hypot(pts[i].x - x, pts[i].y - y) < 1e-4) return;
        }
        pts.push({ x: x, y: y });
      }
    }
    if (Math.abs(B) > eps) {
      add(xMin, (C - A * xMin) / B);
      add(xMax, (C - A * xMax) / B);
    }
    if (Math.abs(A) > eps) {
      add((C - B * yMin) / A, yMin);
      add((C - B * yMax) / A, yMax);
    }
    return pts.length >= 2 ? [pts[0], pts[1]] : null;
  }

  function clipHalfPlane(A, B, C, keepGreater, xMin, xMax, yMin, yMax) {
    var poly = [
      { x: xMin, y: yMin },
      { x: xMax, y: yMin },
      { x: xMax, y: yMax },
      { x: xMin, y: yMax }
    ];
    var sign = keepGreater ? 1 : -1;
    function f(p) { return sign * (A * p.x + B * p.y - C); }

    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var curr = poly[i];
      var next = poly[(i + 1) % poly.length];
      var fc = f(curr);
      var fn = f(next);
      var cIn = fc >= -1e-9;
      var nIn = fn >= -1e-9;
      if (cIn) out.push(curr);
      if (cIn !== nIn) {
        var t = fc / (fc - fn);
        out.push({ x: curr.x + t * (next.x - curr.x), y: curr.y + t * (next.y - curr.y) });
      }
    }
    return out;
  }

  function addArrowMarker(defs, id, color) {
    var m = el("marker", {
      id: id,
      viewBox: "0 0 10 10",
      refX: "8",
      refY: "5",
      markerWidth: "6",
      markerHeight: "6",
      orient: "auto-start-reverse"
    }, defs);
    el("path", { d: "M 0 1.2 L 9.5 5 L 0 8.8 z", fill: color }, m);
  }

  function renderCoordinatePlane(container, spec, interactiveState, onChange, solutionOverlay) {
    container.innerHTML = "";
    var xMin = spec.xMin !== undefined ? spec.xMin : -8;
    var xMax = spec.xMax !== undefined ? spec.xMax : 8;
    var yMin = spec.yMin !== undefined ? spec.yMin : -8;
    var yMax = spec.yMax !== undefined ? spec.yMax : 8;
    var gridStepX = spec.gridStepX || 1;
    var gridStepY = spec.gridStepY || 1;
    var labelStepX = spec.labelStepX || (xMax - xMin > 16 ? 5 : (xMax - xMin > 12 ? 2 : 1));
    var labelStepY = spec.labelStepY || (yMax - yMin > 16 ? 5 : (yMax - yMin > 12 ? 2 : 1));
    var snapStep = spec.snapStep || 1;

    var SIZE = 360;
    var PAD = 30;
    var PAD_L = Math.max(Math.abs(yMax), Math.abs(yMin)) >= 1000 ? 48 : (Math.max(Math.abs(yMax), Math.abs(yMin)) >= 100 ? 40 : 30);
    var PAD_R = 26;
    var PAD_T = 28;
    var PAD_B = 30;
    var W = SIZE - PAD_L - PAD_R;
    var H = SIZE - PAD_T - PAD_B;

    function toX(x) { return PAD_L + ((x - xMin) / (xMax - xMin)) * W; }
    function toY(y) { return PAD_T + ((yMax - y) / (yMax - yMin)) * H; }
    function fromX(sx) { return xMin + ((sx - PAD_L) / W) * (xMax - xMin); }
    function fromY(sy) { return yMax - ((sy - PAD_T) / H) * (yMax - yMin); }

    markerUid++;
    var uid = "g" + markerUid;

    var stage = document.createElement("div");
    stage.className = "visual-stage";
    container.appendChild(stage);

    var svg = el("svg", {
      viewBox: "0 0 " + SIZE + " " + SIZE,
      class: "svg-graph",
      role: "img",
      "aria-label": "Coordinate plane"
    }, stage);

    var coordBadge = document.createElement("div");
    coordBadge.className = "coord-badge";
    stage.appendChild(coordBadge);

    var defs = el("defs", {}, svg);
    addArrowMarker(defs, uid + "-axis", "var(--axis-line)");
    addArrowMarker(defs, uid + "-curve", "var(--curve-line)");
    addArrowMarker(defs, uid + "-ineq", "var(--ineq-line)");
    addArrowMarker(defs, uid + "-user", "var(--user-line)");
    addArrowMarker(defs, uid + "-user2", "var(--user-line-2)");
    addArrowMarker(defs, uid + "-sol", "var(--solution-line)");

    var clip = el("clipPath", { id: uid + "-clip" }, defs);
    el("rect", { x: PAD_L, y: PAD_T, width: W, height: H }, clip);

    // Background box
    el("rect", {
      x: PAD_L, y: PAD_T, width: W, height: H,
      fill: "var(--surface)", stroke: "var(--border)", "stroke-width": 1
    }, svg);

    // Grid lines
    var gridG = el("g", { stroke: "var(--grid-line)", "stroke-width": 1 }, svg);
    if (spec.piTicks) {
      var piStep = Math.PI / 2;
      for (var px = xMin; px <= xMax + 0.01; px += piStep) {
        var gx = toX(px);
        el("line", { x1: gx, y1: PAD_T, x2: gx, y2: PAD_T + H }, gridG);
      }
    } else {
      for (var gxVal = Math.ceil(xMin / gridStepX) * gridStepX; gxVal <= xMax + 1e-6; gxVal += gridStepX) {
        var sx = toX(gxVal);
        el("line", { x1: sx, y1: PAD_T, x2: sx, y2: PAD_T + H }, gridG);
      }
    }
    for (var gyVal = Math.ceil(yMin / gridStepY) * gridStepY; gyVal <= yMax + 1e-6; gyVal += gridStepY) {
      var sy = toY(gyVal);
      el("line", { x1: PAD_L, y1: sy, x2: PAD_L + W, y2: sy }, gridG);
    }

    // Shaded half-planes layer
    var shadeLayer = el("g", { "clip-path": "url(#" + uid + "-clip)" }, svg);
    if (spec.inequalities) {
      spec.inequalities.forEach(function (iq) {
        var keepGreater = (iq.op === ">" || iq.op === ">=");
        var poly = clipHalfPlane(iq.A, iq.B, iq.C, keepGreater, xMin, xMax, yMin, yMax);
        if (poly.length >= 3) {
          var ptsStr = poly.map(function (p) { return toX(p.x).toFixed(1) + "," + toY(p.y).toFixed(1); }).join(" ");
          el("polygon", { points: ptsStr, fill: iq.fill || "var(--ineq-fill)" }, shadeLayer);
        }
      });
    }

    // Green Solution Overlay Shading (for interactive inequalities)
    if (solutionOverlay && solutionOverlay.type === "graph_inequality") {
      var sIq = solutionOverlay.answer;
      var sKeep = (sIq.op === ">" || sIq.op === ">=");
      var sPoly = clipHalfPlane(sIq.A, sIq.B, sIq.C, sKeep, xMin, xMax, yMin, yMax);
      if (sPoly.length >= 3) {
        var sPtsStr = sPoly.map(function (p) { return toX(p.x).toFixed(1) + "," + toY(p.y).toFixed(1); }).join(" ");
        el("polygon", { points: sPtsStr, fill: "var(--solution-fill)" }, shadeLayer);
      }
    }

    // Interactive user shaded half-plane
    if (spec.interactive === "plot_inequality" && interactiveState && interactiveState.points.length === 2 && interactiveState.shadePoint) {
      var up1 = interactiveState.points[0];
      var up2 = interactiveState.points[1];
      var uA = up2.y - up1.y;
      var uB = up1.x - up2.x;
      var uC = uA * up1.x + uB * up1.y;
      var sp = interactiveState.shadePoint;
      var spVal = uA * sp.x + uB * sp.y - uC;
      if (Math.abs(spVal) > 1e-6) {
        var uPoly = clipHalfPlane(uA, uB, uC, spVal > 0, xMin, xMax, yMin, yMax);
        if (uPoly.length >= 3) {
          var uPtsStr = uPoly.map(function (p) { return toX(p.x).toFixed(1) + "," + toY(p.y).toFixed(1); }).join(" ");
          el("polygon", { points: uPtsStr, fill: "var(--user-fill)" }, shadeLayer);
        }
      }
    }

    // Axes
    var axisG = el("g", {}, svg);
    var zeroX = toX(0);
    var zeroY = toY(0);
    if (yMin <= 0 && yMax >= 0) {
      var xAxisStart = xMin < 0 ? PAD_L - 10 : PAD_L;
      var xAxisAttrs = {
        x1: xAxisStart, y1: zeroY, x2: PAD_L + W + 10, y2: zeroY,
        stroke: "var(--axis-line)", "stroke-width": 1.8,
        "marker-end": "url(#" + uid + "-axis)"
      };
      if (xMin < 0) xAxisAttrs["marker-start"] = "url(#" + uid + "-axis)";
      el("line", xAxisAttrs, axisG);
      var xLab = el("text", {
        x: PAD_L + W + 15, y: zeroY + 4, fill: "var(--axis-line)",
        "font-size": 13, "font-style": "italic", "font-weight": 700, "font-family": "Georgia, serif"
      }, axisG);
      xLab.textContent = spec.xAxisLabel || "x";
    }
    if (xMin <= 0 && xMax >= 0) {
      var yAxisStart = yMin < 0 ? PAD_T + H + 10 : PAD_T + H;
      var yAxisAttrs = {
        x1: zeroX, y1: yAxisStart, x2: zeroX, y2: PAD_T - 10,
        stroke: "var(--axis-line)", "stroke-width": 1.8,
        "marker-end": "url(#" + uid + "-axis)"
      };
      if (yMin < 0) yAxisAttrs["marker-start"] = "url(#" + uid + "-axis)";
      el("line", yAxisAttrs, axisG);
      var yLab = el("text", {
        x: zeroX - 4, y: PAD_T - 13, fill: "var(--axis-line)",
        "font-size": 13, "font-style": "italic", "font-weight": 700, "font-family": "Georgia, serif"
      }, axisG);
      yLab.textContent = spec.yAxisLabel || "y";
    }

    // Tick labels
    var tickG = el("g", {
      fill: "var(--text-muted)",
      "font-size": 10.5,
      "font-family": "-apple-system, sans-serif",
      "font-weight": 600
    }, svg);

    var labelYPos = (yMin < 0 && yMax > 0) ? Math.min(PAD_T + H - 4, zeroY + 13) : PAD_T + H + 14;
    if (spec.piTicks) {
      var piLabels = [
        { v: -2 * Math.PI, t: "-2π" },
        { v: -Math.PI, t: "-π" },
        { v: Math.PI, t: "π" },
        { v: 2 * Math.PI, t: "2π" }
      ];
      piLabels.forEach(function (pl) {
        if (pl.v >= xMin - 0.01 && pl.v <= xMax + 0.01) {
          var tx = el("text", { x: toX(pl.v), y: labelYPos, "text-anchor": "middle" }, tickG);
          tx.textContent = pl.t;
        }
      });
    } else {
      for (var lx = Math.ceil(xMin / labelStepX) * labelStepX; lx <= xMax + 1e-6; lx += labelStepX) {
        if (Math.abs(lx) < 1e-6) continue;
        var lxNode = el("text", { x: toX(lx), y: labelYPos, "text-anchor": "middle" }, tickG);
        lxNode.textContent = String(Math.round(lx * 10) / 10);
      }
    }
    var labelXPos = (xMin < 0 && xMax > 0) ? Math.max(PAD_L + 14, zeroX - 6) : PAD_L - 6;
    for (var ly = Math.ceil(yMin / labelStepY) * labelStepY; ly <= yMax + 1e-6; ly += labelStepY) {
      if (Math.abs(ly) < 1e-6) continue;
      var lyNode = el("text", { x: labelXPos, y: toY(ly) + 3.5, "text-anchor": "end" }, tickG);
      lyNode.textContent = String(Math.round(ly * 10) / 10);
    }
    if (xMin <= 0 && xMax >= 0 && yMin <= 0 && yMax >= 0) {
      var origNode = el("text", { x: zeroX - 5, y: zeroY + 12, "text-anchor": "end" }, tickG);
      origNode.textContent = "0";
    }

    var plotLayer = el("g", { "clip-path": "url(#" + uid + "-clip)" }, svg);

    // Static lines
    if (spec.lines) {
      spec.lines.forEach(function (ln) {
        var seg = clipLineToBox(ln.A, ln.B, ln.C, xMin, xMax, yMin, yMax);
        if (!seg) return;
        var lineAttrs = {
          x1: toX(seg[0].x), y1: toY(seg[0].y),
          x2: toX(seg[1].x), y2: toY(seg[1].y),
          stroke: ln.color || "var(--curve-line)",
          "stroke-width": 2.8,
          "marker-start": "url(#" + uid + "-curve)",
          "marker-end": "url(#" + uid + "-curve)"
        };
        if (ln.dashed) lineAttrs["stroke-dasharray"] = "7,5";
        el("line", lineAttrs, plotLayer);
      });
    }

    // Static inequality boundary lines
    if (spec.inequalities) {
      spec.inequalities.forEach(function (iq) {
        var seg = clipLineToBox(iq.A, iq.B, iq.C, xMin, xMax, yMin, yMax);
        if (!seg) return;
        var isDashed = iq.op === "<" || iq.op === ">";
        var attrs = {
          x1: toX(seg[0].x), y1: toY(seg[0].y),
          x2: toX(seg[1].x), y2: toY(seg[1].y),
          stroke: iq.color || "var(--ineq-line)",
          "stroke-width": 2.8,
          "marker-start": "url(#" + uid + "-ineq)",
          "marker-end": "url(#" + uid + "-ineq)"
        };
        if (isDashed) attrs["stroke-dasharray"] = "7,5";
        el("line", attrs, plotLayer);
      });
    }

    // Static curves
    if (spec.curves) {
      spec.curves.forEach(function (c) {
        var dParts = [];
        var samples = c.samples || 240;
        var penDown = false;
        if (c.kind === "fn") {
          var dMin = c.domain ? c.domain[0] : xMin;
          var dMax = c.domain ? c.domain[1] : xMax;
          for (var i = 0; i <= samples; i++) {
            var xv = dMin + (i / samples) * (dMax - dMin);
            var yv = c.fn(xv);
            if (!isFinite(yv) || yv < yMin - 20 || yv > yMax + 20) {
              penDown = false;
              continue;
            }
            dParts.push((penDown ? "L " : "M ") + toX(xv).toFixed(2) + " " + toY(yv).toFixed(2));
            penDown = true;
          }
        } else if (c.kind === "parametric") {
          for (var j = 0; j <= samples; j++) {
            var tv = c.tMin + (j / samples) * (c.tMax - c.tMin);
            var pxv = c.fx(tv);
            var pyv = c.fy(tv);
            if (!isFinite(pxv) || !isFinite(pyv) || pxv < xMin - 20 || pxv > xMax + 20 || pyv < yMin - 20 || pyv > yMax + 20) {
              penDown = false;
              continue;
            }
            dParts.push((penDown ? "L " : "M ") + toX(pxv).toFixed(2) + " " + toY(pyv).toFixed(2));
            penDown = true;
          }
        }
        if (dParts.length > 1) {
          var pAttrs = {
            d: dParts.join(" "),
            fill: "none",
            stroke: c.color || "var(--curve-line)",
            "stroke-width": 2.8,
            "stroke-linecap": "round",
            "stroke-linejoin": "round"
          };
          if (c.arrowStart) pAttrs["marker-start"] = "url(#" + uid + "-curve)";
          if (c.arrowEnd) pAttrs["marker-end"] = "url(#" + uid + "-curve)";
          el("path", pAttrs, plotLayer);
        }
      });
    }

    // Green Solution Overlay Lines / Points
    if (solutionOverlay) {
      if (solutionOverlay.type === "graph_line" || solutionOverlay.type === "graph_inequality") {
        var sa = solutionOverlay.answer;
        var solSeg = clipLineToBox(sa.A, sa.B, sa.C, xMin, xMax, yMin, yMax);
        if (solSeg) {
          var solAttrs = {
            x1: toX(solSeg[0].x), y1: toY(solSeg[0].y),
            x2: toX(solSeg[1].x), y2: toY(solSeg[1].y),
            stroke: "var(--solution-line)",
            "stroke-width": 3.4,
            opacity: 0.9,
            "marker-start": "url(#" + uid + "-sol)",
            "marker-end": "url(#" + uid + "-sol)"
          };
          if (solutionOverlay.type === "graph_inequality" && (sa.op === "<" || sa.op === ">")) {
            solAttrs["stroke-dasharray"] = "8,5";
          }
          el("line", solAttrs, plotLayer);
        }
        if (solutionOverlay.type === "graph_line" && sa.requirePoints) {
          sa.requirePoints.forEach(function (pt) {
            el("circle", {
              cx: toX(pt.x), cy: toY(pt.y), r: 8.5,
              fill: "none", stroke: "var(--solution-line)", "stroke-width": 2.6
            }, svg);
          });
        }
      } else if (solutionOverlay.type === "graph_two_lines") {
        (solutionOverlay.answer.lines || []).forEach(function (ln) {
          var tSeg = clipLineToBox(ln.A, ln.B, ln.C, xMin, xMax, yMin, yMax);
          if (!tSeg) return;
          el("line", {
            x1: toX(tSeg[0].x), y1: toY(tSeg[0].y),
            x2: toX(tSeg[1].x), y2: toY(tSeg[1].y),
            stroke: "var(--solution-line)",
            "stroke-width": 3.4,
            opacity: 0.9,
            "marker-start": "url(#" + uid + "-sol)",
            "marker-end": "url(#" + uid + "-sol)"
          }, plotLayer);
        });
      } else if (solutionOverlay.type === "graph_points") {
        (solutionOverlay.answer.points || []).forEach(function (pt) {
          el("circle", {
            cx: toX(pt.x), cy: toY(pt.y), r: 8.5,
            fill: "none", stroke: "var(--solution-line)", "stroke-width": 2.8
          }, svg);
          var sl = el("text", {
            x: toX(pt.x) + 10, y: toY(pt.y) - 7,
            fill: "var(--solution-line)", "font-size": 11.5, "font-weight": 700
          }, svg);
          sl.textContent = "(" + pt.x + "," + pt.y + ")";
        });
      }
    }

    // Static highlighted points
    if (spec.points) {
      spec.points.forEach(function (pt) {
        el("circle", {
          cx: toX(pt.x), cy: toY(pt.y), r: 5.5,
          fill: pt.color || "var(--point-fill)",
          stroke: "var(--surface)", "stroke-width": 1.6
        }, svg);
        if (pt.label) {
          var lb = el("text", {
            x: toX(pt.x) + 8, y: toY(pt.y) - 6,
            fill: "var(--text)", "font-size": 12, "font-weight": 700
          }, svg);
          lb.textContent = pt.label;
        }
      });
    }

    // Interactive user line + points
    if (spec.interactive && interactiveState) {
      if (spec.interactive === "plot_two_lines") {
        var sets = [
          { pts: interactiveState.line1 || [], col: "var(--user-line)", mId: uid + "-user" },
          { pts: interactiveState.line2 || [], col: "var(--user-line-2)", mId: uid + "-user2" }
        ];
        sets.forEach(function (st) {
          if (st.pts.length === 2) {
            var q1 = st.pts[0], q2 = st.pts[1];
            var a2 = q2.y - q1.y, b2 = q1.x - q2.x, c2 = a2 * q1.x + b2 * q1.y;
            var seg2 = clipLineToBox(a2, b2, c2, xMin, xMax, yMin, yMax);
            if (seg2) {
              el("line", {
                x1: toX(seg2[0].x), y1: toY(seg2[0].y),
                x2: toX(seg2[1].x), y2: toY(seg2[1].y),
                stroke: st.col, "stroke-width": 2.8,
                "marker-start": "url(#" + st.mId + ")",
                "marker-end": "url(#" + st.mId + ")"
              }, plotLayer);
            }
          }
          st.pts.forEach(function (p) {
            el("circle", {
              cx: toX(p.x), cy: toY(p.y), r: 6.5,
              fill: st.col, stroke: "#ffffff", "stroke-width": 2
            }, svg);
          });
        });
      }
      var uPts = interactiveState.points || [];
      if ((spec.interactive === "plot_line" || spec.interactive === "plot_inequality") && uPts.length === 2) {
        var p1 = uPts[0], p2 = uPts[1];
        var A = p2.y - p1.y;
        var B = p1.x - p2.x;
        var C = A * p1.x + B * p1.y;
        var uSeg = clipLineToBox(A, B, C, xMin, xMax, yMin, yMax);
        if (uSeg) {
          var uAttrs = {
            x1: toX(uSeg[0].x), y1: toY(uSeg[0].y),
            x2: toX(uSeg[1].x), y2: toY(uSeg[1].y),
            stroke: "var(--user-line)",
            "stroke-width": 2.8,
            "marker-start": "url(#" + uid + "-user)",
            "marker-end": "url(#" + uid + "-user)"
          };
          if (spec.interactive === "plot_inequality" && interactiveState.lineStyle === "dashed") {
            uAttrs["stroke-dasharray"] = "7,5";
          }
          el("line", uAttrs, plotLayer);
        }
      }
      uPts.forEach(function (p) {
        el("circle", {
          cx: toX(p.x), cy: toY(p.y), r: 6.5,
          fill: "var(--user-line)", stroke: "#ffffff", "stroke-width": 2
        }, svg);
      });
    }

    // Live aim preview ring for touch-drag & hover
    var previewDot = null;
    if (spec.interactive && onChange) {
      previewDot = el("circle", {
        cx: 0, cy: 0, r: 9,
        fill: "rgba(37, 99, 235, 0.22)",
        stroke: "var(--user-line)",
        "stroke-width": 2,
        style: "display:none; pointer-events:none;"
      }, svg);

      svg.style.cursor = "crosshair";
      var isAiming = false;
      var aimCoords = null;

      function getCoords(ev) {
        var pt = svg.createSVGPoint();
        pt.x = ev.clientX;
        pt.y = ev.clientY;
        var ctm = svg.getScreenCTM();
        if (!ctm) return null;
        var local = pt.matrixTransform(ctm.inverse());
        if (local.x < PAD_L - 12 || local.x > PAD_L + W + 12 || local.y < PAD_T - 12 || local.y > PAD_T + H + 12) return null;
        var rawX = fromX(local.x);
        var rawY = fromY(local.y);
        var snapX = Math.max(xMin, Math.min(xMax, Math.round(rawX / snapStep) * snapStep));
        var snapY = Math.max(yMin, Math.min(yMax, Math.round(rawY / snapStep) * snapStep));
        return { rawX: rawX, rawY: rawY, snapX: snapX, snapY: snapY };
      }

      function showPreview(c) {
        if (!c) {
          previewDot.style.display = "none";
          coordBadge.classList.remove("visible");
          return;
        }
        var shadingMode = spec.interactive === "plot_inequality" && (interactiveState.points || []).length === 2;
        if (shadingMode) {
          previewDot.style.display = "none";
          coordBadge.textContent = "Shade (" + c.snapX + ", " + c.snapY + ")";
        } else {
          previewDot.setAttribute("cx", String(toX(c.snapX)));
          previewDot.setAttribute("cy", String(toY(c.snapY)));
          previewDot.style.display = "block";
          coordBadge.textContent = "(" + c.snapX + ", " + c.snapY + ")";
        }
        coordBadge.classList.add("visible");
      }

      function commitPoint(c) {
        var nextState = {
          points: (interactiveState.points || []).slice(),
          lineStyle: interactiveState.lineStyle || "solid",
          shadePoint: interactiveState.shadePoint || null,
          line1: (interactiveState.line1 || []).slice(),
          line2: (interactiveState.line2 || []).slice(),
          activeLine: interactiveState.activeLine || 1
        };
        var existingIdx = -1;
        for (var k = 0; k < nextState.points.length; k++) {
          if (nextState.points[k].x === c.snapX && nextState.points[k].y === c.snapY) {
            existingIdx = k;
            break;
          }
        }
        if (spec.interactive === "plot_points") {
          if (existingIdx !== -1) nextState.points.splice(existingIdx, 1);
          else nextState.points.push({ x: c.snapX, y: c.snapY });
        } else if (spec.interactive === "plot_line") {
          if (existingIdx !== -1) nextState.points.splice(existingIdx, 1);
          else if (nextState.points.length < 2) nextState.points.push({ x: c.snapX, y: c.snapY });
          else nextState.points[1] = { x: c.snapX, y: c.snapY };
        } else if (spec.interactive === "plot_inequality") {
          if (existingIdx !== -1 && Math.hypot(c.rawX - c.snapX, c.rawY - c.snapY) < 0.7) {
            nextState.points.splice(existingIdx, 1);
            nextState.shadePoint = null;
          } else if (nextState.points.length < 2) {
            nextState.points.push({ x: c.snapX, y: c.snapY });
          } else {
            nextState.shadePoint = { x: c.rawX, y: c.rawY };
          }
        } else if (spec.interactive === "plot_two_lines") {
          var keyName = nextState.activeLine === 2 ? "line2" : "line1";
          var arr = nextState[keyName];
          var idx2 = -1;
          for (var j2 = 0; j2 < arr.length; j2++) {
            if (arr[j2].x === c.snapX && arr[j2].y === c.snapY) { idx2 = j2; break; }
          }
          if (idx2 !== -1) {
            arr.splice(idx2, 1);
          } else if (arr.length < 2) {
            arr.push({ x: c.snapX, y: c.snapY });
            // Auto-switch from Line 1 to Line 2 once Line 1 is complete
            if (keyName === "line1" && arr.length === 2 && nextState.line2.length < 2) {
              nextState.activeLine = 2;
            }
          } else {
            arr[1] = { x: c.snapX, y: c.snapY };
          }
        }
        onChange(nextState);
      }

      svg.addEventListener("pointerdown", function (ev) {
        ev.preventDefault();
        var c = getCoords(ev);
        if (!c) return;
        isAiming = true;
        aimCoords = c;
        if (svg.setPointerCapture) {
          try { svg.setPointerCapture(ev.pointerId); } catch (e) {}
        }
        showPreview(c);
      });

      svg.addEventListener("pointermove", function (ev) {
        var c = getCoords(ev);
        if (isAiming) {
          ev.preventDefault();
          if (c) aimCoords = c;
          showPreview(c);
        } else if (ev.pointerType === "mouse") {
          showPreview(c);
        }
      });

      svg.addEventListener("pointerup", function (ev) {
        if (!isAiming) return;
        ev.preventDefault();
        isAiming = false;
        var c = getCoords(ev) || aimCoords;
        showPreview(null);
        if (c) commitPoint(c);
      });

      svg.addEventListener("pointercancel", function () {
        isAiming = false;
        showPreview(null);
      });

      svg.addEventListener("pointerleave", function (ev) {
        if (!isAiming && ev.pointerType === "mouse") showPreview(null);
      });

      // Controls bar under interactive graph
      var controls = document.createElement("div");
      controls.className = "graph-controls";

      if (spec.interactive === "plot_two_lines") {
        var seg2 = document.createElement("div");
        seg2.className = "seg-group";
        var labels = spec.lineLabels || ["Line 1", "Line 2"];
        [1, 2].forEach(function (num) {
          var b2 = document.createElement("button");
          b2.type = "button";
          b2.className = "seg-btn" + ((interactiveState.activeLine || 1) === num ? " active" : "");
          var dotCol = num === 1 ? "var(--user-line)" : "var(--user-line-2)";
          b2.innerHTML = '<span class="legend-dot" style="background:' + dotCol + '"></span>' + labels[num - 1];
          b2.addEventListener("click", function () {
            onChange({
              points: [],
              lineStyle: interactiveState.lineStyle || "solid",
              shadePoint: null,
              line1: (interactiveState.line1 || []).slice(),
              line2: (interactiveState.line2 || []).slice(),
              activeLine: num
            });
          });
          seg2.appendChild(b2);
        });
        controls.appendChild(seg2);
      }

      if (spec.interactive === "plot_inequality") {
        var seg = document.createElement("div");
        seg.className = "seg-group";
        ["solid", "dashed"].forEach(function (styleName) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "seg-btn" + (interactiveState.lineStyle === styleName ? " active" : "");
          b.textContent = styleName === "solid" ? "Solid (≤, ≥)" : "Dashed (<, >)";
          b.addEventListener("click", function () {
            onChange({
              points: (interactiveState.points || []).slice(),
              lineStyle: styleName,
              shadePoint: interactiveState.shadePoint
            });
          });
          seg.appendChild(b);
        });
        controls.appendChild(seg);
      }

      var clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "btn btn-sm";
      clearBtn.textContent = "Clear Graph";
      clearBtn.addEventListener("click", function () {
        onChange({ points: [], lineStyle: interactiveState.lineStyle || "solid", shadePoint: null, line1: [], line2: [], activeLine: 1 });
      });
      controls.appendChild(clearBtn);
      container.appendChild(controls);

      if (solutionOverlay) {
        var leg = document.createElement("div");
        leg.className = "solution-legend";
        leg.innerHTML = '<span><span class="legend-dot" style="background:var(--user-line)"></span>Your graph</span>' +
          '<span><span class="legend-dot" style="background:var(--solution-line)"></span>Correct answer</span>';
        container.appendChild(leg);
      }

      // Live status line
      var help = document.createElement("div");
      help.className = "graph-help";
      var pts = interactiveState.points || [];
      if (spec.interactive === "plot_points") {
        help.textContent = pts.length
          ? "Plotted: " + pts.map(function (p) { return "(" + p.x + ", " + p.y + ")"; }).join(", ") + " (touch & drag to aim, tap point to remove)"
          : "Tap (or touch & drag to aim) grid intersections to plot points.";
      } else if (spec.interactive === "plot_line") {
        if (pts.length === 0) help.textContent = "Touch & drag (or tap) 2 points on the grid to draw your line.";
        else if (pts.length === 1) help.textContent = "First point: (" + pts[0].x + ", " + pts[0].y + "). Place a 2nd point.";
        else help.textContent = "Line through (" + pts[0].x + ", " + pts[0].y + ") and (" + pts[1].x + ", " + pts[1].y + "). Tap a point to remove it.";
      } else if (spec.interactive === "plot_inequality") {
        if (pts.length < 2) help.textContent = "Step 1: Place 2 points for the boundary line (" + pts.length + "/2). Touch & drag to aim.";
        else if (!interactiveState.shadePoint) help.textContent = "Step 2: Choose Solid/Dashed, then tap either side of the line to shade.";
        else help.textContent = "Boundary plotted & region shaded. Tap the other side to flip shading, or Clear Graph.";
      } else if (spec.interactive === "plot_two_lines") {
        var l1 = interactiveState.line1 || [], l2 = interactiveState.line2 || [];
        var active = interactiveState.activeLine || 1;
        help.textContent = "Currently plotting Line " + active + " · Line 1: " + l1.length + "/2 pts, Line 2: " + l2.length + "/2 pts.";
      }
      container.appendChild(help);
    }
  }

  function renderMappingDiagram(container, spec) {
    container.innerHTML = "";
    var leftItems = spec.left || [];
    var rightItems = spec.right || [];
    var arrows = spec.arrows || [];
    var maxRows = Math.max(leftItems.length, rightItems.length);
    var rowH = 34;
    var topPad = 48;
    var H = Math.max(200, topPad + maxRows * rowH + 22);
    var W = 340;

    markerUid++;
    var uid = "map" + markerUid;

    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H,
      class: "svg-graph",
      role: "img",
      "aria-label": "Mapping diagram"
    }, container);

    var defs = el("defs", {}, svg);
    addArrowMarker(defs, uid + "-arr", "var(--ineq-line)");

    var boxW = 114;
    var leftX = 16;
    var rightX = W - 16 - boxW;
    var boxY = 14;
    var boxH = H - 28;

    el("rect", {
      x: leftX, y: boxY, width: boxW, height: boxH, rx: 10,
      fill: "var(--surface)", stroke: "var(--axis-line)", "stroke-width": 1.6
    }, svg);
    el("rect", {
      x: rightX, y: boxY, width: boxW, height: boxH, rx: 10,
      fill: "var(--surface)", stroke: "var(--axis-line)", "stroke-width": 1.6
    }, svg);

    var lt = el("text", {
      x: leftX + boxW / 2, y: boxY + 22, "text-anchor": "middle",
      fill: "var(--text)", "font-size": 13, "font-weight": 700
    }, svg);
    lt.textContent = spec.leftTitle || "Domain";

    var rt = el("text", {
      x: rightX + boxW / 2, y: boxY + 22, "text-anchor": "middle",
      fill: "var(--text)", "font-size": 13, "font-weight": 700
    }, svg);
    rt.textContent = spec.rightTitle || "Range";

    function itemY(idx, count) {
      var usable = boxH - 42;
      var step = usable / (count + 1);
      return boxY + 34 + step * (idx + 1);
    }

    leftItems.forEach(function (label, idx) {
      var t = el("text", {
        x: leftX + boxW / 2, y: itemY(idx, leftItems.length) + 4,
        "text-anchor": "middle", fill: "var(--text)", "font-size": 13, "font-weight": 600
      }, svg);
      t.textContent = String(label);
    });

    rightItems.forEach(function (label, idx) {
      var t = el("text", {
        x: rightX + boxW / 2, y: itemY(idx, rightItems.length) + 4,
        "text-anchor": "middle", fill: "var(--text)", "font-size": 13, "font-weight": 600
      }, svg);
      t.textContent = String(label);
    });

    arrows.forEach(function (a) {
      var y1 = itemY(a.from, leftItems.length);
      var y2 = itemY(a.to, rightItems.length);
      el("line", {
        x1: leftX + boxW - 14, y1: y1,
        x2: rightX + 14, y2: y2,
        stroke: "var(--ineq-line)", "stroke-width": 2,
        "marker-end": "url(#" + uid + "-arr)"
      }, svg);
    });
  }

  window.Renderers = {
    renderCoordinatePlane: renderCoordinatePlane,
    renderMappingDiagram: renderMappingDiagram
  };
})();

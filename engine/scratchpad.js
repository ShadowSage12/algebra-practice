(function () {
  "use strict";

  var PREFS_KEY = "openstax_scratchpad_prefs_v1";

  var prefs = {
    open: false,
    pencilOnly: false,
    autoClear: true,
    paper: "grid",       // "grid" | "dot" | "ruled" | "blank"
    layout: "split",     // "split" | "stack" (on wide iPad landscape)
    heightMode: "normal",// "normal" | "tall"
    color: "auto",       // "auto" | "#2563eb" | "#dc2626" | "#16a34a"
    size: 2.6
  };

  var tool = "pen"; // "pen" | "eraser"
  var strokes = []; // [{ tool, color, size, points: [{x, y, p}] }]
  var redoStack = [];
  var activeStroke = null;
  var activePointerId = null;
  var canvas = null;
  var ctx = null;
  var dpr = 1;
  var logicalW = 0;
  var logicalH = 0;
  var pencilAutoNotified = false;

  function loadPrefs() {
    try {
      var raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      for (var k in saved) {
        if (Object.prototype.hasOwnProperty.call(prefs, k)) {
          prefs[k] = saved[k];
        }
      }
    } catch (e) {}
  }

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (e) {}
  }

  function getAutoInkColor() {
    var theme = document.documentElement.getAttribute("data-theme");
    return theme === "dark" ? "#f1f5f9" : "#1b2432";
  }

  function resolveStrokeColor(colorKey) {
    if (colorKey === "auto") return getAutoInkColor();
    return colorKey;
  }

  function setStatus(msg) {
    var el = document.getElementById("spStatus");
    if (el) el.textContent = msg;
  }

  function updateDefaultStatus() {
    if (prefs.pencilOnly) {
      setStatus("Pencil Only active — rest your palm or scroll freely with fingers.");
    } else {
      setStatus("Draw with Apple Pencil, finger, or mouse (auto-locks palm rejection when Pencil touches).");
    }
  }

  function resizeCanvas() {
    if (!canvas) return;
    var wrap = document.getElementById("spCanvasWrap");
    if (!wrap) return;
    var rect = wrap.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;

    dpr = Math.min(window.devicePixelRatio || 1, 3);
    logicalW = Math.round(rect.width);
    logicalH = Math.round(rect.height);

    canvas.width = Math.round(logicalW * dpr);
    canvas.height = Math.round(logicalH * dpr);
    canvas.style.width = logicalW + "px";
    canvas.style.height = logicalH + "px";

    ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }

  function drawStroke(st) {
    if (!ctx || !st || !st.points || st.points.length === 0) return;
    var pts = st.points;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (st.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.fillStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      var col = resolveStrokeColor(st.color);
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
    }

    var baseW = st.tool === "eraser" ? Math.max(16, st.size * 5.5) : st.size;

    if (pts.length === 1) {
      var r = Math.max(1, (baseW * (pts[0].p || 1)) / 2);
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Smooth quadratic Bezier segments with gentle pressure modulation
    for (var i = 1; i < pts.length; i++) {
      var p0 = pts[i - 1];
      var p1 = pts[i];
      var midX = (p0.x + p1.x) * 0.5;
      var midY = (p0.y + p1.y) * 0.5;

      var prevMidX = i === 1 ? p0.x : (pts[i - 2].x + p0.x) * 0.5;
      var prevMidY = i === 1 ? p0.y : (pts[i - 2].y + p0.y) * 0.5;

      var pressure = ((p0.p || 1) + (p1.p || 1)) * 0.5;
      ctx.lineWidth = Math.max(0.8, baseW * pressure);
      ctx.beginPath();
      ctx.moveTo(prevMidX, prevMidY);
      ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
      ctx.stroke();
    }

    // Final tip segment
    var last = pts[pts.length - 1];
    var prev = pts[pts.length - 2];
    ctx.lineWidth = Math.max(0.8, baseW * (last.p || 1));
    ctx.beginPath();
    ctx.moveTo((prev.x + last.x) * 0.5, (prev.y + last.y) * 0.5);
    ctx.lineTo(last.x, last.y);
    ctx.stroke();

    ctx.restore();
  }

  function redraw() {
    if (!ctx || !canvas) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    for (var i = 0; i < strokes.length; i++) {
      drawStroke(strokes[i]);
    }
    if (activeStroke) {
      drawStroke(activeStroke);
    }
    updateUndoRedoButtons();
  }

  function updateUndoRedoButtons() {
    var undoBtn = document.getElementById("spUndoBtn");
    var redoBtn = document.getElementById("spRedoBtn");
    if (undoBtn) undoBtn.disabled = strokes.length === 0 && !lastClearedBackup;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
  }

  var lastClearedBackup = null;

  function clearCanvas(saveUndoBackup) {
    if (strokes.length === 0) return;
    if (saveUndoBackup !== false) {
      lastClearedBackup = strokes.slice();
    } else {
      lastClearedBackup = null;
    }
    strokes = [];
    redoStack = [];
    redraw();
  }

  function undo() {
    if (strokes.length > 0) {
      redoStack.push(strokes.pop());
      lastClearedBackup = null;
      redraw();
    } else if (lastClearedBackup && lastClearedBackup.length > 0) {
      strokes = lastClearedBackup.slice();
      lastClearedBackup = null;
      redraw();
      setStatus("Restored cleared notes.");
    }
  }

  function redo() {
    if (redoStack.length === 0) return;
    strokes.push(redoStack.pop());
    lastClearedBackup = null;
    redraw();
  }

  function getPressureScale(ev) {
    if (ev.pointerType === "pen" && typeof ev.pressure === "number" && ev.pressure > 0) {
      // Gentle natural pressure curve for algebra handwriting
      return 0.65 + Math.min(1, ev.pressure) * 0.75;
    }
    return 1.0;
  }

  function getPointFromEvent(ev) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: ev.clientX - rect.left,
      y: ev.clientY - rect.top,
      p: getPressureScale(ev)
    };
  }

  function syncCanvasTouchAction() {
    if (!canvas) return;
    // When Pencil Only is ON, allow finger vertical scrolling while stylus draws smoothly
    canvas.style.touchAction = prefs.pencilOnly ? "pan-y" : "none";
  }

  function bindPointerEvents() {
    // Crucial iOS WKWebView / Sitecase fix:
    // Prevent Safari/WKWebView from hijacking Apple Pencil strokes into page scrolling!
    canvas.addEventListener("touchstart", function (ev) {
      if (!ev.touches || ev.touches.length === 0) return;
      var t = ev.touches[0];
      var isStylus = t.touchType === "stylus";
      if (isStylus || !prefs.pencilOnly) {
        ev.preventDefault();
      }
    }, { passive: false });

    canvas.addEventListener("touchmove", function (ev) {
      if (!ev.touches || ev.touches.length === 0) return;
      var t = ev.touches[0];
      var isStylus = t.touchType === "stylus";
      if (isStylus || !prefs.pencilOnly) {
        ev.preventDefault();
      }
    }, { passive: false });

    canvas.addEventListener("pointerdown", function (ev) {
      // Auto-engage Pencil Only palm rejection on first Apple Pencil touch
      if (ev.pointerType === "pen" && !prefs.pencilOnly && !pencilAutoNotified) {
        prefs.pencilOnly = true;
        pencilAutoNotified = true;
        savePrefs();
        syncToolbarUI();
        syncCanvasTouchAction();
        setStatus("Apple Pencil detected — Pencil Only palm rejection turned On.");
      }

      if (prefs.pencilOnly && ev.pointerType === "touch") {
        return; // Ignore palm/finger touches so user can rest hand or scroll
      }
      if (ev.button !== undefined && ev.button !== 0 && ev.pointerType === "mouse") {
        return;
      }

      ev.preventDefault();
      activePointerId = ev.pointerId;
      if (canvas.setPointerCapture) {
        try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
      }

      var pt = getPointFromEvent(ev);
      activeStroke = {
        tool: tool,
        color: prefs.color,
        size: prefs.size,
        points: [pt]
      };
      redoStack = [];
      lastClearedBackup = null;
      drawStroke(activeStroke);
    });

    canvas.addEventListener("pointermove", function (ev) {
      if (!activeStroke || ev.pointerId !== activePointerId) return;
      ev.preventDefault();

      var events = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev];
      if (!events || events.length === 0) events = [ev];

      for (var i = 0; i < events.length; i++) {
        var pt = getPointFromEvent(events[i]);
        var last = activeStroke.points[activeStroke.points.length - 1];
        if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= 1.2) {
          activeStroke.points.push(pt);
        }
      }
      redraw();
    });

    function finishStroke(ev) {
      if (!activeStroke || ev.pointerId !== activePointerId) return;
      strokes.push(activeStroke);
      activeStroke = null;
      activePointerId = null;
      redraw();
    }

    canvas.addEventListener("pointerup", finishStroke);
    canvas.addEventListener("pointercancel", finishStroke);
  }

  function applyLayoutClasses() {
    var workspace = document.getElementById("workspaceGrid");
    var mainWrap = document.getElementById("mainWrap");
    var card = document.getElementById("scratchpadCard");
    var wrap = document.getElementById("spCanvasWrap");
    var topBtn = document.getElementById("scratchToggleBtn");

    var isPractice = document.getElementById("practiceCard").style.display !== "none";
    var showCard = prefs.open && isPractice;

    if (card) card.classList.toggle("show", showCard);
    if (workspace) {
      workspace.classList.toggle("sp-open", showCard);
      workspace.classList.toggle("sp-stack", prefs.layout === "stack");
    }
    var isWide = showCard && prefs.layout === "split";
    if (mainWrap) {
      mainWrap.classList.toggle("sp-wide", isWide);
    }
    var secOuter = document.getElementById("sectionBarOuter");
    if (secOuter) {
      secOuter.classList.toggle("sp-wide", isWide);
    }
    if (window.AlgebraApp && window.AlgebraApp.syncSectionBarFades) {
      requestAnimationFrame(window.AlgebraApp.syncSectionBarFades);
    }
    if (wrap) {
      wrap.classList.toggle("sp-tall", prefs.heightMode === "tall");
      wrap.setAttribute("data-paper", prefs.paper);
    }
    if (topBtn) {
      topBtn.classList.toggle("active", prefs.open);
      topBtn.textContent = prefs.open ? "✏️ Pad: On" : "✏️ Scratch Pad";
    }

    if (showCard) {
      requestAnimationFrame(resizeCanvas);
    }
  }

  function syncToolbarUI() {
    var penBtn = document.getElementById("spPenBtn");
    var eraBtn = document.getElementById("spEraserBtn");
    if (penBtn) penBtn.classList.toggle("active", tool === "pen");
    if (eraBtn) eraBtn.classList.toggle("active", tool === "eraser");

    var swatches = document.querySelectorAll(".sp-swatch");
    for (var i = 0; i < swatches.length; i++) {
      swatches[i].classList.toggle("active", swatches[i].dataset.color === prefs.color);
    }

    var sizes = document.querySelectorAll(".sp-size-btn");
    for (var j = 0; j < sizes.length; j++) {
      sizes[j].classList.toggle("active", parseFloat(sizes[j].dataset.size) === prefs.size);
    }

    var paperSel = document.getElementById("spPaperSelect");
    if (paperSel) paperSel.value = prefs.paper;

    var pencilBtn = document.getElementById("spPencilOnlyBtn");
    if (pencilBtn) {
      pencilBtn.classList.toggle("active", prefs.pencilOnly);
      pencilBtn.textContent = prefs.pencilOnly ? "Pencil Only: On" : "Pencil Only: Off";
    }

    var autoBtn = document.getElementById("spAutoClearBtn");
    if (autoBtn) {
      autoBtn.classList.toggle("active", prefs.autoClear);
      autoBtn.textContent = prefs.autoClear ? "Auto-Clear: On" : "Auto-Clear: Off";
    }

    var heightBtn = document.getElementById("spHeightBtn");
    if (heightBtn) {
      heightBtn.textContent = prefs.heightMode === "tall" ? "Compact" : "Tall";
    }

    var layoutBtn = document.getElementById("spLayoutBtn");
    if (layoutBtn) {
      layoutBtn.textContent = prefs.layout === "split" ? "Stack Below" : "Side-by-Side";
    }
  }

  function init() {
    loadPrefs();
    canvas = document.getElementById("scratchCanvas");
    if (!canvas) return;

    bindPointerEvents();
    syncCanvasTouchAction();
    syncToolbarUI();
    updateDefaultStatus();
    applyLayoutClasses();

    var topBtn = document.getElementById("scratchToggleBtn");
    if (topBtn) {
      topBtn.addEventListener("click", function () {
        prefs.open = !prefs.open;
        savePrefs();
        applyLayoutClasses();
      });
    }

    var closeBtn = document.getElementById("spCloseBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        prefs.open = false;
        savePrefs();
        applyLayoutClasses();
      });
    }

    document.getElementById("spPenBtn").addEventListener("click", function () {
      tool = "pen";
      syncToolbarUI();
    });

    document.getElementById("spEraserBtn").addEventListener("click", function () {
      tool = "eraser";
      syncToolbarUI();
    });

    var swatches = document.querySelectorAll(".sp-swatch");
    for (var i = 0; i < swatches.length; i++) {
      swatches[i].addEventListener("click", function () {
        prefs.color = this.dataset.color;
        tool = "pen";
        savePrefs();
        syncToolbarUI();
      });
    }

    var sizes = document.querySelectorAll(".sp-size-btn");
    for (var j = 0; j < sizes.length; j++) {
      sizes[j].addEventListener("click", function () {
        prefs.size = parseFloat(this.dataset.size);
        tool = "pen";
        savePrefs();
        syncToolbarUI();
      });
    }

    document.getElementById("spPaperSelect").addEventListener("change", function (e) {
      prefs.paper = e.target.value;
      savePrefs();
      applyLayoutClasses();
    });

    document.getElementById("spPencilOnlyBtn").addEventListener("click", function () {
      prefs.pencilOnly = !prefs.pencilOnly;
      pencilAutoNotified = true; // Respect explicit user choice
      savePrefs();
      syncToolbarUI();
      syncCanvasTouchAction();
      updateDefaultStatus();
    });

    document.getElementById("spAutoClearBtn").addEventListener("click", function () {
      prefs.autoClear = !prefs.autoClear;
      savePrefs();
      syncToolbarUI();
    });

    document.getElementById("spHeightBtn").addEventListener("click", function () {
      prefs.heightMode = prefs.heightMode === "tall" ? "normal" : "tall";
      savePrefs();
      syncToolbarUI();
      applyLayoutClasses();
    });

    document.getElementById("spLayoutBtn").addEventListener("click", function () {
      prefs.layout = prefs.layout === "split" ? "stack" : "split";
      savePrefs();
      syncToolbarUI();
      applyLayoutClasses();
    });

    document.getElementById("spUndoBtn").addEventListener("click", undo);
    document.getElementById("spRedoBtn").addEventListener("click", redo);
    document.getElementById("spClearBtn").addEventListener("click", function () {
      clearCanvas(true);
      setStatus("Cleared (tap Undo to restore).");
    });

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      if (!prefs.open) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resizeCanvas, 80);
    });
  }

  window.ScratchPad = {
    init: init,
    redraw: redraw,
    syncVisibility: applyLayoutClasses,
    getPrefs: function () {
      return Object.assign({}, prefs);
    },
    applyPrefs: function (nextPrefs) {
      if (!nextPrefs || typeof nextPrefs !== "object") return;
      for (var k in nextPrefs) {
        if (Object.prototype.hasOwnProperty.call(prefs, k)) {
          prefs[k] = nextPrefs[k];
        }
      }
      savePrefs();
      syncToolbarUI();
      syncCanvasTouchAction();
      updateDefaultStatus();
      applyLayoutClasses();
      redraw();
    },
    onNewQuestion: function () {
      if (prefs.autoClear && strokes.length > 0) {
        clearCanvas(true);
      }
    }
  };
})();

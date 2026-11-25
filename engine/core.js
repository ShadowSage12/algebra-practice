(function () {
  "use strict";

  var STORAGE_KEY = "openstax_algebra_practice_v1";
  var chapters = [];
  var state = {
    chapterId: null,
    sectionId: "all",
    objectiveFilter: "all",
    viewMode: "practice",
    currentQ: null,
    lastGenId: null,
    hintsShown: 0,
    answeredCorrect: false,
    attemptedCurrent: false,
    showGraphSolution: false,
    graphState: { points: [], lineStyle: "solid", shadePoint: null, line1: [], line2: [], activeLine: 1 },
    selectedChoice: null,
    selectedMulti: {},
    activeInput: null,
    keypadEnabled: true,
    theme: "light",
    streak: 0,
    progress: {}
  };

  function safeLoadStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (saved.progress) state.progress = saved.progress;
      if (typeof saved.streak === "number") state.streak = saved.streak;
      if (saved.theme) state.theme = saved.theme;
      if (typeof saved.keypadEnabled === "boolean") state.keypadEnabled = saved.keypadEnabled;
    } catch (e) {}
  }

  function safeSaveStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        progress: state.progress,
        streak: state.streak,
        theme: state.theme,
        keypadEnabled: state.keypadEnabled
      }));
    } catch (e) {}
  }

  function registerChapter(ch) {
    chapters.push(ch);
  }

  function getChapter() {
    for (var i = 0; i < chapters.length; i++) {
      if (chapters[i].id === state.chapterId) return chapters[i];
    }
    return chapters[0] || null;
  }

  function getObjectiveKey(chId, secId, objText) {
    return chId + "::" + secId + "::" + objText;
  }

  function recordResult(q, isCorrect) {
    var key = getObjectiveKey(q._chapterId, q._sectionId, q.objective);
    if (!state.progress[key]) state.progress[key] = { right: 0, total: 0, recent: [] };
    var p = state.progress[key];
    p.total++;
    if (isCorrect) p.right++;
    p.recent.push(isCorrect);
    if (p.recent.length > 5) p.recent.shift();

    if (isCorrect) state.streak++;
    else state.streak = 0;

    safeSaveStorage();
    updateStreakUI();
  }

  function getMasteryStatus(key) {
    var p = state.progress[key];
    if (!p || p.total === 0) return { code: "new", label: "Not Started" };
    var recentRight = p.recent.filter(Boolean).length;
    if (p.recent.length >= 3 && recentRight / p.recent.length >= 0.8) {
      return { code: "confident", label: "Confidently" };
    }
    if (p.right > 0) return { code: "practicing", label: "With Some Help" };
    return { code: "practicing", label: "Needs Practice" };
  }

  // Adaptive weight: surface unstarted & weaker objectives more often
  function getAdaptiveWeight(chId, secId, objText) {
    var key = getObjectiveKey(chId, secId, objText);
    var p = state.progress[key];
    if (!p || p.total === 0) return 3.5;
    var recentRight = p.recent.filter(Boolean).length;
    var rate = p.recent.length ? (recentRight / p.recent.length) : 0;
    if (p.recent.length >= 3 && rate >= 0.8) return 1.0;
    if (rate < 0.6) return 4.5;
    return 2.5;
  }

  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.theme);
    var btn = document.getElementById("themeBtn");
    if (btn) btn.textContent = state.theme === "dark" ? "☀️" : "🌙";
    if (window.ScratchPad) window.ScratchPad.redraw();
  }

  function updateStreakUI() {
    var el = document.getElementById("streakPill");
    if (el) el.textContent = "Streak: " + state.streak;
  }

  function updateKeypadVisibility() {
    var dock = document.getElementById("keypadDock");
    var main = document.getElementById("mainWrap");
    var btn = document.getElementById("keypadToggleBtn");
    var q = state.currentQ;
    var needsTextInput = state.viewMode === "practice" && q && (
      q.inputType === "field" || q.inputType === "multi_fields" || q.inputType === "combo"
    );
    var show = state.keypadEnabled && needsTextInput;
    if (dock) dock.classList.toggle("hidden", !show);
    if (main) main.classList.toggle("no-keypad-pad", !show);
    if (btn) {
      btn.classList.toggle("active", state.keypadEnabled);
      btn.textContent = state.keypadEnabled ? "Keypad: On" : "Keypad: Off";
    }
    var inputs = document.querySelectorAll(".math-input");
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].setAttribute("inputmode", state.keypadEnabled ? "none" : "text");
    }
  }

  function populateChapterSelect() {
    var sel = document.getElementById("chapterSelect");
    sel.innerHTML = "";
    chapters.forEach(function (ch) {
      var opt = document.createElement("option");
      opt.value = ch.id;
      opt.textContent = ch.title;
      sel.appendChild(opt);
    });
    if (!state.chapterId && chapters.length) state.chapterId = chapters[0].id;
    sel.value = state.chapterId;
  }

  function renderSectionBar() {
    var bar = document.getElementById("sectionBar");
    bar.innerHTML = "";
    var ch = getChapter();
    if (!ch) return;

    var allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "sec-pill" + (state.sectionId === "all" ? " active" : "");
    allBtn.textContent = "Adaptive Mixed Review";
    allBtn.addEventListener("click", function () {
      state.sectionId = "all";
      state.objectiveFilter = "all";
      renderSectionBar();
      populateObjectiveFilter();
      if (state.viewMode === "practice") nextQuestion();
      else renderSelfCheck();
    });
    bar.appendChild(allBtn);

    ch.sections.forEach(function (sec) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "sec-pill" + (state.sectionId === sec.id ? " active" : "");
      b.textContent = sec.id + " " + sec.shortTitle;
      b.addEventListener("click", function () {
        state.sectionId = sec.id;
        state.objectiveFilter = "all";
        renderSectionBar();
        populateObjectiveFilter();
        if (state.viewMode === "practice") nextQuestion();
        else renderSelfCheck();
      });
      bar.appendChild(b);
    });
  }

  function populateObjectiveFilter() {
    var sel = document.getElementById("objectiveSelect");
    sel.innerHTML = "";
    var ch = getChapter();
    if (!ch) return;

    var allOpt = document.createElement("option");
    allOpt.value = "all";
    allOpt.textContent = state.sectionId === "all" ? "All Chapter Objectives (Adaptive)" : "All Objectives in Section " + state.sectionId;
    sel.appendChild(allOpt);

    ch.sections.forEach(function (sec) {
      if (state.sectionId !== "all" && sec.id !== state.sectionId) return;
      sec.objectives.forEach(function (obj) {
        var o = document.createElement("option");
        o.value = sec.id + "::" + obj;
        o.textContent = sec.id + " — " + obj;
        sel.appendChild(o);
      });
    });
    sel.value = state.objectiveFilter;
  }

  function getEligibleGenerators() {
    var ch = getChapter();
    if (!ch) return [];
    var pool = [];
    ch.sections.forEach(function (sec) {
      if (state.sectionId !== "all" && sec.id !== state.sectionId) return;
      sec.generators.forEach(function (g) {
        var objVal = sec.id + "::" + g.objective;
        if (state.objectiveFilter !== "all" && objVal !== state.objectiveFilter) return;
        pool.push({ gen: g, sec: sec, ch: ch });
      });
    });
    return pool;
  }

  function weightedPick(candidates) {
    var totalW = 0;
    var weights = candidates.map(function (item) {
      var w = getAdaptiveWeight(item.ch.id, item.sec.id, item.gen.objective);
      totalW += w;
      return w;
    });
    var r = Math.random() * totalW;
    for (var i = 0; i < candidates.length; i++) {
      r -= weights[i];
      if (r <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  function nextQuestion() {
    var pool = getEligibleGenerators();
    if (pool.length === 0) return;

    var candidates = pool.length > 1
      ? pool.filter(function (item) { return item.gen.id !== state.lastGenId; })
      : pool;
    var chosen = (state.objectiveFilter === "all")
      ? weightedPick(candidates)
      : candidates[Math.floor(Math.random() * candidates.length)];
    state.lastGenId = chosen.gen.id;

    var q = chosen.gen.generate();
    q._chapterId = chosen.ch.id;
    q._sectionId = chosen.sec.id;
    q._sectionTitle = chosen.sec.title;
    q.objective = q.objective || chosen.gen.objective;

    state.currentQ = q;
    state.hintsShown = 0;
    state.answeredCorrect = false;
    state.attemptedCurrent = false;
    state.showGraphSolution = false;
    state.graphState = { points: [], lineStyle: "solid", shadePoint: null, line1: [], line2: [], activeLine: 1 };
    state.selectedChoice = null;
    state.selectedMulti = {};
    state.activeInput = null;

    renderQuestion();
    if (window.ScratchPad) window.ScratchPad.onNewQuestion();
  }

  function renderVisual() {
    var q = state.currentQ;
    var visualWrap = document.getElementById("visualBox");
    var layout = document.getElementById("qLayout");
    if (!q.visual) {
      visualWrap.style.display = "none";
      layout.classList.remove("has-visual");
      return;
    }
    visualWrap.style.display = "flex";
    layout.classList.add("has-visual");

    var solOverlay = null;
    if (state.showGraphSolution && (q.inputType === "graph_points" || q.inputType === "graph_line" || q.inputType === "graph_inequality" || q.inputType === "graph_two_lines")) {
      solOverlay = { type: q.inputType, answer: q.answer };
    }

    if (q.visual.type === "coordinate_plane") {
      window.Renderers.renderCoordinatePlane(visualWrap, q.visual, state.graphState, function (nextGraphState) {
        state.graphState = nextGraphState;
        renderVisual();
      }, solOverlay);
    } else if (q.visual.type === "mapping") {
      window.Renderers.renderMappingDiagram(visualWrap, q.visual);
    }
  }

  function buildChoiceGrid(options, labelText) {
    var wrap = document.createElement("div");
    if (labelText) {
      var lbl = document.createElement("div");
      lbl.className = "combo-section-label";
      lbl.innerHTML = labelText;
      wrap.appendChild(lbl);
    }
    var grid = document.createElement("div");
    grid.className = "choice-grid";
    options.forEach(function (opt) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      btn.dataset.val = opt.value;
      btn.innerHTML = opt.label;
      btn.addEventListener("click", function () {
        state.selectedChoice = opt.value;
        var all = grid.querySelectorAll(".choice-btn");
        for (var i = 0; i < all.length; i++) {
          all[i].classList.toggle("selected", all[i].dataset.val === opt.value);
          all[i].classList.remove("is-wrong", "is-correct");
        }
      });
      grid.appendChild(btn);
    });
    wrap.appendChild(grid);
    return wrap;
  }

  function renderQuestion() {
    var q = state.currentQ;
    if (!q) return;

    document.getElementById("qBadge").textContent = "Section " + q._sectionId + " · " + q._sectionTitle;
    document.getElementById("qObj").textContent = q.objective;
    document.getElementById("qPrompt").innerHTML = q.prompt;

    renderVisual();

    var answerArea = document.getElementById("answerArea");
    answerArea.innerHTML = "";

    if (q.inputType === "field") {
      var row = createFieldRow(q.field, "f0");
      answerArea.appendChild(row);
      var firstInp = row.querySelector("input");
      if (firstInp) state.activeInput = firstInp;
    } else if (q.inputType === "multi_fields") {
      q.fields.forEach(function (fSpec, idx) {
        var r = createFieldRow(fSpec, "f" + idx);
        answerArea.appendChild(r);
        if (idx === 0) state.activeInput = r.querySelector("input");
      });
    } else if (q.inputType === "combo") {
      answerArea.appendChild(buildChoiceGrid(q.choice.options, q.choice.label));
      (q.fields || []).forEach(function (fSpec, idx) {
        var r = createFieldRow(fSpec, "f" + idx);
        answerArea.appendChild(r);
        if (idx === 0) state.activeInput = r.querySelector("input");
      });
    } else if (q.inputType === "choice") {
      answerArea.appendChild(buildChoiceGrid(q.options, q.choiceLabel));
    } else if (q.inputType === "checklist") {
      var cGrid = document.createElement("div");
      cGrid.className = "choice-grid";
      q.options.forEach(function (opt) {
        var cBtn = document.createElement("button");
        cBtn.type = "button";
        cBtn.className = "choice-btn";
        cBtn.dataset.val = opt.value;
        cBtn.innerHTML = opt.label;
        cBtn.addEventListener("click", function () {
          state.selectedMulti[opt.value] = !state.selectedMulti[opt.value];
          cBtn.classList.toggle("selected", !!state.selectedMulti[opt.value]);
          cBtn.classList.remove("is-wrong", "is-correct");
        });
        cGrid.appendChild(cBtn);
      });
      answerArea.appendChild(cGrid);
    } else if (q.inputType === "graph_points" || q.inputType === "graph_line" || q.inputType === "graph_inequality" || q.inputType === "graph_two_lines") {
      var note = document.createElement("div");
      note.style.color = "var(--text-muted)";
      note.style.fontSize = "14px";
      note.innerHTML = q.graphInstructions || "Use the interactive coordinate plane, then tap <strong>Check Answer</strong>.";
      answerArea.appendChild(note);
    }

    var fb = document.getElementById("feedbackBox");
    fb.className = "feedback-box";
    fb.innerHTML = "";

    var hb = document.getElementById("hintsBox");
    hb.className = "hints-box";
    document.getElementById("hintList").innerHTML = "";

    var checkBtn = document.getElementById("checkBtn");
    checkBtn.style.display = "inline-flex";
    var nextBtn = document.getElementById("nextBtn");
    nextBtn.className = "btn";
    nextBtn.textContent = "Skip / New Problem";

    updateHintButton();
    updateKeypadVisibility();
  }

  function createFieldRow(fSpec, id) {
    var row = document.createElement("div");
    row.className = "field-row";

    if (fSpec.label) {
      var lbl = document.createElement("label");
      lbl.className = "field-label";
      lbl.setAttribute("for", id);
      lbl.innerHTML = fSpec.label;
      row.appendChild(lbl);
    }

    var inp = document.createElement("input");
    inp.type = "text";
    inp.id = id;
    inp.className = "math-input";
    inp.autocomplete = "off";
    inp.autocorrect = "off";
    inp.autocapitalize = "off";
    inp.spellcheck = false;
    inp.placeholder = fSpec.placeholder || "";
    inp.setAttribute("inputmode", state.keypadEnabled ? "none" : "text");

    inp.addEventListener("focus", function () {
      state.activeInput = inp;
    });
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        checkCurrentAnswer();
      }
    });

    row.appendChild(inp);
    return row;
  }

  function updateHintButton() {
    var q = state.currentQ;
    var btn = document.getElementById("hintBtn");
    if (!q || !q.steps || q.steps.length === 0) {
      btn.style.display = "none";
      return;
    }
    btn.style.display = "inline-flex";
    if (state.hintsShown >= q.steps.length) {
      btn.textContent = "All Steps Shown";
      btn.disabled = true;
    } else {
      btn.disabled = false;
      btn.textContent = state.hintsShown === 0
        ? "Hint (1/" + q.steps.length + ")"
        : "Next Step (" + (state.hintsShown + 1) + "/" + q.steps.length + ")";
    }
  }

  function revealNextHint() {
    var q = state.currentQ;
    if (!q || !q.steps || state.hintsShown >= q.steps.length) return;
    var hb = document.getElementById("hintsBox");
    var list = document.getElementById("hintList");
    var li = document.createElement("li");
    li.innerHTML = q.steps[state.hintsShown];
    list.appendChild(li);
    state.hintsShown++;
    hb.classList.add("show");
    updateHintButton();
  }

  function showAllSteps() {
    var q = state.currentQ;
    if (!q) return;
    if (q.steps) {
      while (state.hintsShown < q.steps.length) revealNextHint();
    }
    if (q.inputType === "graph_points" || q.inputType === "graph_line" || q.inputType === "graph_inequality" || q.inputType === "graph_two_lines") {
      state.showGraphSolution = true;
      renderVisual();
    }
  }

  function setFeedback(kind, html) {
    var fb = document.getElementById("feedbackBox");
    fb.className = "feedback-box show " + kind;
    fb.innerHTML = html;
  }

  function checkCurrentAnswer() {
    var q = state.currentQ;
    if (!q) return;

    var ok = false;
    var feedback = "";

    if (q.inputType === "field") {
      var inp = document.getElementById("f0");
      var res = window.Grader.gradeField(inp.value, q.field);
      ok = res.ok;
      feedback = res.feedback || "";
      inp.classList.toggle("is-correct", ok);
      inp.classList.toggle("is-wrong", !ok);
    } else if (q.inputType === "multi_fields") {
      var allOk = true;
      var wrongMsgs = [];
      q.fields.forEach(function (fSpec, idx) {
        var fInp = document.getElementById("f" + idx);
        var fRes = window.Grader.gradeField(fInp.value, fSpec);
        fInp.classList.toggle("is-correct", fRes.ok);
        fInp.classList.toggle("is-wrong", !fRes.ok);
        if (!fRes.ok) {
          allOk = false;
          var shortLbl = (fSpec.shortLabel || fSpec.label || ("Part " + (idx + 1))).replace(/<[^>]+>/g, "");
          wrongMsgs.push("<strong>" + shortLbl + ":</strong> " + (fRes.feedback || "Check this value."));
        }
      });
      ok = allOk;
      feedback = wrongMsgs.join("<br>");
    } else if (q.inputType === "combo") {
      var comboMsgs = [];
      var choiceOk = false;
      if (state.selectedChoice === null) {
        comboMsgs.push("<strong>" + (q.choice.shortLabel || "Selection") + ":</strong> Tap one of the choices first.");
      } else {
        choiceOk = state.selectedChoice === q.choice.answer;
        var cbBtns = document.querySelectorAll("#answerArea .choice-btn");
        for (var ci = 0; ci < cbBtns.length; ci++) {
          if (cbBtns[ci].dataset.val === state.selectedChoice) {
            cbBtns[ci].classList.add(choiceOk ? "is-correct" : "is-wrong");
          }
        }
        if (!choiceOk) {
          comboMsgs.push("<strong>" + (q.choice.shortLabel || "Selection") + ":</strong> " + (q.choice.wrongHint || "Re-check your choice."));
        }
      }
      var fieldsOk = true;
      (q.fields || []).forEach(function (fSpec, idx) {
        var fInp = document.getElementById("f" + idx);
        var fRes = window.Grader.gradeField(fInp.value, fSpec);
        fInp.classList.toggle("is-correct", fRes.ok);
        fInp.classList.toggle("is-wrong", !fRes.ok);
        if (!fRes.ok) {
          fieldsOk = false;
          var shortLbl = (fSpec.shortLabel || fSpec.label || ("Part " + (idx + 1))).replace(/<[^>]+>/g, "");
          comboMsgs.push("<strong>" + shortLbl + ":</strong> " + (fRes.feedback || "Check this value."));
        }
      });
      ok = choiceOk && fieldsOk;
      feedback = comboMsgs.join("<br>");
    } else if (q.inputType === "choice") {
      if (state.selectedChoice === null) {
        setFeedback("info", "Tap one of the choices first.");
        return;
      }
      ok = state.selectedChoice === q.answer;
      var cBtns = document.querySelectorAll("#answerArea .choice-btn");
      for (var i = 0; i < cBtns.length; i++) {
        if (cBtns[i].dataset.val === state.selectedChoice) {
          cBtns[i].classList.add(ok ? "is-correct" : "is-wrong");
        }
      }
      feedback = ok ? "" : (q.wrongHint || "Not quite—try revealing a step hint and check again.");
    } else if (q.inputType === "checklist") {
      var selectedKeys = Object.keys(state.selectedMulti).filter(function (k) { return state.selectedMulti[k]; }).sort();
      var expectedKeys = q.answer.slice().sort();
      ok = selectedKeys.length === expectedKeys.length && selectedKeys.every(function (v, idx) { return v === expectedKeys[idx]; });
      var mBtns = document.querySelectorAll("#answerArea .choice-btn");
      for (var j = 0; j < mBtns.length; j++) {
        var val = mBtns[j].dataset.val;
        var isSel = !!state.selectedMulti[val];
        var shouldBe = expectedKeys.indexOf(val) !== -1;
        mBtns[j].classList.remove("is-correct", "is-wrong");
        if (isSel) mBtns[j].classList.add(shouldBe ? "is-correct" : "is-wrong");
      }
      if (!ok) {
        var missing = expectedKeys.filter(function (k) { return !state.selectedMulti[k]; }).length;
        var extra = selectedKeys.filter(function (k) { return expectedKeys.indexOf(k) === -1; }).length;
        if (extra > 0 && missing > 0) feedback = "Check both your selected items (some don't satisfy the condition) and make sure you didn't miss a valid one.";
        else if (extra > 0) feedback = "One or more selected pairs do not satisfy the equation/inequality—substitute x and y to verify.";
        else feedback = "Every pair you picked is valid, but you missed " + missing + " more valid solution(s)!";
      }
    } else if (q.inputType === "graph_points") {
      var gp = window.Grader.gradeGraphPoints(state.graphState, q.answer);
      ok = gp.ok;
      feedback = gp.feedback || "";
    } else if (q.inputType === "graph_line") {
      var gl = window.Grader.gradeGraphLine(state.graphState, q.answer);
      ok = gl.ok;
      feedback = gl.feedback || "";
    } else if (q.inputType === "graph_inequality") {
      var gi = window.Grader.gradeGraphInequality(state.graphState, q.answer);
      ok = gi.ok;
      feedback = gi.feedback || "";
    } else if (q.inputType === "graph_two_lines") {
      var g2 = window.Grader.gradeGraphTwoLines(state.graphState, q.answer);
      ok = g2.ok;
      feedback = g2.feedback || "";
    }

    if (!state.attemptedCurrent) {
      recordResult(q, ok);
      state.attemptedCurrent = true;
    }

    if (ok) {
      state.answeredCorrect = true;
      if (q.inputType === "graph_points" || q.inputType === "graph_line" || q.inputType === "graph_inequality" || q.inputType === "graph_two_lines") {
        state.showGraphSolution = true;
        renderVisual();
      }
      var msg = "<strong>Correct!</strong> " + (q.successNote || "Nice work.");
      setFeedback("correct", msg);
      var nextBtn = document.getElementById("nextBtn");
      nextBtn.className = "btn btn-success";
      nextBtn.textContent = "Next Problem →";
    } else {
      setFeedback("wrong", feedback || "Not quite yet—check your work or tap Hint.");
    }
  }

  function renderSelfCheck() {
    var ch = getChapter();
    if (!ch) return;
    var tbody = document.getElementById("selfCheckBody");
    tbody.innerHTML = "";
    var titleEl = document.getElementById("selfCheckTitle");
    titleEl.textContent = ch.title + " — OpenStax Self Check";

    ch.sections.forEach(function (sec) {
      if (state.sectionId !== "all" && sec.id !== state.sectionId) return;
      sec.objectives.forEach(function (obj) {
        var key = getObjectiveKey(ch.id, sec.id, obj);
        var p = state.progress[key] || { right: 0, total: 0 };
        var st = getMasteryStatus(key);
        var tr = document.createElement("tr");

        var tdSec = document.createElement("td");
        tdSec.style.fontWeight = "700";
        tdSec.textContent = sec.id;
        tr.appendChild(tdSec);

        var tdObj = document.createElement("td");
        tdObj.textContent = obj;
        tr.appendChild(tdObj);

        var tdStat = document.createElement("td");
        tdStat.textContent = p.total ? (p.right + "/" + p.total + " (" + Math.round((p.right / p.total) * 100) + "%)") : "—";
        tr.appendChild(tdStat);

        var tdMast = document.createElement("td");
        var pill = document.createElement("span");
        pill.className = "mastery-pill m-" + st.code;
        pill.textContent = st.label;
        tdMast.appendChild(pill);
        tr.appendChild(tdMast);

        var tdAct = document.createElement("td");
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-sm";
        btn.textContent = "Practice";
        btn.addEventListener("click", function () {
          state.sectionId = sec.id;
          state.objectiveFilter = sec.id + "::" + obj;
          setViewMode("practice");
          renderSectionBar();
          populateObjectiveFilter();
          nextQuestion();
        });
        tdAct.appendChild(btn);
        tr.appendChild(tdAct);

        tbody.appendChild(tr);
      });
    });
  }

  function setViewMode(mode) {
    state.viewMode = mode;
    document.getElementById("practiceCard").style.display = mode === "practice" ? "block" : "none";
    document.getElementById("dashboardCard").classList.toggle("show", mode === "selfcheck");
    document.getElementById("tabPractice").classList.toggle("active", mode === "practice");
    document.getElementById("tabSelfCheck").classList.toggle("active", mode === "selfcheck");
    if (mode === "selfcheck") renderSelfCheck();
    if (window.ScratchPad) window.ScratchPad.syncVisibility();
    updateKeypadVisibility();
  }

  // Built-in Touch Math Keypad (includes 'none' & 'undefined')
  function buildKeypad() {
    var keys = [
      { t: "7" }, { t: "8" }, { t: "9" }, { t: "/", cls: "kp-op" }, { t: "(", cls: "kp-op" },
      { t: ")", cls: "kp-op" }, { t: "[", cls: "kp-op" }, { t: "]", cls: "kp-op" }, { t: "x", cls: "kp-op" }, { t: "y", cls: "kp-op" },

      { t: "4" }, { t: "5" }, { t: "6" }, { t: "-", cls: "kp-op" }, { t: "+", cls: "kp-op" },
      { t: "=", cls: "kp-op" }, { t: "<", cls: "kp-op" }, { t: ">", cls: "kp-op" }, { t: "≤", cls: "kp-op" }, { t: "≥", cls: "kp-op" },

      { t: "1" }, { t: "2" }, { t: "3" }, { t: "0" }, { t: "," },
      { t: "." }, { t: "^", cls: "kp-op" }, { t: "∞", cls: "kp-op" }, { t: "π", cls: "kp-op" }, { t: "⌫", action: "back", cls: "kp-op" },

      { t: "{", cls: "kp-op" }, { t: "}", cls: "kp-op" }, { t: "a", cls: "kp-op" }, { t: "h", cls: "kp-op" },
      { t: "none" }, { t: "undefined" }, { t: "Next Field", action: "tab", cls: "kp-wide" }, { t: "Check", action: "enter", cls: "kp-op kp-wide" }
    ];

    var inner = document.getElementById("keypadInner");
    inner.innerHTML = "";
    keys.forEach(function (k) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "kp-key" + (k.cls ? " " + k.cls : "");
      b.textContent = k.t;
      b.addEventListener("pointerdown", function (ev) {
        ev.preventDefault();
        handleKey(k);
      });
      inner.appendChild(b);
    });
  }

  function handleKey(k) {
    if (k.action === "enter") {
      checkCurrentAnswer();
      return;
    }
    var inputs = Array.prototype.slice.call(document.querySelectorAll(".math-input"));
    if (inputs.length === 0) return;
    var inp = state.activeInput && document.body.contains(state.activeInput) ? state.activeInput : inputs[0];
    state.activeInput = inp;

    if (k.action === "tab") {
      var idx = inputs.indexOf(inp);
      var nextInp = inputs[(idx + 1) % inputs.length];
      state.activeInput = nextInp;
      nextInp.focus();
      return;
    }

    var start = inp.selectionStart !== null ? inp.selectionStart : inp.value.length;
    var end = inp.selectionEnd !== null ? inp.selectionEnd : inp.value.length;
    var v = inp.value;

    if (k.action === "back") {
      if (start !== end) {
        inp.value = v.slice(0, start) + v.slice(end);
        inp.setSelectionRange(start, start);
      } else if (start > 0) {
        inp.value = v.slice(0, start - 1) + v.slice(end);
        inp.setSelectionRange(start - 1, start - 1);
      }
    } else {
      inp.value = v.slice(0, start) + k.t + v.slice(end);
      var caret = start + k.t.length;
      inp.setSelectionRange(caret, caret);
    }
    inp.classList.remove("is-correct", "is-wrong");
  }

  function openBackupModal() {
    var data = JSON.stringify({ progress: state.progress, streak: state.streak }, null, 2);
    document.getElementById("backupText").value = data;
    document.getElementById("backupStatus").textContent = "";
    document.getElementById("backupModal").classList.add("show");
  }

  function init() {
    safeLoadStorage();
    var hasSaved = false;
    try { hasSaved = !!localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (!hasSaved && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      state.theme = "dark";
    }
    applyTheme();
    updateStreakUI();
    populateChapterSelect();
    renderSectionBar();
    populateObjectiveFilter();
    buildKeypad();

    document.getElementById("chapterSelect").addEventListener("change", function (e) {
      state.chapterId = e.target.value;
      state.sectionId = "all";
      state.objectiveFilter = "all";
      renderSectionBar();
      populateObjectiveFilter();
      if (state.viewMode === "practice") nextQuestion();
      else renderSelfCheck();
    });

    document.getElementById("objectiveSelect").addEventListener("change", function (e) {
      state.objectiveFilter = e.target.value;
      if (state.viewMode === "practice") nextQuestion();
    });

    document.getElementById("tabPractice").addEventListener("click", function () { setViewMode("practice"); });
    document.getElementById("tabSelfCheck").addEventListener("click", function () { setViewMode("selfcheck"); });

    document.getElementById("checkBtn").addEventListener("click", checkCurrentAnswer);
    document.getElementById("hintBtn").addEventListener("click", revealNextHint);
    document.getElementById("solutionBtn").addEventListener("click", showAllSteps);
    document.getElementById("nextBtn").addEventListener("click", nextQuestion);

    document.getElementById("themeBtn").addEventListener("click", function () {
      state.theme = state.theme === "dark" ? "light" : "dark";
      applyTheme();
      safeSaveStorage();
    });

    document.getElementById("keypadToggleBtn").addEventListener("click", function () {
      state.keypadEnabled = !state.keypadEnabled;
      safeSaveStorage();
      updateKeypadVisibility();
    });

    document.getElementById("backupBtn").addEventListener("click", openBackupModal);
    document.getElementById("closeBackupBtn").addEventListener("click", function () {
      document.getElementById("backupModal").classList.remove("show");
    });

    document.getElementById("downloadBackupBtn").addEventListener("click", function () {
      var text = document.getElementById("backupText").value;
      var blob = new Blob([text], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "algebra-practice-progress.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      document.getElementById("backupStatus").textContent = "Downloaded progress backup JSON.";
    });

    document.getElementById("importBackupBtn").addEventListener("click", function () {
      try {
        var parsed = JSON.parse(document.getElementById("backupText").value);
        if (parsed.progress) state.progress = parsed.progress;
        if (typeof parsed.streak === "number") state.streak = parsed.streak;
        safeSaveStorage();
        updateStreakUI();
        if (state.viewMode === "selfcheck") renderSelfCheck();
        document.getElementById("backupStatus").textContent = "Progress restored successfully!";
      } catch (e) {
        document.getElementById("backupStatus").textContent = "Invalid JSON — please check the pasted backup.";
      }
    });

    document.getElementById("resetProgressBtn").addEventListener("click", function () {
      if (!window.confirm("Reset all saved mastery progress and streak?")) return;
      state.progress = {};
      state.streak = 0;
      safeSaveStorage();
      updateStreakUI();
      if (state.viewMode === "selfcheck") renderSelfCheck();
      document.getElementById("backupText").value = JSON.stringify({ progress: {}, streak: 0 }, null, 2);
      document.getElementById("backupStatus").textContent = "Progress cleared.";
    });

    if (window.ScratchPad) window.ScratchPad.init();
    nextQuestion();
  }

  window.AlgebraApp = {
    registerChapter: registerChapter,
    init: init
  };

  var _initialized = false;
  var _origInit = init;
  window.AlgebraApp.init = function () {
    if (_initialized) return;
    _initialized = true;
    _origInit();
  };

  window.addEventListener("DOMContentLoaded", function () {
    window.AlgebraApp.init();
  });
})();

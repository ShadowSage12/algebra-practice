(function () {
  "use strict";

  var STORAGE_KEY = "openstax_algebra_practice_v1";
  var chapters = [];
  var state = {
    chapterId: null,
    sectionId: "all",
    objectiveFilter: "all",
    unmasteredOnly: false,
    allMasteredFallback: false,
    viewMode: "practice",
    drawerOpen: false,
    drawerSearch: "",
    expandedChapters: {},
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
      if (typeof saved.chapterId === "string" && saved.chapterId) state.chapterId = saved.chapterId;
      if (typeof saved.sectionId === "string" && saved.sectionId) state.sectionId = saved.sectionId;
      if (typeof saved.objectiveFilter === "string" && saved.objectiveFilter) state.objectiveFilter = saved.objectiveFilter;
      if (typeof saved.unmasteredOnly === "boolean") state.unmasteredOnly = saved.unmasteredOnly;
    } catch (e) {}
  }

  function safeSaveStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        progress: state.progress,
        streak: state.streak,
        theme: state.theme,
        keypadEnabled: state.keypadEnabled,
        chapterId: state.chapterId,
        sectionId: state.sectionId,
        objectiveFilter: state.objectiveFilter,
        unmasteredOnly: state.unmasteredOnly
      }));
    } catch (e) {}
  }

  function registerChapter(ch) {
    chapters.push(ch);
  }

  function getChapterById(id) {
    for (var i = 0; i < chapters.length; i++) {
      if (chapters[i].id === id) return chapters[i];
    }
    return null;
  }

  function getChapter() {
    return getChapterById(state.chapterId) || chapters[0] || null;
  }

  function getSectionById(ch, secId) {
    if (!ch) return null;
    for (var i = 0; i < ch.sections.length; i++) {
      if (ch.sections[i].id === secId) return ch.sections[i];
    }
    return null;
  }

  function getObjectiveKey(chId, secId, objText) {
    return chId + "::" + secId + "::" + objText;
  }

  function getMasteryStatus(key) {
    var p = state.progress[key];
    if (!p || p.total === 0) return { code: "new", label: "Not Started", sym: "○" };
    var recentRight = p.recent.filter(Boolean).length;
    if (p.recent.length >= 3 && recentRight / p.recent.length >= 0.8) {
      return { code: "confident", label: "Confidently", sym: "✓" };
    }
    if (p.right > 0) return { code: "practicing", label: "With Some Help", sym: "◐" };
    return { code: "practicing", label: "Needs Practice", sym: "◐" };
  }

  function getSectionMasteryStats(ch, sec) {
    var mastered = 0, practicing = 0, total = sec.objectives.length;
    for (var i = 0; i < total; i++) {
      var st = getMasteryStatus(getObjectiveKey(ch.id, sec.id, sec.objectives[i]));
      if (st.code === "confident") mastered++;
      else if (st.code === "practicing") practicing++;
    }
    var overall = mastered === total && total > 0 ? "confident" : (mastered > 0 || practicing > 0 ? "practicing" : "new");
    return { mastered: mastered, practicing: practicing, total: total, status: overall };
  }

  function getChapterMasteryStats(ch) {
    var mastered = 0, practicing = 0, total = 0;
    for (var i = 0; i < ch.sections.length; i++) {
      var s = getSectionMasteryStats(ch, ch.sections[i]);
      mastered += s.mastered;
      practicing += s.practicing;
      total += s.total;
    }
    return { mastered: mastered, practicing: practicing, total: total };
  }

  function getUnmasteredCountInScope() {
    var ch = getChapter();
    if (!ch) return 0;
    var count = 0;
    ch.sections.forEach(function (sec) {
      if (state.sectionId !== "all" && sec.id !== state.sectionId) return;
      sec.objectives.forEach(function (obj) {
        var st = getMasteryStatus(getObjectiveKey(ch.id, sec.id, obj));
        if (st.code !== "confident") count++;
      });
    });
    return count;
  }

  function findNextUnmasteredObjective(excludeCurrentObj) {
    var currentCh = getChapter();
    var orderedChapters = [];
    if (currentCh) orderedChapters.push(currentCh);
    chapters.forEach(function (c) {
      if (!currentCh || c.id !== currentCh.id) orderedChapters.push(c);
    });

    for (var ci = 0; ci < orderedChapters.length; ci++) {
      var ch = orderedChapters[ci];
      // Put active section first when scanning active chapter
      var secs = ch.sections.slice();
      if (currentCh && ch.id === currentCh.id && state.sectionId !== "all") {
        secs.sort(function (a, b) {
          return (a.id === state.sectionId ? -1 : 0) - (b.id === state.sectionId ? -1 : 0);
        });
      }
      for (var si = 0; si < secs.length; si++) {
        var sec = secs[si];
        for (var oi = 0; oi < sec.objectives.length; oi++) {
          var obj = sec.objectives[oi];
          var objVal = sec.id + "::" + obj;
          if (excludeCurrentObj && currentCh && ch.id === currentCh.id && objVal === state.objectiveFilter) {
            continue;
          }
          var st = getMasteryStatus(getObjectiveKey(ch.id, sec.id, obj));
          if (st.code !== "confident") {
            return { chId: ch.id, secId: sec.id, obj: obj, objVal: objVal };
          }
        }
      }
    }
    return null;
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

  // ---------------------------------------------------------
  // URL Hash + Resume State Sync (#ch03/3.4 or #ch03/3.4/1)
  // ---------------------------------------------------------
  function validateNavigationState() {
    var ch = getChapterById(state.chapterId) || chapters[0] || null;
    if (!ch) return;
    state.chapterId = ch.id;
    state.expandedChapters[ch.id] = true;

    if (state.sectionId !== "all") {
      var sec = getSectionById(ch, state.sectionId);
      if (!sec) {
        state.sectionId = "all";
        state.objectiveFilter = "all";
      } else if (state.objectiveFilter !== "all") {
        var validObj = sec.objectives.some(function (o) { return (sec.id + "::" + o) === state.objectiveFilter; });
        if (!validObj) state.objectiveFilter = "all";
      }
    } else if (state.objectiveFilter !== "all") {
      // Allow objectiveFilter from any section of this chapter by aligning sectionId
      var parts = state.objectiveFilter.split("::");
      var secMatch = parts.length >= 2 ? getSectionById(ch, parts[0]) : null;
      var objText = parts.slice(1).join("::");
      if (secMatch && secMatch.objectives.indexOf(objText) !== -1) {
        state.sectionId = secMatch.id;
      } else {
        state.objectiveFilter = "all";
      }
    }
  }

  function applyHashIfPresent() {
    var raw = (window.location.hash || "").replace(/^#/, "").trim();
    if (!raw) return false;
    var querySplit = raw.split("?");
    var pathParts = querySplit[0].split("/").filter(Boolean);
    if (pathParts.length === 0) return false;

    var ch = getChapterById(decodeURIComponent(pathParts[0]));
    if (!ch) return false;

    state.chapterId = ch.id;
    state.sectionId = "all";
    state.objectiveFilter = "all";

    if (pathParts.length >= 2) {
      var secParam = decodeURIComponent(pathParts[1]);
      if (secParam !== "all") {
        var sec = getSectionById(ch, secParam);
        if (sec) {
          state.sectionId = sec.id;
          if (pathParts.length >= 3) {
            var idx = parseInt(pathParts[2], 10);
            if (!isNaN(idx) && idx >= 0 && idx < sec.objectives.length) {
              state.objectiveFilter = sec.id + "::" + sec.objectives[idx];
            }
          }
        }
      }
    }
    if (querySplit[1]) {
      if (querySplit[1].indexOf("unmastered=1") !== -1) state.unmasteredOnly = true;
      else if (querySplit[1].indexOf("unmastered=0") !== -1) state.unmasteredOnly = false;
    }
    return true;
  }

  function syncLocationHash() {
    try {
      var ch = getChapter();
      if (!ch) return;
      var hash = "#" + encodeURIComponent(ch.id) + "/" + encodeURIComponent(state.sectionId || "all");
      if (state.sectionId !== "all" && state.objectiveFilter !== "all") {
        var sec = getSectionById(ch, state.sectionId);
        if (sec) {
          var objText = state.objectiveFilter.slice(sec.id.length + 2);
          var idx = sec.objectives.indexOf(objText);
          if (idx !== -1) hash += "/" + idx;
        }
      }
      if (state.unmasteredOnly && state.objectiveFilter === "all") {
        hash += "?unmastered=1";
      }
      if (window.location.hash !== hash) {
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, "", hash);
        } else {
          window.location.hash = hash;
        }
      }
    } catch (e) {}
  }

  function shortChapterLabel(ch) {
    if (!ch) return "Chapters";
    var m = ch.title.match(/Chapter\s+(\d+)/i);
    return m ? ("Ch " + m[1]) : ch.title;
  }

  function updateNavBreadcrumb() {
    var ch = getChapter();
    var textEl = document.getElementById("navBreadcrumbText");
    var chipEl = document.getElementById("navProgressChip");
    if (!ch || !textEl || !chipEl) return;

    var chShort = shortChapterLabel(ch);
    var label = ch.title;
    var stats;

    if (state.sectionId === "all") {
      label = chShort + " · " + (state.unmasteredOnly ? "Unmastered" : "Mixed Review");
      stats = getChapterMasteryStats(ch);
    } else {
      var sec = getSectionById(ch, state.sectionId);
      if (sec) {
        label = chShort + " · " + sec.id + " " + sec.shortTitle;
        if (state.objectiveFilter !== "all") label += " (1 obj)";
        stats = getSectionMasteryStats(ch, sec);
      } else {
        stats = getChapterMasteryStats(ch);
      }
    }

    textEl.textContent = label;
    chipEl.textContent = stats.mastered + "/" + stats.total;
    chipEl.classList.toggle("all-done", stats.total > 0 && stats.mastered === stats.total);
  }

  function syncSectionBarFades() {
    var inner = document.getElementById("sectionBarInner");
    var bar = document.getElementById("sectionBar");
    if (!inner || !bar) return;
    var canLeft = bar.scrollLeft > 4;
    var canRight = bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 4;
    inner.classList.toggle("has-fade-left", canLeft);
    inner.classList.toggle("has-fade-right", canRight);
  }

  function renderSectionBar(scrollActiveIntoView) {
    var bar = document.getElementById("sectionBar");
    if (!bar) return;
    bar.innerHTML = "";
    var ch = getChapter();
    if (!ch) return;

    var chStats = getChapterMasteryStats(ch);

    // 1. Adaptive Mixed Review pill
    var allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "sec-pill" + (state.sectionId === "all" ? " active" : "");
    var chDot = document.createElement("span");
    chDot.className = "sec-dot m-" + (chStats.mastered === chStats.total && chStats.total > 0 ? "confident" : (chStats.mastered > 0 || chStats.practicing > 0 ? "practicing" : "new"));
    allBtn.appendChild(chDot);
    allBtn.appendChild(document.createTextNode("Mixed "));
    var chCnt = document.createElement("span");
    chCnt.className = "sec-count";
    chCnt.textContent = chStats.mastered + "/" + chStats.total;
    allBtn.appendChild(chCnt);

    allBtn.addEventListener("click", function () {
      navigateTo(ch.id, "all", "all", state.unmasteredOnly);
    });
    bar.appendChild(allBtn);

    // 2. Unmastered Only quick toggle pill
    var unmCount = getUnmasteredCountInScope();
    var unmBtn = document.createElement("button");
    unmBtn.type = "button";
    unmBtn.id = "unmasteredToggleBtn";
    unmBtn.className = "sec-pill pill-unmastered" + (state.unmasteredOnly ? " active" : "");
    unmBtn.title = "Practice only objectives not yet mastered (Confidently)";
    unmBtn.textContent = unmCount > 0
      ? ("🎯 Unmastered (" + unmCount + ")")
      : "✓ All Mastered";
    unmBtn.addEventListener("click", function () {
      state.unmasteredOnly = !state.unmasteredOnly;
      if (state.unmasteredOnly && state.objectiveFilter !== "all") {
        // Clear single-objective lock when turning on Unmastered Only
        state.objectiveFilter = "all";
      }
      safeSaveStorage();
      syncLocationHash();
      updateNavBreadcrumb();
      renderSectionBar(false);
      syncDrawerQuickButtons();
      if (state.viewMode === "practice") nextQuestion();
    });
    bar.appendChild(unmBtn);

    var sep = document.createElement("span");
    sep.className = "sec-pill-sep";
    sep.setAttribute("aria-hidden", "true");
    bar.appendChild(sep);

    // 3. Section pills with live mastery dots & counts
    var activePill = state.sectionId === "all" ? allBtn : null;
    ch.sections.forEach(function (sec) {
      var stats = getSectionMasteryStats(ch, sec);
      var b = document.createElement("button");
      b.type = "button";
      var isAct = state.sectionId === sec.id;
      b.className = "sec-pill" + (isAct ? " active" : "");
      if (isAct) activePill = b;

      var dot = document.createElement("span");
      dot.className = "sec-dot m-" + stats.status;
      b.appendChild(dot);

      b.appendChild(document.createTextNode(sec.id + " " + sec.shortTitle + " "));

      var cnt = document.createElement("span");
      cnt.className = "sec-count";
      cnt.textContent = stats.mastered === stats.total ? ("✓" + stats.total) : (stats.mastered + "/" + stats.total);
      b.appendChild(cnt);

      b.addEventListener("click", function () {
        navigateTo(ch.id, sec.id, "all", state.unmasteredOnly);
      });
      bar.appendChild(b);
    });

    requestAnimationFrame(function () {
      if (scrollActiveIntoView && activePill && activePill.scrollIntoView) {
        activePill.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
      syncSectionBarFades();
    });
  }

  function renderActiveFilterStrip() {
    var strip = document.getElementById("activeFilterStrip");
    var txt = document.getElementById("activeFilterText");
    var nextUnmBtn = document.getElementById("filterNextUnmasteredBtn");
    var clearBtn = document.getElementById("clearFilterBtn");
    if (!strip || !txt) return;

    var ch = getChapter();
    var show = false;
    var celebrate = false;
    var showNextUnm = false;

    if (state.objectiveFilter !== "all" && ch) {
      var parts = state.objectiveFilter.split("::");
      var secId = parts[0];
      var objText = parts.slice(1).join("::");
      var st = getMasteryStatus(getObjectiveKey(ch.id, secId, objText));
      show = true;
      if (st.code === "confident") {
        celebrate = true;
        txt.textContent = "✓ Mastered this objective (" + secId + ")!";
        showNextUnm = !!findNextUnmasteredObjective(true);
      } else {
        txt.textContent = "Focused on 1 objective (" + secId + "): " + objText;
      }
      clearBtn.textContent = "All in " + secId + " ✕";
    } else if (state.unmasteredOnly) {
      show = true;
      var rem = getUnmasteredCountInScope();
      if (state.allMasteredFallback || rem === 0) {
        celebrate = true;
        txt.textContent = "✓ All objectives in this scope are mastered! Reviewing full set.";
        showNextUnm = !!findNextUnmasteredObjective(false);
        clearBtn.textContent = "Exit Unmastered Mode ✕";
      } else {
        txt.textContent = "🎯 Unmastered Only mode · " + rem + " objective" + (rem === 1 ? "" : "s") + " left to master";
        clearBtn.textContent = "Include Mastered ✕";
      }
    }

    strip.classList.toggle("show", show);
    strip.classList.toggle("celebrate", celebrate);
    if (nextUnmBtn) nextUnmBtn.style.display = showNextUnm ? "inline-flex" : "none";
  }

  // ---------------------------------------------------------
  // Slide-Over Chapter & Objective Navigation Drawer
  // ---------------------------------------------------------
  function syncDrawerQuickButtons() {
    var btn = document.getElementById("navDrawerUnmasteredBtn");
    if (btn) {
      btn.classList.toggle("active", state.unmasteredOnly);
      btn.textContent = state.unmasteredOnly ? "Unmastered Only: On" : "Unmastered Only: Off";
    }
  }

  function openNavDrawer(focusSectionId) {
    state.drawerOpen = true;
    var ch = getChapter();
    if (ch) state.expandedChapters[ch.id] = true;
    syncDrawerQuickButtons();
    renderNavDrawer();

    document.getElementById("navDrawerBackdrop").classList.add("show");
    document.getElementById("navDrawer").classList.add("show");
    var trig = document.getElementById("navTriggerBtn");
    if (trig) trig.setAttribute("aria-expanded", "true");

    if (focusSectionId) {
      requestAnimationFrame(function () {
        var target = document.querySelector('[data-drawer-sec="' + focusSectionId + '"]');
        if (target && target.scrollIntoView) {
          target.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      });
    }
  }

  function closeNavDrawer() {
    state.drawerOpen = false;
    document.getElementById("navDrawerBackdrop").classList.remove("show");
    document.getElementById("navDrawer").classList.remove("show");
    var trig = document.getElementById("navTriggerBtn");
    if (trig) trig.setAttribute("aria-expanded", "false");
  }

  function renderNavDrawer() {
    var body = document.getElementById("navDrawerBody");
    if (!body) return;
    body.innerHTML = "";

    var query = (state.drawerSearch || "").trim().toLowerCase();
    var anyMatch = false;

    chapters.forEach(function (ch) {
      var chStats = getChapterMasteryStats(ch);
      var pct = chStats.total ? Math.round((chStats.mastered / chStats.total) * 100) : 0;
      var chTitleMatches = !query || ch.title.toLowerCase().indexOf(query) !== -1;

      var matchingSections = [];
      ch.sections.forEach(function (sec) {
        var secLabel = (sec.id + " " + sec.shortTitle + " " + sec.title).toLowerCase();
        var secMatches = chTitleMatches || secLabel.indexOf(query) !== -1;
        var matchedObjs = sec.objectives.filter(function (obj) {
          return secMatches || obj.toLowerCase().indexOf(query) !== -1;
        });
        if (matchedObjs.length > 0) {
          matchingSections.push({ sec: sec, objs: matchedObjs });
        }
      });

      if (matchingSections.length === 0) return;
      anyMatch = true;

      var isExpanded = query.length > 0 || !!state.expandedChapters[ch.id];
      var card = document.createElement("div");
      card.className = "drawer-ch-card" + (isExpanded ? "" : " collapsed");

      // Chapter accordion header
      var hdr = document.createElement("button");
      hdr.type = "button";
      hdr.className = "drawer-ch-header";
      var topRow = document.createElement("div");
      topRow.className = "drawer-ch-top";

      var titleSpan = document.createElement("span");
      titleSpan.className = "drawer-ch-title";
      titleSpan.textContent = (isExpanded ? "▾ " : "▸ ") + ch.title;
      topRow.appendChild(titleSpan);

      var chChip = document.createElement("span");
      chChip.className = "nav-progress-chip" + (chStats.mastered === chStats.total && chStats.total > 0 ? " all-done" : "");
      chChip.textContent = chStats.mastered + "/" + chStats.total;
      topRow.appendChild(chChip);
      hdr.appendChild(topRow);

      var barOuter = document.createElement("div");
      barOuter.className = "drawer-ch-bar";
      var barFill = document.createElement("div");
      barFill.className = "drawer-ch-fill";
      barFill.style.width = pct + "%";
      barOuter.appendChild(barFill);
      hdr.appendChild(barOuter);

      hdr.addEventListener("click", function () {
        state.expandedChapters[ch.id] = !state.expandedChapters[ch.id];
        renderNavDrawer();
      });
      card.appendChild(hdr);

      var content = document.createElement("div");
      content.className = "drawer-ch-content";

      // All-Chapter Mixed Review row (hidden only when search narrowed to specific items)
      if (!query || chTitleMatches) {
        var mixedBtn = document.createElement("button");
        mixedBtn.type = "button";
        var isMixedAct = state.chapterId === ch.id && state.sectionId === "all";
        mixedBtn.className = "drawer-mixed-btn" + (isMixedAct ? " active" : "");
        mixedBtn.innerHTML = '<span>All Chapter Objectives (Adaptive Mixed)</span><span style="font-size:12px;opacity:0.8;">' + pct + '%</span>';
        mixedBtn.addEventListener("click", function () {
          closeNavDrawer();
          navigateTo(ch.id, "all", "all", state.unmasteredOnly);
        });
        content.appendChild(mixedBtn);
      }

      // Sections & Objectives
      matchingSections.forEach(function (entry) {
        var sec = entry.sec;
        var sStats = getSectionMasteryStats(ch, sec);

        var secBlock = document.createElement("div");
        secBlock.className = "drawer-sec-block";
        secBlock.setAttribute("data-drawer-sec", sec.id);

        var secHead = document.createElement("div");
        secHead.className = "drawer-sec-head";

        var secBtn = document.createElement("button");
        secBtn.type = "button";
        var isSecAct = state.chapterId === ch.id && state.sectionId === sec.id && state.objectiveFilter === "all";
        secBtn.className = "drawer-sec-btn" + (isSecAct ? " active" : "");
        secBtn.textContent = sec.id + " " + sec.title;
        secBtn.title = "Practice all objectives in Section " + sec.id;
        secBtn.addEventListener("click", function () {
          closeNavDrawer();
          navigateTo(ch.id, sec.id, "all", state.unmasteredOnly);
        });
        secHead.appendChild(secBtn);

        var meta = document.createElement("div");
        meta.className = "drawer-sec-meta";
        var sPill = document.createElement("span");
        sPill.className = "drawer-sec-pill" + (sStats.mastered === sStats.total && sStats.total > 0 ? " done" : "");
        sPill.textContent = sStats.mastered + "/" + sStats.total;
        meta.appendChild(sPill);
        secHead.appendChild(meta);
        secBlock.appendChild(secHead);

        var objList = document.createElement("div");
        objList.className = "drawer-obj-list";

        entry.objs.forEach(function (obj) {
          var key = getObjectiveKey(ch.id, sec.id, obj);
          var p = state.progress[key];
          var st = getMasteryStatus(key);
          var objVal = sec.id + "::" + obj;
          var isObjAct = state.chapterId === ch.id && state.objectiveFilter === objVal;

          var rowBtn = document.createElement("button");
          rowBtn.type = "button";
          rowBtn.className = "drawer-obj-row" + (isObjAct ? " active" : "");

          var sym = document.createElement("span");
          sym.className = "obj-status-sym m-" + st.code;
          sym.textContent = st.sym;
          sym.title = st.label;
          rowBtn.appendChild(sym);

          var oTxt = document.createElement("span");
          oTxt.className = "obj-row-text";
          oTxt.textContent = obj;
          rowBtn.appendChild(oTxt);

          if (p && p.total > 0) {
            var sc = document.createElement("span");
            sc.className = "obj-row-score";
            sc.textContent = p.right + "/" + p.total;
            rowBtn.appendChild(sc);
          }

          rowBtn.addEventListener("click", function () {
            closeNavDrawer();
            navigateTo(ch.id, sec.id, objVal, false);
          });
          objList.appendChild(rowBtn);
        });

        secBlock.appendChild(objList);
        content.appendChild(secBlock);
      });

      card.appendChild(content);
      body.appendChild(card);
    });

    if (!anyMatch) {
      var empty = document.createElement("div");
      empty.className = "drawer-empty";
      empty.textContent = 'No chapters or objectives match "' + state.drawerSearch + '".';
      body.appendChild(empty);
    }
  }

  function navigateTo(chId, secId, objFilter, unmasteredFlag, forcePractice) {
    state.chapterId = chId;
    state.sectionId = secId || "all";
    state.objectiveFilter = objFilter || "all";
    if (typeof unmasteredFlag === "boolean") state.unmasteredOnly = unmasteredFlag;
    validateNavigationState();
    safeSaveStorage();
    syncLocationHash();
    updateNavBreadcrumb();
    renderSectionBar(true);
    syncDrawerQuickButtons();

    if (forcePractice && state.viewMode !== "practice") {
      setViewMode("practice");
    }
    if (state.viewMode === "practice") {
      nextQuestion();
    } else {
      renderSelfCheck();
    }
  }

  function jumpToNextUnmastered(excludeCurrent) {
    var nxt = findNextUnmasteredObjective(excludeCurrent);
    if (!nxt) {
      setFeedback("correct", "<strong>All caught up!</strong> Every objective across all loaded chapters is mastered (Confidently).");
      return;
    }
    closeNavDrawer();
    navigateTo(nxt.chId, nxt.secId, nxt.objVal, false, true);
  }

  // ---------------------------------------------------------
  // Core Practice Engine
  // ---------------------------------------------------------
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
    updateNavBreadcrumb();
    renderSectionBar(false);
    renderActiveFilterStrip();
    if (state.drawerOpen) renderNavDrawer();
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

    state.allMasteredFallback = false;
    if (state.unmasteredOnly && state.objectiveFilter === "all") {
      var unmPool = pool.filter(function (item) {
        var st = getMasteryStatus(getObjectiveKey(item.ch.id, item.sec.id, item.gen.objective));
        return st.code !== "confident";
      });
      if (unmPool.length > 0) return unmPool;
      state.allMasteredFallback = true;
    }
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

    renderActiveFilterStrip();
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
    var chStats = getChapterMasteryStats(ch);
    titleEl.textContent = ch.title + " — Self Check (" + chStats.mastered + "/" + chStats.total + " Mastered)";

    var nextUnm = findNextUnmasteredObjective(false);
    var scNextBtn = document.getElementById("selfCheckNextBtn");
    if (scNextBtn) {
      scNextBtn.style.display = nextUnm ? "inline-flex" : "none";
    }

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
          navigateTo(ch.id, sec.id, sec.id + "::" + obj, false, true);
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

  // Built-in Touch Math Keypad
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

    // URL hash takes priority over saved localStorage position if valid
    applyHashIfPresent();
    validateNavigationState();
    syncLocationHash();

    applyTheme();
    updateStreakUI();
    updateNavBreadcrumb();
    renderSectionBar(true);
    syncDrawerQuickButtons();
    buildKeypad();

    // Navigation Drawer bindings
    document.getElementById("navTriggerBtn").addEventListener("click", function () {
      if (state.drawerOpen) closeNavDrawer();
      else openNavDrawer(state.sectionId !== "all" ? state.sectionId : null);
    });
    document.getElementById("navDrawerBackdrop").addEventListener("click", closeNavDrawer);
    document.getElementById("navDrawerCloseBtn").addEventListener("click", closeNavDrawer);

    document.getElementById("qObjBtn").addEventListener("click", function () {
      var targetSec = state.currentQ ? state.currentQ._sectionId : (state.sectionId !== "all" ? state.sectionId : null);
      openNavDrawer(targetSec);
    });

    var searchInp = document.getElementById("navSearchInput");
    var searchClear = document.getElementById("navSearchClearBtn");
    searchInp.addEventListener("input", function (e) {
      state.drawerSearch = e.target.value;
      searchClear.classList.toggle("show", state.drawerSearch.length > 0);
      renderNavDrawer();
    });
    searchClear.addEventListener("click", function () {
      state.drawerSearch = "";
      searchInp.value = "";
      searchClear.classList.remove("show");
      renderNavDrawer();
      searchInp.focus();
    });

    document.getElementById("navNextUnmasteredBtn").addEventListener("click", function () {
      jumpToNextUnmastered(false);
    });

    document.getElementById("navDrawerUnmasteredBtn").addEventListener("click", function () {
      state.unmasteredOnly = !state.unmasteredOnly;
      if (state.unmasteredOnly && state.objectiveFilter !== "all") {
        state.objectiveFilter = "all";
      }
      safeSaveStorage();
      syncLocationHash();
      updateNavBreadcrumb();
      renderSectionBar(false);
      syncDrawerQuickButtons();
      if (state.viewMode === "practice") nextQuestion();
    });

    document.getElementById("clearFilterBtn").addEventListener("click", function () {
      if (state.objectiveFilter !== "all") {
        navigateTo(state.chapterId, state.sectionId, "all", state.unmasteredOnly);
      } else if (state.unmasteredOnly) {
        navigateTo(state.chapterId, state.sectionId, "all", false);
      }
    });

    document.getElementById("filterNextUnmasteredBtn").addEventListener("click", function () {
      jumpToNextUnmastered(true);
    });

    document.getElementById("selfCheckNextBtn").addEventListener("click", function () {
      jumpToNextUnmastered(false);
    });

    // Section bar edge-fade listeners
    var secBar = document.getElementById("sectionBar");
    secBar.addEventListener("scroll", syncSectionBarFades, { passive: true });
    window.addEventListener("resize", syncSectionBarFades);

    // Escape closes drawer or backup modal
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (state.drawerOpen) closeNavDrawer();
        var bm = document.getElementById("backupModal");
        if (bm && bm.classList.contains("show")) bm.classList.remove("show");
      }
    });

    // External URL hash navigation (bookmarks / deep links)
    window.addEventListener("hashchange", function () {
      if (applyHashIfPresent()) {
        validateNavigationState();
        safeSaveStorage();
        updateNavBreadcrumb();
        renderSectionBar(true);
        syncDrawerQuickButtons();
        if (state.viewMode === "practice") nextQuestion();
        else renderSelfCheck();
      }
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
        updateNavBreadcrumb();
        renderSectionBar(false);
        renderActiveFilterStrip();
        if (state.drawerOpen) renderNavDrawer();
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
      updateNavBreadcrumb();
      renderSectionBar(false);
      renderActiveFilterStrip();
      if (state.drawerOpen) renderNavDrawer();
      if (state.viewMode === "selfcheck") renderSelfCheck();
      document.getElementById("backupText").value = JSON.stringify({ progress: {}, streak: 0 }, null, 2);
      document.getElementById("backupStatus").textContent = "Progress cleared.";
    });

    if (window.ScratchPad) window.ScratchPad.init();
    nextQuestion();
  }

  window.AlgebraApp = {
    registerChapter: registerChapter,
    init: init,
    syncSectionBarFades: syncSectionBarFades
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

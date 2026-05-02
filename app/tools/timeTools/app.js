(function () {
  "use strict";

  const body = document.body;
  const clockEl = document.getElementById("clock");
  const countdownEl = document.getElementById("countdown");
  const pauseUntilEl = document.getElementById("pauseUntil");
  const durationButtons = Array.from(document.querySelectorAll(".time-btn"));
  const resetBtn = document.getElementById("resetBtn");
  const minusMinuteBtn = document.getElementById("minusMinuteBtn");
  const plusMinuteBtn = document.getElementById("plusMinuteBtn");
  const resetControls = document.getElementById("resetControls");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const progressFill = document.getElementById("progressFill");
  const progressSegmentsEl = document.getElementById("progressSegments");
  const dashboardStatusEl = document.getElementById("dashboardStatus");
  const statusTextEl = document.getElementById("statusText");
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const themeToggleText = document.getElementById("themeToggleText");

  const THEME_KEY = "timeTools.theme";
  const CLASSIC_THEME = "classic";
  const DASHBOARD_THEME = "dashboard";
  const DASHBOARD_PROGRESS_SEGMENTS = 24;

  let state = "idle";
  let countdownSeconds = 0;
  let countdownTotalSeconds = 0;
  let countdownEndAt = null;
  let countdownTimerId = null;
  let clockTimerId = null;
  let countdownStartDelayId = null;
  let idleSettleTimerId = null;
  let fitFrameId = null;
  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function formatClock(date) {
    return [pad2(date.getHours()), pad2(date.getMinutes()), pad2(date.getSeconds())].join(":");
  }

  function getTheme() {
    return body.getAttribute("data-theme") === DASHBOARD_THEME ? DASHBOARD_THEME : CLASSIC_THEME;
  }

  function isDashboardTheme() {
    return getTheme() === DASHBOARD_THEME;
  }

  function createSegmentDigit(value) {
    const digit = document.createElement("span");
    digit.className = "segment-slot";

    if (value === ":") {
      const separator = document.createElement("span");
      separator.className = "segment-separator";
      digit.appendChild(separator);
      return digit;
    }

    const shell = document.createElement("span");
    shell.className = "segment-digit";
    shell.setAttribute("data-digit", value);

    ["a", "b", "c", "d", "e", "f", "g"].forEach((segmentName) => {
      const segment = document.createElement("span");
      segment.className = "segment seg-" + segmentName;
      segment.setAttribute("data-seg", segmentName);
      shell.appendChild(segment);
    });

    digit.appendChild(shell);
    return digit;
  }

  function applyDigitSegments(shell, value) {
    const map = {
      "0": ["a", "b", "c", "d", "e", "f"],
      "1": ["b", "c"],
      "2": ["a", "b", "d", "e", "g"],
      "3": ["a", "b", "c", "d", "g"],
      "4": ["b", "c", "f", "g"],
      "5": ["a", "c", "d", "f", "g"],
      "6": ["a", "c", "d", "e", "f", "g"],
      "7": ["a", "b", "c"],
      "8": ["a", "b", "c", "d", "e", "f", "g"],
      "9": ["a", "b", "c", "d", "f", "g"],
      "-": ["g"]
    };
    const active = map[value] || [];

    Array.from(shell.children).forEach((segment) => {
      const segName = segment.getAttribute("data-seg") || "";
      segment.classList.toggle("on", active.includes(segName));
    });
  }

  function renderSegmentText(target, value, labelPrefix) {
    target.setAttribute("aria-label", labelPrefix + " " + value);
    target.textContent = "";

    value.split("").forEach((character) => {
      const node = createSegmentDigit(character);
      const shell = node.firstElementChild;
      if (character !== ":" && shell) {
        applyDigitSegments(shell, character);
      }
      target.appendChild(node);
    });
  }

  function renderClockText(value) {
    if (isDashboardTheme()) {
      renderSegmentText(clockEl, value, "Aktuelle Uhrzeit");
      return;
    }

    clockEl.setAttribute("aria-label", "Aktuelle Uhrzeit " + value);
    clockEl.textContent = "";

    value.split("").forEach((character) => {
      const slot = document.createElement("span");
      slot.className = character === ":" ? "clock-slot separator" : "clock-slot";
      slot.textContent = character;
      clockEl.appendChild(slot);
    });
  }

  function formatCountdown(totalSeconds) {
    const safe = Math.max(0, totalSeconds);
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    return pad2(minutes) + ":" + pad2(seconds);
  }

  function setState(nextState) {
    const previousState = state;
    clearIdleSettleTimer();
    body.classList.remove("clock-settling");
    body.classList.remove("state-idle", "state-running", "state-finished");
    body.classList.add("state-" + nextState);
    state = nextState;
    resetControls.setAttribute("aria-hidden", nextState === "idle" ? "true" : "false");
    updateDashboardStatus();

    if (nextState === "idle" && previousState !== "idle") {
      body.classList.add("clock-stabilize");
    }

    syncClockFit();
    scheduleClockFit();
    window.requestAnimationFrame(() => {
      scheduleClockFit();
      if (nextState === "idle" && previousState !== "idle") {
        window.requestAnimationFrame(() => {
          syncClockFit();
          body.classList.remove("clock-stabilize");
          void clockEl.offsetWidth;
          body.classList.add("clock-settling");
          idleSettleTimerId = window.setTimeout(() => {
            body.classList.remove("clock-settling");
            idleSettleTimerId = null;
          }, 140);
          scheduleClockFit();
        });
      }
    });
    window.setTimeout(scheduleClockFit, 120);
  }

  function renderProgressBar() {
    const total = countdownTotalSeconds;
    const remaining = Math.max(0, countdownSeconds);

    body.classList.remove("status-ok", "status-warn", "status-bad");

    if (state === "idle" || !total) {
      progressFill.style.width = "100%";
      countdownEl.style.color = "";
      body.classList.add("status-ok");
      updateDashboardStatus();
      renderDashboardProgressSegments(1);
      return;
    }

    const pct = (remaining / total) * 100;
    progressFill.style.width = Math.min(100, Math.max(0, pct)) + "%";

    if (remaining > 300) {
      countdownEl.style.color = "#14a76c";
      body.classList.add("status-ok");
    } else if (remaining > 30) {
      countdownEl.style.color = "#E9B63B";
      body.classList.add("status-warn");
    } else {
      countdownEl.style.color = "#DC2525";
      body.classList.add("status-bad");
    }

    if (isDashboardTheme()) {
      countdownEl.style.color = "";
    }

    renderDashboardProgressSegments(pct / 100);
    updateDashboardStatus();
  }

  function renderClock() {
    renderClockText(formatClock(new Date()));
    scheduleClockFit();
  }

  function renderCountdown() {
    const value = formatCountdown(countdownSeconds);

    if (isDashboardTheme()) {
      renderSegmentText(countdownEl, value, "Countdown");
      return;
    }

    countdownEl.textContent = value;
  }

  function ensureDashboardProgressSegments() {
    if (!progressSegmentsEl || progressSegmentsEl.childElementCount === DASHBOARD_PROGRESS_SEGMENTS) {
      return;
    }

    progressSegmentsEl.textContent = "";
    for (let i = 0; i < DASHBOARD_PROGRESS_SEGMENTS; i += 1) {
      const segment = document.createElement("span");
      segment.className = "progress-segment";
      progressSegmentsEl.appendChild(segment);
    }
  }

  function renderDashboardProgressSegments(progressRatio) {
    ensureDashboardProgressSegments();
    if (!progressSegmentsEl) {
      return;
    }

    const safeRatio = Math.max(0, Math.min(1, Number(progressRatio) || 0));
    const activeCount = Math.round(safeRatio * DASHBOARD_PROGRESS_SEGMENTS);
    Array.from(progressSegmentsEl.children).forEach((segment, index) => {
      segment.classList.toggle("active", index < activeCount);
    });
  }

  function updateThemeToggleLabel() {
    if (!themeToggleText || !themeToggleBtn) {
      return;
    }
    const nextTheme = isDashboardTheme() ? "Klassik" : "Dashboard";
    themeToggleText.textContent = isDashboardTheme() ? "STD" : "LCD";
    themeToggleBtn.setAttribute("aria-label", nextTheme + " Theme aktivieren");
    themeToggleBtn.setAttribute("title", "Theme wechseln zu " + nextTheme);
  }

  function updateDashboardStatus() {
    if (!dashboardStatusEl || !statusTextEl) {
      return;
    }

    statusTextEl.textContent = "PAUSE";
    statusTextEl.classList.toggle("run-active", state === "running");
  }

  function applyTheme(nextTheme) {
    const resolved = nextTheme === DASHBOARD_THEME ? DASHBOARD_THEME : CLASSIC_THEME;
    body.setAttribute("data-theme", resolved);
    updateThemeToggleLabel();
    renderClock();
    renderCountdown();
    renderPauseUntil();
    renderProgressBar();
    scheduleClockFit();
  }

  function loadThemePreference() {
    let storedTheme = CLASSIC_THEME;
    try {
      const candidate = window.localStorage.getItem(THEME_KEY);
      if (candidate === DASHBOARD_THEME || candidate === CLASSIC_THEME) {
        storedTheme = candidate;
      }
    } catch (error) {
      // Continue with default theme when storage access is unavailable.
    }

    applyTheme(storedTheme);
  }

  function toggleTheme() {
    const nextTheme = isDashboardTheme() ? CLASSIC_THEME : DASHBOARD_THEME;
    applyTheme(nextTheme);
    try {
      window.localStorage.setItem(THEME_KEY, nextTheme);
    } catch (error) {
      // Continue without persistence when storage is blocked.
    }
  }

  function renderPauseUntil() {
    let pauseUntilValue = "--:--";

    if (countdownEndAt) {
      const rounded = new Date(countdownEndAt.getTime());
      const seconds = rounded.getSeconds();

      if (seconds > 20) {
        rounded.setMinutes(rounded.getMinutes() + 1);
      }

      rounded.setSeconds(0, 0);
      pauseUntilValue = [pad2(rounded.getHours()), pad2(rounded.getMinutes())].join(":");
    }

    if (isDashboardTheme()) {
      pauseUntilEl.textContent = "";
      pauseUntilEl.setAttribute("aria-label", "Pause bis " + pauseUntilValue);

      const label = document.createElement("span");
      label.className = "pause-until-label";
      label.textContent = "Pause bis";

      const value = document.createElement("span");
      value.className = "pause-until-time";

      pauseUntilEl.appendChild(label);
      pauseUntilEl.appendChild(value);
      renderSegmentText(value, pauseUntilValue, "Pause bis");
      return;
    }

    pauseUntilEl.textContent = "Pause bis " + pauseUntilValue;
  }

  function clearCountdownTimer() {
    if (countdownTimerId !== null) {
      window.clearTimeout(countdownTimerId);
      countdownTimerId = null;
    }
  }

  function clearCountdownStartDelay() {
    if (countdownStartDelayId !== null) {
      window.clearTimeout(countdownStartDelayId);
      countdownStartDelayId = null;
    }
  }

  function clearClockTimer() {
    if (clockTimerId !== null) {
      window.clearTimeout(clockTimerId);
      clockTimerId = null;
    }
  }

  function clearIdleSettleTimer() {
    if (idleSettleTimerId !== null) {
      window.clearTimeout(idleSettleTimerId);
      idleSettleTimerId = null;
    }
  }

  function syncClockFit() {
    fitFrameId = null;

    const parent = clockEl.parentElement;
    if (!parent) {
      return;
    }

    const isFullscreen = body.classList.contains("fullscreen-active");
    const idleWidthFactor = isFullscreen ? 0.985 : 0.95;
    const runningWidthFactor = isFullscreen ? 0.68 : 0.72;
    const viewportTarget = Math.floor(window.innerWidth * (state === "idle" ? idleWidthFactor : runningWidthFactor));
    const availableWidth = Math.max(1, Math.min(parent.clientWidth, viewportTarget) - 24);
    const neededWidth = clockEl.scrollWidth;
    const neededHeight = clockEl.scrollHeight;

    const parentRect = parent.getBoundingClientRect();
    const idleHeightFactor = isFullscreen ? 0.9 : 0.84;
    const runningHeightFactor = isFullscreen ? 0.24 : 0.28;
    const targetHeight = Math.max(1, Math.floor(parentRect.height * (state === "idle" ? idleHeightFactor : runningHeightFactor)));

    if (!availableWidth || !neededWidth || !neededHeight) {
      return;
    }

    const widthScale = availableWidth / neededWidth;
    const heightScale = targetHeight / neededHeight;
    const scale = Math.min(widthScale, heightScale);

    clockEl.style.setProperty("--fit-scale", String(Math.max(0.4, scale)));
  }

  function scheduleClockFit() {
    if (fitFrameId !== null) {
      window.cancelAnimationFrame(fitFrameId);
    }
    fitFrameId = window.requestAnimationFrame(syncClockFit);
  }

  function scheduleNextClockTick() {
    clearClockTimer();
    const delay = 1000 - (Date.now() % 1000);
    clockTimerId = window.setTimeout(() => {
      renderClock();
      scheduleNextClockTick();
    }, delay);
  }

  function finishCountdown() {
    clearCountdownStartDelay();
    clearCountdownTimer();
    countdownSeconds = 0;
    renderCountdown();
    setState("finished");
    renderProgressBar();
  }

  function scheduleNextCountdownTick() {
    if (!countdownEndAt || state !== "running") {
      return;
    }

    clearCountdownTimer();
    const delay = 1000 - (Date.now() % 1000);
    countdownTimerId = window.setTimeout(tickCountdown, delay);
  }

  function tickCountdown() {
    if (!countdownEndAt) {
      return;
    }

    const now = Date.now();
    const remaining = Math.ceil((countdownEndAt.getTime() - now) / 1000);

    if (remaining <= 0) {
      finishCountdown();
      return;
    }

    countdownSeconds = remaining;
    renderCountdown();
    renderProgressBar();
    scheduleNextCountdownTick();
  }

  function startCountdown(totalSeconds) {
    if (state === "running" || countdownStartDelayId) {
      return;
    }

    clearCountdownStartDelay();
    clearCountdownTimer();

    const nowMs = Date.now();
    const delayToNextSecond = (1000 - (nowMs % 1000)) % 1000;
    const alignedStartMs = nowMs + delayToNextSecond;

    countdownEndAt = new Date(alignedStartMs + totalSeconds * 1000);
    countdownSeconds = totalSeconds;
    countdownTotalSeconds = totalSeconds;

    renderCountdown();
    renderPauseUntil();
    setState("running");
    renderProgressBar();

    if (delayToNextSecond === 0) {
      tickCountdown();
      return;
    }

    countdownStartDelayId = window.setTimeout(() => {
      countdownStartDelayId = null;
      tickCountdown();
    }, delayToNextSecond);
  }

  function resetCountdown() {
    clearCountdownStartDelay();
    clearCountdownTimer();
    countdownSeconds = 0;
    countdownTotalSeconds = 0;
    countdownEndAt = null;
    renderCountdown();
    renderPauseUntil();
    setState("idle");
    renderProgressBar();
  }

  function adjustCountdownByMinutes(deltaMinutes) {
    if (state !== "running" || !countdownEndAt) {
      return;
    }

    const deltaSeconds = Math.trunc(deltaMinutes * 60);
    if (!Number.isFinite(deltaSeconds) || deltaSeconds === 0) {
      return;
    }

    const now = Date.now();
    const currentRemaining = Math.ceil((countdownEndAt.getTime() - now) / 1000);
    const nextRemaining = currentRemaining + deltaSeconds;

    if (nextRemaining <= 0) {
      finishCountdown();
      return;
    }

    countdownSeconds = nextRemaining;
    countdownTotalSeconds = Math.max(1, countdownTotalSeconds + deltaSeconds);
    countdownEndAt = new Date(now + nextRemaining * 1000);

    clearCountdownStartDelay();
    renderCountdown();
    renderPauseUntil();
    renderProgressBar();
    scheduleNextCountdownTick();
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      // Keep tool usable even when fullscreen is blocked by browser policies.
      console.warn("Fullscreen konnte nicht umgeschaltet werden", error);
    }
  }

  function updateFullscreenClass() {
    body.classList.toggle("fullscreen-active", Boolean(document.fullscreenElement));
  }

  function initEvents() {
    durationButtons.forEach((button) => {
      button.addEventListener("click", () => {
        if (state !== "idle") {
          return;
        }
        const secondsAttr = button.getAttribute("data-seconds");
        const minutesAttr = button.getAttribute("data-minutes");
        const seconds = secondsAttr !== null
          ? Number(secondsAttr)
          : Number(minutesAttr) * 60;

        if (!Number.isFinite(seconds) || seconds <= 0) {
          return;
        }
        startCountdown(seconds);
      });
    });

    resetBtn.addEventListener("click", () => {
      if (state === "idle") {
        return;
      }
      resetCountdown();
    });

    minusMinuteBtn.addEventListener("click", () => {
      adjustCountdownByMinutes(-1);
    });

    plusMinuteBtn.addEventListener("click", () => {
      adjustCountdownByMinutes(1);
    });

    fullscreenBtn.addEventListener("click", toggleFullscreen);
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener("click", toggleTheme);
    }
    document.addEventListener("fullscreenchange", updateFullscreenClass);
    window.addEventListener("pageshow", updateFullscreenClass);
    window.addEventListener("resize", scheduleClockFit);
  }

  function init() {
    ensureDashboardProgressSegments();
    loadThemePreference();
    renderClock();
    renderCountdown();
    renderPauseUntil();
    renderProgressBar();
    setState("idle");

    scheduleNextClockTick();
    initEvents();
    updateFullscreenClass();

    window.addEventListener("beforeunload", () => {
      clearIdleSettleTimer();
      clearCountdownStartDelay();
      clearCountdownTimer();
      if (fitFrameId !== null) {
        window.cancelAnimationFrame(fitFrameId);
      }
      clearClockTimer();
    });
  }

  init();
})();

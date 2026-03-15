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
  const progressGreen = document.getElementById("progressGreen");
  const progressYellow = document.getElementById("progressYellow");
  const progressRed = document.getElementById("progressRed");
  const fillGreen = document.getElementById("fillGreen");
  const fillYellow = document.getElementById("fillYellow");
  const fillRed = document.getElementById("fillRed");

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

  function renderClockText(value) {
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
          }, 210);
          scheduleClockFit();
        });
      }
    });
    window.setTimeout(scheduleClockFit, 120);
  }

  function renderProgressBar() {
    const total = countdownTotalSeconds;
    const remaining = Math.max(0, countdownSeconds);

    if (state === "idle" || !total) {
      fillGreen.style.width = "0%";
      fillYellow.style.width = "0%";
      fillRed.style.width = "0%";
      return;
    }

    const greenDuration = Math.max(0, total - 300);
    const yellowDuration = Math.max(0, Math.min(total, 300) - 30);
    const redDuration = Math.min(total, 30);

    progressGreen.style.display = greenDuration > 0 ? "" : "none";
    progressYellow.style.display = yellowDuration > 0 ? "" : "none";
    progressRed.style.display = redDuration > 0 ? "" : "none";

    progressGreen.style.width = (greenDuration / total * 100) + "%";
    progressYellow.style.width = (yellowDuration / total * 100) + "%";
    progressRed.style.width = (redDuration / total * 100) + "%";

    let greenFill = 0;
    let yellowFill = 0;
    let redFill = 0;

    if (greenDuration > 0) {
      greenFill = remaining > 300 ? (total - remaining) / greenDuration : 1;
    }
    if (yellowDuration > 0) {
      if (remaining > 300) {
        yellowFill = 0;
      } else if (remaining > 30) {
        yellowFill = (300 - remaining) / yellowDuration;
      } else {
        yellowFill = 1;
      }
    }
    if (redDuration > 0) {
      redFill = remaining > 30 ? 0 : (30 - remaining) / redDuration;
    }

    fillGreen.style.width = (Math.min(1, Math.max(0, greenFill)) * 100) + "%";
    fillYellow.style.width = (Math.min(1, Math.max(0, yellowFill)) * 100) + "%";
    fillRed.style.width = (Math.min(1, Math.max(0, redFill)) * 100) + "%";
  }

  function renderClock() {
    renderClockText(formatClock(new Date()));
    scheduleClockFit();
  }

  function renderCountdown() {
    countdownEl.textContent = formatCountdown(countdownSeconds);
  }

  function renderPauseUntil() {
    if (!countdownEndAt) {
      pauseUntilEl.textContent = "Pause bis --:--";
      return;
    }
    const rounded = new Date(countdownEndAt.getTime());
    const seconds = rounded.getSeconds();

    if (seconds > 20) {
      rounded.setMinutes(rounded.getMinutes() + 1);
    }

    rounded.setSeconds(0, 0);
    pauseUntilEl.textContent = "Pause bis " + [pad2(rounded.getHours()), pad2(rounded.getMinutes())].join(":");
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
    document.addEventListener("fullscreenchange", updateFullscreenClass);
    window.addEventListener("pageshow", updateFullscreenClass);
    window.addEventListener("resize", scheduleClockFit);
  }

  function init() {
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

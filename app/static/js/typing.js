(function () {
  "use strict";

  var passages = [
    "The quick brown fox jumps over the lazy dog. It is a well-known pangram, containing every letter of the English alphabet at least once. Typing it helps you practice your speed and accuracy.",
    "Technology is constantly evolving, shaping the way we live and work. From artificial intelligence to quantum computing, the future holds boundless possibilities. Staying updated with the latest trends is essential.",
    "A journey of a thousand miles begins with a single step. No matter how difficult the path may seem, consistent effort and determination will eventually lead you to success. Keep pushing forward.",
    "In the heart of the bustling city, neon lights illuminated the crowded streets. People hurried past each other, lost in their own thoughts and daily routines. The city never sleeps, they say.",
    "Nature has a profound impact on our well-being. A walk in the park or a hike in the mountains can reduce stress and improve mental health. We must protect our environment for future generations.",
    "Reading books expands your vocabulary and broadens your perspective. Whether it is fiction or non-fiction, every book offers a unique experience and a chance to learn something new about the world.",
    "Cooking is both an art and a science. Precise measurements combined with creative flavors can produce a memorable meal. Anyone can become a more confident cook through patient practice.",
    "Space exploration has always fascinated humanity. The idea of traveling to distant planets and discovering new galaxies captures our imagination and reminds us how vast the universe is."
  ];

  var container = document.getElementById("typing-app");
  if (!container || !window.ToolboxTypingCore) return;

  var durationSelect = document.getElementById("typing-duration");
  var timerDisplay = container.querySelector("[data-timer]");
  var passageContainer = container.querySelector("[data-passage]");
  var inputArea = document.getElementById("typing-input");
  var wpmDisplay = container.querySelector("[data-wpm]");
  var accuracyDisplay = container.querySelector("[data-accuracy]");
  var charsDisplay = container.querySelector("[data-chars]");
  var correctDisplay = container.querySelector("[data-correct]");
  var errorsDisplay = container.querySelector("[data-errors]");
  var statusDisplay = container.querySelector("[data-typing-status]");
  var startButton = container.querySelector("[data-start]");
  var retryButton = container.querySelector("[data-retry]");
  var resetButton = container.querySelector("[data-reset-test]");
  var completePanel = container.querySelector("[data-complete]");
  var completeSummary = container.querySelector("[data-complete-summary]");

  var currentPassage = "";
  var durationMs = 60000;
  var startedAt = 0;
  var deadline = 0;
  var timerInterval = null;
  var timerTimeout = null;
  var running = false;
  var finished = false;
  var finalElapsedMs = 0;

  function now() {
    return window.performance && performance.now ? performance.now() : Date.now();
  }

  function renderPassage(text) {
    passageContainer.replaceChildren();
    Array.prototype.forEach.call(text, function (character) {
      var span = document.createElement("span");
      span.textContent = character;
      passageContainer.appendChild(span);
    });
  }

  function clearTimers() {
    window.clearInterval(timerInterval);
    window.clearTimeout(timerTimeout);
    timerInterval = null;
    timerTimeout = null;
  }

  function elapsedTime() {
    if (finished) return finalElapsedMs;
    if (!running) return 0;
    return Math.min(durationMs, Math.max(0, now() - startedAt));
  }

  function updateStats() {
    var stats = window.ToolboxTypingCore.calculateStats(inputArea.value, currentPassage, elapsedTime());
    wpmDisplay.textContent = String(stats.wpm);
    accuracyDisplay.textContent = stats.accuracy + "%";
    charsDisplay.textContent = String(stats.total);
    correctDisplay.textContent = String(stats.correct);
    errorsDisplay.textContent = String(stats.incorrect);
    return stats;
  }

  function updatePassage() {
    var value = inputArea.value;
    passageContainer.querySelectorAll("span").forEach(function (span, index) {
      span.className = "";
      if (index < value.length) {
        span.classList.add(value[index] === currentPassage[index] ? "correct" : "incorrect");
      } else if (index === value.length && !finished) {
        span.classList.add("current");
      }
    });
  }

  function updateTimer() {
    if (!running || finished) return;
    var remainingMs = Math.max(0, deadline - now());
    timerDisplay.textContent = String(window.ToolboxTypingCore.remainingSeconds(deadline, now()));
    updateStats();
    if (remainingMs <= 0) endTest(true);
  }

  function beginTimer() {
    if (running || finished) return;
    running = true;
    startedAt = now();
    deadline = startedAt + durationMs;
    statusDisplay.textContent = "Typing test in progress.";
    timerInterval = window.setInterval(updateTimer, 100);
    timerTimeout = window.setTimeout(function () { endTest(true); }, durationMs);
  }

  function startTest() {
    clearTimers();
    running = false;
    finished = false;
    finalElapsedMs = 0;
    durationMs = parseInt(durationSelect.value, 10) * 1000;
    currentPassage = passages[Math.floor(Math.random() * passages.length)];
    renderPassage(currentPassage);
    inputArea.value = "";
    inputArea.disabled = false;
    durationSelect.disabled = true;
    timerDisplay.textContent = String(durationMs / 1000);
    startButton.hidden = true;
    retryButton.hidden = true;
    resetButton.hidden = false;
    completePanel.hidden = true;
    statusDisplay.textContent = "Ready. The timer starts with your first character.";
    updateStats();
    updatePassage();
    inputArea.focus();
  }

  function resetTest() {
    clearTimers();
    running = false;
    finished = false;
    finalElapsedMs = 0;
    currentPassage = "";
    inputArea.value = "";
    inputArea.disabled = true;
    durationSelect.disabled = false;
    timerDisplay.textContent = durationSelect.value;
    passageContainer.replaceChildren();
    startButton.hidden = false;
    retryButton.hidden = true;
    resetButton.hidden = true;
    completePanel.hidden = true;
    statusDisplay.textContent = "Choose a duration and press Start.";
    updateStats();
  }

  function endTest(expired) {
    if (finished) return;
    finalElapsedMs = running ? Math.min(durationMs, Math.max(1, now() - startedAt)) : 0;
    if (expired) finalElapsedMs = durationMs;
    finished = true;
    running = false;
    clearTimers();
    inputArea.disabled = true;
    timerDisplay.textContent = expired ? "0" : String(Math.max(0, Math.ceil((durationMs - finalElapsedMs) / 1000)));
    updatePassage();
    var stats = updateStats();
    completePanel.hidden = false;
    retryButton.hidden = false;
    resetButton.hidden = false;
    statusDisplay.textContent = "Typing test complete.";
    completeSummary.textContent = "You typed " + stats.wpm + " WPM with " + stats.accuracy + "% accuracy. " + stats.correct + " correct and " + stats.incorrect + " incorrect characters in " + (finalElapsedMs / 1000).toFixed(1) + " seconds.";
  }

  function handleInput() {
    if (finished) return;
    if (inputArea.value.length > currentPassage.length) inputArea.value = inputArea.value.slice(0, currentPassage.length);
    if (!running && inputArea.value.length > 0) beginTimer();
    updatePassage();
    updateStats();
    if (inputArea.value.length === currentPassage.length) endTest(false);
  }

  startButton.addEventListener("click", startTest);
  retryButton.addEventListener("click", startTest);
  resetButton.addEventListener("click", resetTest);
  inputArea.addEventListener("input", handleInput);
  inputArea.addEventListener("paste", function (event) { event.preventDefault(); });
  durationSelect.addEventListener("change", function () {
    if (!running && !finished) timerDisplay.textContent = durationSelect.value;
  });
  resetTest();
})();

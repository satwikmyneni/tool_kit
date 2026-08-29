(function (root, factory) {
  var common = root ? root.ClientCommon : require("./client-common.js");
  var api = factory(common);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.document) api.mount();
})(typeof window !== "undefined" ? window : null, function (C) {
  "use strict";

  function formatTime(milliseconds, showHours) {
    var totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    var hours = Math.floor(totalSeconds / 3600); var minutes = Math.floor(totalSeconds % 3600 / 60); var seconds = totalSeconds % 60;
    return (showHours || hours ? String(hours).padStart(2, "0") + ":" : "") + String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
  }

  function validOptions(text) { return String(text).split(/\r?\n/).map(function (item) { return item.trim(); }).filter(Boolean); }
  function newId() { return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + "-" + C.secureInt(0, 1000000); }

  function mountTimer(ui, slug) {
    var interval = null; var running = false; var endAt = 0; var elapsed = 0; var startedAt = 0; var laps = []; var phase = "Focus"; var rounds = 0;
    if (slug === "stopwatch") {
      ui.app.innerHTML = '<div class="timer-display" data-display>00:00:00</div><div class="tool-actions"><button class="btn btn-primary" type="button" data-start>Start</button><button class="btn btn-secondary" type="button" data-lap disabled>Lap</button><button class="btn btn-ghost" type="button" data-reset>Reset</button></div><ol class="plain-list" data-laps></ol>';
      var display = ui.app.querySelector("[data-display]"); var start = ui.app.querySelector("[data-start]"); var lap = ui.app.querySelector("[data-lap]");
      function tick() { display.textContent = formatTime(elapsed + (running ? performance.now() - startedAt : 0), true); }
      start.onclick = function () { if (running) { elapsed += performance.now() - startedAt; running = false; clearInterval(interval); start.textContent = "Resume"; lap.disabled = true; tick(); } else { startedAt = performance.now(); running = true; interval = setInterval(tick, 100); start.textContent = "Pause"; lap.disabled = false; } };
      lap.onclick = function () { var value = elapsed + (running ? performance.now() - startedAt : 0); laps.push(value); ui.app.querySelector("[data-laps]").innerHTML = laps.map(function (time, index) { return "<li>Lap " + (index + 1) + ": " + formatTime(time, true) + "</li>"; }).join(""); };
      ui.app.querySelector("[data-reset]").onclick = function () { clearInterval(interval); running = false; elapsed = 0; laps = []; start.textContent = "Start"; lap.disabled = true; ui.app.querySelector("[data-laps]").innerHTML = ""; tick(); ui.clear(); };
      return;
    }

    var pomodoro = slug === "pomodoro-timer";
    ui.app.innerHTML = '<form><div class="field-grid"><div class="field"><label class="field-label" for="minutes">' + (pomodoro ? "Focus minutes" : "Minutes") + '</label><input class="field-input" id="minutes" type="number" min="1" max="180" value="' + (pomodoro ? 25 : 10) + '"></div>' + (pomodoro ? '<div class="field"><label class="field-label" for="break-minutes">Break minutes</label><input class="field-input" id="break-minutes" type="number" min="1" max="60" value="5"></div>' : '<div class="field"><label class="field-label" for="seconds">Seconds</label><input class="field-input" id="seconds" type="number" min="0" max="59" value="0"></div>') + '</div></form><p class="muted" data-phase>' + (pomodoro ? "Focus · round 1" : "Ready") + '</p><div class="timer-display" data-display>' + (pomodoro ? "25:00" : "10:00") + '</div><div class="tool-actions"><button class="btn btn-primary" type="button" data-start>Start</button><button class="btn btn-ghost" type="button" data-reset>Reset</button></div>';
    var timerDisplay = ui.app.querySelector("[data-display]"); var timerStart = ui.app.querySelector("[data-start]"); var phaseText = ui.app.querySelector("[data-phase]");
    function configuredMilliseconds() { var minutes = Math.max(1, Math.min(180, Number(document.getElementById(phase === "Break" ? "break-minutes" : "minutes").value) || 1)); var seconds = pomodoro ? 0 : Math.max(0, Math.min(59, Number(document.getElementById("seconds").value) || 0)); return (minutes * 60 + seconds) * 1000; }
    function resetTimer() { clearInterval(interval); running = false; phase = "Focus"; timerStart.textContent = "Start"; timerDisplay.textContent = formatTime(configuredMilliseconds(), false); phaseText.textContent = pomodoro ? "Focus · round " + (rounds + 1) : "Ready"; }
    function complete() {
      clearInterval(interval); running = false;
      if (pomodoro) { if (phase === "Focus") { rounds += 1; phase = "Break"; } else phase = "Focus"; phaseText.textContent = phase + " · round " + (rounds + (phase === "Focus" ? 1 : 0)); endAt = Date.now() + configuredMilliseconds(); running = true; interval = setInterval(tick, 250); }
      else { timerDisplay.textContent = "00:00"; timerStart.textContent = "Start again"; phaseText.textContent = "Time is up ✓"; ui.showHTML("<h2>Countdown complete</h2><p>Time is up.</p>"); }
    }
    function tick() { var left = endAt - Date.now(); if (left <= 0) complete(); else timerDisplay.textContent = formatTime(left, false); }
    timerStart.onclick = function () { if (running) { var left = endAt - Date.now(); clearInterval(interval); running = false; elapsed = Math.max(0, left); timerStart.textContent = "Resume"; } else { endAt = Date.now() + (elapsed || configuredMilliseconds()); elapsed = 0; running = true; interval = setInterval(tick, 250); timerStart.textContent = "Pause"; phaseText.textContent = pomodoro ? phase + " · round " + (rounds + (phase === "Focus" ? 1 : 0)) : "Running"; } };
    ui.app.querySelector("[data-reset]").onclick = function () { rounds = 0; elapsed = 0; resetTimer(); ui.clear(); };
    ui.app.querySelector("form").addEventListener("input", function () { if (!running) resetTimer(); });
  }

  function mountTodo(ui) {
    var key = "toolbox_productivity_todos"; var tasks = C.readJSON(key, []); if (!Array.isArray(tasks)) tasks = [];
    ui.app.innerHTML = '<form><div class="field"><label class="field-label" for="task">New task</label><input class="field-input" id="task" maxlength="200" required></div><div class="tool-actions"><button class="btn btn-primary" type="submit">Add task</button><button class="btn btn-ghost" type="button" data-clear>Clear completed</button></div></form><ul class="plain-list interactive-list" data-list></ul><p class="muted" data-empty>No tasks yet.</p>';
    function save() { C.writeJSON(key, tasks); }
    function render() { var list = ui.app.querySelector("[data-list]"); list.innerHTML = ""; tasks.forEach(function (task) { var li = document.createElement("li"); var label = document.createElement("label"); var box = document.createElement("input"); box.type = "checkbox"; box.checked = Boolean(task.done); box.onchange = function () { task.done = box.checked; save(); render(); }; var text = document.createElement("span"); text.textContent = task.text; if (task.done) text.className = "completed"; var remove = document.createElement("button"); remove.type = "button"; remove.className = "btn btn-ghost"; remove.textContent = "Remove"; remove.onclick = function () { tasks = tasks.filter(function (item) { return item.id !== task.id; }); save(); render(); }; label.append(box, text); li.append(label, remove); list.appendChild(li); }); ui.app.querySelector("[data-empty]").hidden = tasks.length > 0; }
    ui.app.querySelector("form").onsubmit = function (event) { event.preventDefault(); var input = document.getElementById("task"); var text = input.value.trim(); if (!text) return; tasks.push({ id: newId(), text: text, done: false }); input.value = ""; save(); render(); };
    ui.app.querySelector("[data-clear]").onclick = function () { tasks = tasks.filter(function (task) { return !task.done; }); save(); render(); };
    render();
  }

  function mountNotes(ui) {
    var key = "toolbox_productivity_notes"; var saved = C.readJSON(key, { text: "", updated: 0 }); if (!saved || typeof saved.text !== "string") saved = { text: "", updated: 0 };
    ui.app.innerHTML = '<div class="field"><label class="field-label" for="notes-input">Private note</label><textarea class="field-textarea notes-area" id="notes-input" placeholder="Start writing…"></textarea><p class="field-hint" data-status>Saved locally</p></div><div class="tool-actions"><button class="btn btn-ghost" type="button" data-clear>Clear note</button></div>';
    var input = document.getElementById("notes-input"); input.value = saved.text; var timeout;
    input.oninput = function () { clearTimeout(timeout); ui.app.querySelector("[data-status]").textContent = "Saving…"; timeout = setTimeout(function () { C.writeJSON(key, { text: input.value, updated: Date.now() }); ui.app.querySelector("[data-status]").textContent = "Saved locally"; }, 250); };
    ui.app.querySelector("[data-clear]").onclick = function () { input.value = ""; C.writeJSON(key, { text: "", updated: Date.now() }); ui.app.querySelector("[data-status]").textContent = "Note cleared"; };
  }

  function mountHabits(ui) {
    var key = "toolbox_productivity_habits"; var habits = C.readJSON(key, []); if (!Array.isArray(habits)) habits = [];
    ui.app.innerHTML = '<form><div class="field"><label class="field-label" for="habit">Habit name</label><input class="field-input" id="habit" maxlength="80" required></div><button class="btn btn-primary" type="submit">Add habit</button></form><div class="habit-grid" data-list></div><p class="muted" data-empty>No habits yet.</p>';
    function save() { C.writeJSON(key, habits); }
    function render() { var list = ui.app.querySelector("[data-list]"); list.innerHTML = ""; habits.forEach(function (habit) { var card = document.createElement("div"); card.className = "stat-card"; var name = document.createElement("strong"); name.textContent = habit.name; var count = document.createElement("div"); count.className = "stat-value"; count.textContent = habit.count; var add = document.createElement("button"); add.className = "btn btn-primary"; add.type = "button"; add.textContent = "+1"; add.onclick = function () { habit.count += 1; save(); render(); }; var subtract = document.createElement("button"); subtract.className = "btn btn-ghost"; subtract.type = "button"; subtract.textContent = "−1"; subtract.disabled = habit.count === 0; subtract.onclick = function () { habit.count = Math.max(0, habit.count - 1); save(); render(); }; var remove = document.createElement("button"); remove.className = "btn btn-ghost"; remove.type = "button"; remove.textContent = "Remove"; remove.onclick = function () { habits = habits.filter(function (item) { return item.id !== habit.id; }); save(); render(); }; card.append(name, count, add, subtract, remove); list.appendChild(card); }); ui.app.querySelector("[data-empty]").hidden = habits.length > 0; }
    ui.app.querySelector("form").onsubmit = function (event) { event.preventDefault(); var input = document.getElementById("habit"); var name = input.value.trim(); if (!name) return; habits.push({ id: newId(), name: name, count: 0 }); input.value = ""; save(); render(); };
    render();
  }

  function mountPicker(ui, decision) {
    ui.app.innerHTML = '<form><div class="field"><label class="field-label" for="options">Options (one per line)</label><textarea class="field-textarea" id="options" placeholder="Option one\nOption two"></textarea></div><div class="tool-actions"><button class="btn btn-primary" type="submit">' + (decision ? "Make decision" : "Pick one") + '</button><button class="btn btn-ghost" type="reset">Reset</button></div></form>';
    if (decision) document.getElementById("options").value = "Yes\nNo";
    var form = ui.app.querySelector("form"); form.onsubmit = function (event) { event.preventDefault(); try { var items = validOptions(document.getElementById("options").value); ui.showHTML('<h2>' + (decision ? "Decision" : "Selected item") + '</h2><p class="client-result-value">' + C.escapeHTML(C.secureChoice(items)) + '</p><p class="field-hint">Chosen with browser cryptographic randomness.</p>'); } catch (error) { ui.showError(error.message); } }; form.onreset = function () { setTimeout(ui.clear, 0); };
  }

  function mount() {
    var ui = C.initialize(); if (!ui || ui.root.dataset.toolGroup !== "productivity") return;
    if (["pomodoro-timer", "stopwatch", "countdown-timer"].indexOf(ui.slug) !== -1) mountTimer(ui, ui.slug);
    else if (ui.slug === "to-do-list") mountTodo(ui);
    else if (ui.slug === "notes") mountNotes(ui);
    else if (ui.slug === "habit-counter") mountHabits(ui);
    else if (ui.slug === "random-picker") mountPicker(ui, false);
    else if (ui.slug === "decision-maker") mountPicker(ui, true);
  }

  return { formatTime: formatTime, validOptions: validOptions, mount: mount };
});

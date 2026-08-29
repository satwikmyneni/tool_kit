(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ToolboxTypingCore = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function calculateStats(typed, passage, elapsedMs) {
    var value = String(typed || "");
    var source = String(passage || "");
    var correct = 0;
    for (var index = 0; index < value.length; index += 1) {
      if (value[index] === source[index]) correct += 1;
    }
    var total = value.length;
    var incorrect = Math.max(0, total - correct);
    var accuracy = total ? Math.round((correct / total) * 100) : 100;
    var minutes = Math.max(0, Number(elapsedMs) || 0) / 60000;
    var wpm = minutes > 0 ? Math.round((total / 5) / minutes) : 0;
    return { wpm: wpm, accuracy: accuracy, total: total, correct: correct, incorrect: incorrect };
  }

  function remainingSeconds(deadlineMs, currentMs) {
    return Math.max(0, Math.ceil((Number(deadlineMs) - Number(currentMs)) / 1000));
  }

  return { calculateStats: calculateStats, remainingSeconds: remainingSeconds };
});

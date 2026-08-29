(function (root, factory) {
  var common = root ? root.ClientCommon : require("./client-common.js");
  var api = factory(common);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.document) api.mount();
})(typeof window !== "undefined" ? window : null, function (C) {
  "use strict";

  var LOREM = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat".split(" ");

  function analyze(text) {
    var trimmed = String(text || "").trim();
    var words = trimmed ? (trimmed.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || []).length : 0;
    var sentences = trimmed ? (trimmed.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || []).length : 0;
    var paragraphs = trimmed ? trimmed.split(/\n\s*\n/).filter(function (item) { return item.trim(); }).length : 0;
    return {
      words: words,
      characters: String(text || "").length,
      charactersNoSpaces: String(text || "").replace(/\s/g, "").length,
      sentences: sentences,
      paragraphs: paragraphs,
      readingMinutes: words ? Math.max(1, Math.ceil(words / 200)) : 0
    };
  }

  function titleCase(text) {
    return String(text).toLocaleLowerCase().replace(/(^|[^\p{L}\p{N}])([\p{L}])/gu, function (_all, prefix, letter) { return prefix + letter.toLocaleUpperCase(); });
  }

  function sentenceCase(text) {
    var lower = String(text).toLocaleLowerCase();
    return lower.replace(/(^\s*|[.!?]\s+)([\p{L}])/gu, function (_all, prefix, letter) { return prefix + letter.toLocaleUpperCase(); });
  }

  function clean(text, operation, find, replacement) {
    var value = String(text);
    if (operation === "trim") return value.trim();
    if (operation === "dedupe") {
      var seen = new Set();
      return value.split(/\r?\n/).filter(function (line) { if (seen.has(line)) return false; seen.add(line); return true; }).join("\n");
    }
    if (operation === "sort") return value.split(/\r?\n/).sort(function (a, b) { return a.localeCompare(b); }).join("\n");
    if (operation === "reverse-lines") return value.split(/\r?\n/).reverse().join("\n");
    if (operation === "reverse-text") return Array.from(value).reverse().join("");
    if (operation === "empty") return value.split(/\r?\n/).filter(function (line) { return line.trim(); }).join("\n");
    if (operation === "spaces") return value.replace(/[\t ]+/g, " ").replace(/ *\n */g, "\n").trim();
    if (operation === "replace") {
      if (!find) throw new Error("Enter text to find.");
      return value.split(find).join(replacement || "");
    }
    return value;
  }

  function diffLines(left, right) {
    var a = String(left).split(/\r?\n/);
    var b = String(right).split(/\r?\n/);
    var length = Math.max(a.length, b.length);
    var changes = [];
    for (var index = 0; index < length; index += 1) {
      if (a[index] !== b[index]) changes.push({ line: index + 1, left: a[index] === undefined ? "" : a[index], right: b[index] === undefined ? "" : b[index] });
    }
    return changes;
  }

  function lorem(paragraphs, words) {
    paragraphs = Math.max(1, Math.min(20, Number(paragraphs) || 1));
    words = Math.max(5, Math.min(300, Number(words) || 50));
    var output = [];
    for (var p = 0; p < paragraphs; p += 1) {
      var selected = [];
      for (var i = 0; i < words; i += 1) selected.push(LOREM[i % LOREM.length]);
      var line = selected.join(" ");
      output.push(line.charAt(0).toUpperCase() + line.slice(1) + ".");
    }
    return output.join("\n\n");
  }

  function markdown(value) {
    var lines = C.escapeHTML(value).split(/\r?\n/);
    var inList = false;
    var html = [];
    function inline(line) {
      return line.replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>")
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
    }
    lines.forEach(function (line) {
      var listMatch = line.match(/^[-*]\s+(.+)/);
      if (listMatch) {
        if (!inList) { html.push("<ul>"); inList = true; }
        html.push("<li>" + inline(listMatch[1]) + "</li>");
        return;
      }
      if (inList) { html.push("</ul>"); inList = false; }
      var heading = line.match(/^(#{1,3})\s+(.+)/);
      if (heading) html.push("<h" + heading[1].length + ">" + inline(heading[2]) + "</h" + heading[1].length + ">");
      else if (line.trim()) html.push("<p>" + inline(line) + "</p>");
    });
    if (inList) html.push("</ul>");
    return html.join("");
  }

  function textarea(id, label, placeholder) {
    return '<div class="field"><label class="field-label" for="' + id + '">' + label + '</label><textarea class="field-textarea" id="' + id + '" placeholder="' + placeholder + '"></textarea></div>';
  }

  function actions(label) {
    return '<div class="tool-actions"><button class="btn btn-primary" type="submit">' + label + '</button><button class="btn btn-ghost" type="reset">Reset</button></div>';
  }

  function mount() {
    var ui = C.initialize();
    if (!ui || ui.root.dataset.toolGroup !== "text") return;
    var slug = ui.slug;
    if (slug === "text-analyzer") {
      ui.app.innerHTML = '<form>' + textarea("text-input", "Text", "Paste or type text to analyze") + actions("Analyze text") + '</form>';
      ui.app.querySelector("form").addEventListener("submit", function (event) {
        event.preventDefault(); var stats = analyze(document.getElementById("text-input").value);
        ui.showHTML('<h2>Text statistics</h2><div class="stat-grid">' + Object.keys(stats).map(function (key) { return '<div class="stat-card"><span>' + C.escapeHTML(key.replace(/([A-Z])/g, " $1")) + '</span><div class="stat-value">' + stats[key] + '</div></div>'; }).join("") + '</div>');
      });
    } else if (slug === "case-converter") {
      ui.app.innerHTML = '<form>' + textarea("text-input", "Text", "Enter text to convert") + '<div class="field"><label class="field-label" for="case-mode">Case</label><select class="field-select" id="case-mode"><option value="upper">UPPERCASE</option><option value="lower">lowercase</option><option value="title">Title Case</option><option value="sentence">Sentence case</option></select></div>' + actions("Convert") + '</form>';
      ui.app.querySelector("form").addEventListener("submit", function (event) { event.preventDefault(); var value = document.getElementById("text-input").value; var mode = document.getElementById("case-mode").value; ui.showText(mode === "upper" ? value.toLocaleUpperCase() : mode === "lower" ? value.toLocaleLowerCase() : mode === "title" ? titleCase(value) : sentenceCase(value), "Converted text"); });
    } else if (slug === "text-cleaner") {
      ui.app.innerHTML = '<form>' + textarea("text-input", "Text", "Enter text to clean") + '<div class="field-grid"><div class="field"><label class="field-label" for="clean-mode">Action</label><select class="field-select" id="clean-mode"><option value="trim">Trim ends</option><option value="dedupe">Remove duplicate lines</option><option value="sort">Sort lines</option><option value="reverse-lines">Reverse line order</option><option value="reverse-text">Reverse text</option><option value="empty">Remove empty lines</option><option value="spaces">Remove extra spaces</option><option value="replace">Find and replace</option></select></div><div class="field"><label class="field-label" for="find-text">Find</label><input class="field-input" id="find-text"></div><div class="field"><label class="field-label" for="replace-text">Replace with</label><input class="field-input" id="replace-text"></div></div>' + actions("Clean text") + '</form>';
      ui.app.querySelector("form").addEventListener("submit", function (event) { event.preventDefault(); try { ui.showText(clean(document.getElementById("text-input").value, document.getElementById("clean-mode").value, document.getElementById("find-text").value, document.getElementById("replace-text").value), "Cleaned text"); } catch (error) { ui.showError(error.message); } });
    } else if (slug === "text-diff") {
      ui.app.innerHTML = '<form><div class="content-grid">' + textarea("left-text", "Original text", "Original") + textarea("right-text", "Changed text", "Changed") + '</div>' + actions("Compare text") + '</form>';
      ui.app.querySelector("form").addEventListener("submit", function (event) { event.preventDefault(); var changes = diffLines(document.getElementById("left-text").value, document.getElementById("right-text").value); if (!changes.length) return ui.showHTML("<h2>No differences</h2><p>The two texts are identical.</p>"); ui.showText(changes.map(function (item) { return "Line " + item.line + "\n− " + item.left + "\n+ " + item.right; }).join("\n\n"), changes.length + " changed line" + (changes.length === 1 ? "" : "s")); });
    } else if (slug === "lorem-ipsum-generator") {
      ui.app.innerHTML = '<form><div class="field-grid"><div class="field"><label class="field-label" for="paragraphs">Paragraphs</label><input class="field-input" id="paragraphs" type="number" min="1" max="20" value="3"></div><div class="field"><label class="field-label" for="words">Words per paragraph</label><input class="field-input" id="words" type="number" min="5" max="300" value="50"></div></div>' + actions("Generate text") + '</form>';
      ui.app.querySelector("form").addEventListener("submit", function (event) { event.preventDefault(); ui.showText(lorem(document.getElementById("paragraphs").value, document.getElementById("words").value), "Generated text"); });
    } else if (slug === "markdown-previewer") {
      ui.app.innerHTML = '<form>' + textarea("text-input", "Markdown", "# Heading\n\nWrite **bold** text") + actions("Preview Markdown") + '</form>';
      ui.app.querySelector("form").addEventListener("submit", function (event) { event.preventDefault(); ui.showHTML('<h2>Preview</h2><div class="markdown-preview">' + markdown(document.getElementById("text-input").value) + '</div>'); });
    }
    var form = ui.app.querySelector("form");
    if (form) form.addEventListener("reset", function () { setTimeout(ui.clear, 0); });
  }

  return { analyze: analyze, titleCase: titleCase, sentenceCase: sentenceCase, clean: clean, diffLines: diffLines, lorem: lorem, markdown: markdown, mount: mount };
});

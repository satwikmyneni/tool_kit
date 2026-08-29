(function (root, factory) {
  var common = root ? root.ClientCommon : require("./client-common.js");
  var api = factory(common);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.document) api.mount();
})(typeof window !== "undefined" ? window : null, function (C) {
  "use strict";

  var SETS = {
    lower: "abcdefghijklmnopqrstuvwxyz",
    upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    numbers: "0123456789",
    symbols: "!@#$%^&*()-_=+[]{};:,.?"
  };
  var AMBIGUOUS = /[Il1O0o|`'"{}\[\](),.;:]/g;
  var ADJECTIVES = ["bright", "calm", "clever", "cosmic", "gentle", "lucky", "mellow", "nimble", "quiet", "rapid", "silver", "vivid"];
  var NOUNS = ["badger", "comet", "falcon", "forest", "harbor", "maple", "otter", "pixel", "river", "sparrow", "summit", "willow"];

  function randomString(length, characters) {
    length = Number(length);
    if (!Number.isInteger(length) || length < 1 || length > 512) throw new Error("Length must be between 1 and 512.");
    if (!characters) throw new Error("Choose at least one character set.");
    var output = "";
    for (var i = 0; i < length; i += 1) output += characters[C.secureInt(0, characters.length - 1)];
    return output;
  }

  function password(options) {
    var pools = [];
    ["lower", "upper", "numbers", "symbols"].forEach(function (key) {
      if (options[key]) {
        var value = options.ambiguous ? SETS[key].replace(AMBIGUOUS, "") : SETS[key];
        if (value) pools.push(value);
      }
    });
    if (!pools.length) throw new Error("Choose at least one character set.");
    var length = Number(options.length);
    if (!Number.isInteger(length) || length < Math.max(4, pools.length) || length > 128) throw new Error("Choose a length between " + Math.max(4, pools.length) + " and 128.");
    var chars = pools.map(function (pool) { return C.secureChoice(pool.split("")); });
    var all = pools.join("");
    while (chars.length < length) chars.push(C.secureChoice(all.split("")));
    for (var i = chars.length - 1; i > 0; i -= 1) { var j = C.secureInt(0, i); var temp = chars[i]; chars[i] = chars[j]; chars[j] = temp; }
    return chars.join("");
  }

  function uuidV4() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    var bytes = new Uint8Array(16); crypto.getRandomValues(bytes); bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    var hex = Array.from(bytes).map(function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
    return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
  }

  function actions(label) { return '<div class="tool-actions"><button class="btn btn-primary" type="submit">' + label + '</button><button class="btn btn-secondary" type="button" data-copy hidden>Copy</button><button class="btn btn-ghost" type="reset">Reset</button></div>'; }
  function numberField(id, label, min, max, value) { return '<div class="field"><label class="field-label" for="' + id + '">' + label + '</label><input class="field-input" id="' + id + '" type="number" min="' + min + '" max="' + max + '" value="' + value + '"></div>'; }

  function mount() {
    var ui = C.initialize(); if (!ui || ui.root.dataset.toolGroup !== "generator") return;
    var slug = ui.slug; var form; var lastOutput = "";
    if (slug === "password-generator") {
      ui.app.innerHTML = '<form>' + numberField("length", "Password length", 4, 128, 20) + '<fieldset class="option-group"><legend>Character sets</legend><label><input type="checkbox" id="lower" checked> Lowercase</label><label><input type="checkbox" id="upper" checked> Uppercase</label><label><input type="checkbox" id="numbers" checked> Numbers</label><label><input type="checkbox" id="symbols" checked> Symbols</label><label><input type="checkbox" id="ambiguous"> Exclude ambiguous characters</label></fieldset>' + actions("Generate password") + '</form>';
      form = ui.app.querySelector("form"); form.addEventListener("submit", function (event) { event.preventDefault(); try { show(password({ length: document.getElementById("length").value, lower: document.getElementById("lower").checked, upper: document.getElementById("upper").checked, numbers: document.getElementById("numbers").checked, symbols: document.getElementById("symbols").checked, ambiguous: document.getElementById("ambiguous").checked }), "Generated password"); } catch (error) { ui.showError(error.message); } });
    } else if (slug === "username-generator") {
      ui.app.innerHTML = '<form><div class="field-grid">' + numberField("count", "Ideas", 1, 30, 8) + '<div class="field"><label class="field-label" for="separator">Separator</label><select class="field-select" id="separator"><option value="">None</option><option value="_">Underscore</option><option value="-">Hyphen</option><option value=".">Dot</option></select></div><div class="field"><label><input type="checkbox" id="suffix" checked> Add number</label></div></div>' + actions("Generate usernames") + '</form>';
      form = ui.app.querySelector("form"); form.addEventListener("submit", function (event) { event.preventDefault(); var count = Math.max(1, Math.min(30, Number(document.getElementById("count").value) || 8)); var separator = document.getElementById("separator").value; var addNumber = document.getElementById("suffix").checked; var items = []; for (var i = 0; i < count; i += 1) items.push(C.secureChoice(ADJECTIVES) + separator + C.secureChoice(NOUNS) + (addNumber ? C.secureInt(10, 9999) : "")); show(items.join("\n"), "Username ideas"); });
    } else if (slug === "uuid-generator") {
      ui.app.innerHTML = '<form>' + numberField("count", "UUIDs", 1, 100, 5) + actions("Generate UUIDs") + '</form>';
      form = ui.app.querySelector("form"); form.addEventListener("submit", function (event) { event.preventDefault(); var count = Math.max(1, Math.min(100, Number(document.getElementById("count").value) || 1)); var values = []; for (var i = 0; i < count; i += 1) values.push(uuidV4()); show(values.join("\n"), "UUID v4 values"); });
    } else if (slug === "random-number-generator") {
      ui.app.innerHTML = '<form><div class="field-grid">' + numberField("min", "Minimum", -2147483648, 2147483647, 1) + numberField("max", "Maximum", -2147483648, 2147483647, 100) + numberField("count", "How many", 1, 100, 1) + '</div>' + actions("Generate numbers") + '</form>';
      form = ui.app.querySelector("form"); form.addEventListener("submit", function (event) { event.preventDefault(); try { var count = Math.max(1, Math.min(100, Number(document.getElementById("count").value) || 1)); var values = []; for (var i = 0; i < count; i += 1) values.push(C.secureInt(Number(document.getElementById("min").value), Number(document.getElementById("max").value))); show(values.join("\n"), "Random number" + (count === 1 ? "" : "s")); } catch (error) { ui.showError(error.message); } });
    } else if (slug === "random-string-generator") {
      ui.app.innerHTML = '<form>' + numberField("length", "String length", 1, 512, 32) + '<fieldset class="option-group"><legend>Characters</legend><label><input type="checkbox" id="lower" checked> Lowercase</label><label><input type="checkbox" id="upper" checked> Uppercase</label><label><input type="checkbox" id="numbers" checked> Numbers</label><label><input type="checkbox" id="symbols"> Symbols</label></fieldset>' + actions("Generate string") + '</form>';
      form = ui.app.querySelector("form"); form.addEventListener("submit", function (event) { event.preventDefault(); try { var chars = ["lower", "upper", "numbers", "symbols"].filter(function (key) { return document.getElementById(key).checked; }).map(function (key) { return SETS[key]; }).join(""); show(randomString(document.getElementById("length").value, chars), "Random string"); } catch (error) { ui.showError(error.message); } });
    } else if (slug === "color-palette-generator") {
      ui.app.innerHTML = '<form><div class="field-grid">' + numberField("count", "Colors", 3, 12, 5) + '<div class="field"><label class="field-label" for="style">Harmony</label><select class="field-select" id="style"><option value="analogous">Analogous</option><option value="complementary">Complementary</option><option value="even">Evenly spaced</option></select></div></div>' + actions("Generate palette") + '</form>';
      form = ui.app.querySelector("form"); form.addEventListener("submit", function (event) { event.preventDefault(); var count = Math.max(3, Math.min(12, Number(document.getElementById("count").value) || 5)); var base = C.secureInt(0, 359); var style = document.getElementById("style").value; var colors = []; for (var i = 0; i < count; i += 1) { var offset = style === "analogous" ? (i - (count - 1) / 2) * 24 : style === "complementary" ? (i % 2) * 180 + Math.floor(i / 2) * 15 : i * (360 / count); colors.push("hsl(" + Math.round((base + offset + 360) % 360) + ", 68%, " + (42 + (i % 3) * 8) + "%)"); } lastOutput = colors.join("\n"); ui.showHTML('<h2>Generated palette</h2><div class="palette">' + colors.map(function (color) { return '<div class="palette-swatch" style="background:' + color + '"><span>' + color + '</span></div>'; }).join("") + '</div>'); enableCopy(); });
    } else if (slug === "gradient-generator") {
      ui.app.innerHTML = '<form><div class="field-grid"><div class="field"><label class="field-label" for="color-one">Start color</label><input class="field-input" id="color-one" type="color" value="#176b52"></div><div class="field"><label class="field-label" for="color-two">End color</label><input class="field-input" id="color-two" type="color" value="#6bd3ae"></div>' + numberField("angle", "Angle", 0, 360, 135) + '</div>' + actions("Build gradient") + '</form>';
      form = ui.app.querySelector("form"); form.addEventListener("submit", function (event) { event.preventDefault(); var css = "linear-gradient(" + Number(document.getElementById("angle").value) + "deg, " + document.getElementById("color-one").value + ", " + document.getElementById("color-two").value + ")"; lastOutput = "background: " + css + ";"; ui.showHTML('<h2>Gradient preview</h2><div class="color-preview" style="background:' + css + '"></div><pre class="client-tool-output">' + lastOutput + '</pre>'); enableCopy(); });
    } else if (slug === "favicon-generator") {
      ui.app.innerHTML = '<form><div class="field-grid"><div class="field"><label class="field-label" for="favicon-text">Text (1–3 characters)</label><input class="field-input" id="favicon-text" maxlength="3" value="TB"></div><div class="field"><label class="field-label" for="background">Background</label><input class="field-input" id="background" type="color" value="#176b52"></div><div class="field"><label class="field-label" for="foreground">Text color</label><input class="field-input" id="foreground" type="color" value="#ffffff"></div></div>' + actions("Create favicon") + '</form>';
      form = ui.app.querySelector("form"); form.addEventListener("submit", function (event) { event.preventDefault(); var text = document.getElementById("favicon-text").value.trim(); if (!text) return ui.showError("Enter one to three characters."); var canvas = document.createElement("canvas"); canvas.width = canvas.height = 512; var context = canvas.getContext("2d"); context.fillStyle = document.getElementById("background").value; context.fillRect(0, 0, 512, 512); context.fillStyle = document.getElementById("foreground").value; context.font = "bold " + (text.length > 2 ? 210 : 270) + "px system-ui"; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(text, 256, 270); var url = canvas.toDataURL("image/png"); ui.showHTML('<h2>Favicon preview</h2><img class="favicon-preview" src="' + url + '" alt="Generated favicon"><div class="tool-actions"><a class="btn btn-primary" href="' + url + '" download="toolbox-favicon.png">Download PNG</a></div>'); if (window.ToolboxAnalytics) window.ToolboxAnalytics.track("download", { tool: slug }); });
    }

    function show(value, label) { lastOutput = value; ui.showText(value, label); enableCopy(); }
    function enableCopy() { var button = ui.app.querySelector("[data-copy]"); if (!button) return; button.hidden = false; button.onclick = function () { C.copyText(lastOutput, button).catch(function (error) { ui.showError(error.message); }); }; }
    if (form) form.addEventListener("reset", function () { setTimeout(ui.clear, 0); });
  }

  return { randomString: randomString, password: password, uuidV4: uuidV4, mount: mount };
});

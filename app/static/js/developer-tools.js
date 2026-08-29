(function (root, factory) {
  var common = root ? root.ClientCommon : require("./client-common.js");
  var api = factory(common);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.document) api.mount();
})(typeof window !== "undefined" ? window : null, function (C) {
  "use strict";

  function utf8ToBase64(value) {
    var bytes = new TextEncoder().encode(String(value));
    var binary = "";
    bytes.forEach(function (byte) { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function base64ToUtf8(value) {
    var normalized = String(value).trim().replace(/\s/g, "");
    var binary = atob(normalized);
    var bytes = Uint8Array.from(binary, function (char) { return char.charCodeAt(0); });
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }

  function parseJSON(value) {
    try { return { value: JSON.parse(value), error: null }; }
    catch (error) {
      var match = String(error.message).match(/position\s+(\d+)/i);
      var location = "";
      if (match) {
        var position = Number(match[1]);
        var prefix = String(value).slice(0, position).split("\n");
        location = " (line " + prefix.length + ", column " + (prefix[prefix.length - 1].length + 1) + ")";
      }
      return { value: null, error: error.message + location };
    }
  }

  function decodeJWT(token) {
    var parts = String(token).trim().split(".");
    if (parts.length !== 3) throw new Error("A JWT must contain three dot-separated parts.");
    function decodePart(part) {
      var base64 = part.replace(/-/g, "+").replace(/_/g, "/");
      while (base64.length % 4) base64 += "=";
      return JSON.parse(base64ToUtf8(base64));
    }
    return { header: decodePart(parts[0]), payload: decodePart(parts[1]) };
  }

  function parseColor(input) {
    var value = String(input).trim().toLowerCase();
    var r, g, b;
    var hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    var rgb = value.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    var hsl = value.match(/^hsl\(\s*(-?[\d.]+)(?:deg)?\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/i);
    if (hex) {
      var chars = hex[1].length === 3 ? hex[1].split("").map(function (char) { return char + char; }).join("") : hex[1];
      r = parseInt(chars.slice(0, 2), 16); g = parseInt(chars.slice(2, 4), 16); b = parseInt(chars.slice(4, 6), 16);
    } else if (rgb) {
      r = Number(rgb[1]); g = Number(rgb[2]); b = Number(rgb[3]);
      if ([r, g, b].some(function (item) { return item > 255; })) throw new Error("RGB channels must be between 0 and 255.");
    } else if (hsl) {
      var hue = ((Number(hsl[1]) % 360) + 360) % 360;
      var sat = Number(hsl[2]) / 100; var light = Number(hsl[3]) / 100;
      if (sat > 1 || light > 1) throw new Error("HSL saturation and lightness must be 0–100%.");
      var chroma = (1 - Math.abs(2 * light - 1)) * sat;
      var x = chroma * (1 - Math.abs((hue / 60) % 2 - 1)); var m = light - chroma / 2;
      var channels = hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x] : hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x];
      r = Math.round((channels[0] + m) * 255); g = Math.round((channels[1] + m) * 255); b = Math.round((channels[2] + m) * 255);
    } else throw new Error("Enter HEX, rgb(r,g,b), or hsl(h,s%,l%).");
    var max = Math.max(r, g, b) / 255; var min = Math.min(r, g, b) / 255; var delta = max - min;
    var outHue = delta === 0 ? 0 : max === r / 255 ? 60 * (((g - b) / 255 / delta) % 6) : max === g / 255 ? 60 * (((b - r) / 255 / delta) + 2) : 60 * (((r - g) / 255 / delta) + 4);
    if (outHue < 0) outHue += 360;
    var outLight = (max + min) / 2;
    var outSat = delta === 0 ? 0 : delta / (1 - Math.abs(2 * outLight - 1));
    var outHex = "#" + [r, g, b].map(function (item) { return item.toString(16).padStart(2, "0"); }).join("");
    return { hex: outHex, rgb: "rgb(" + r + ", " + g + ", " + b + ")", hsl: "hsl(" + Math.round(outHue) + ", " + Math.round(outSat * 100) + "%, " + Math.round(outLight * 100) + "%)" };
  }

  function formatCode(source, language) {
    var value = String(source).trim();
    if (!value) return "";
    if (language === "html") {
      var tokens = value.replace(/>\s*</g, "><").replace(/></g, ">\n<").split("\n");
      var depth = 0;
      return tokens.map(function (token) {
        var closing = /^<\//.test(token); var selfClosing = /\/\s*>$/.test(token) || /^<(meta|link|img|input|br|hr)\b/i.test(token) || /^<!/.test(token);
        if (closing) depth = Math.max(0, depth - 1);
        var line = "  ".repeat(depth) + token;
        if (!closing && !selfClosing && /^<[^/!][^>]*>$/.test(token) && !/<\/[^>]+>$/.test(token)) depth += 1;
        return line;
      }).join("\n");
    }
    var output = ""; var indent = 0; var line = ""; var quote = null; var escaped = false;
    for (var i = 0; i < value.length; i += 1) {
      var char = value[i];
      if (quote) { line += char; if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === quote) quote = null; continue; }
      if (char === '"' || char === "'" || char === "`") { quote = char; line += char; continue; }
      if (char === "{") { output += "  ".repeat(indent) + line.trim() + " {\n"; line = ""; indent += 1; }
      else if (char === "}") { if (line.trim()) output += "  ".repeat(indent) + line.trim() + "\n"; indent = Math.max(0, indent - 1); output += "  ".repeat(indent) + "}"; line = ""; }
      else if (char === ";") { line += ";"; output += "  ".repeat(indent) + line.trim() + "\n"; line = ""; }
      else if (!/\s/.test(char) || (line && !line.endsWith(" "))) line += char;
    }
    if (line.trim()) output += "  ".repeat(indent) + line.trim();
    return output.trim();
  }

  function textArea(label, placeholder) { return '<div class="field"><label class="field-label" for="dev-input">' + label + '</label><textarea class="field-textarea" id="dev-input" placeholder="' + placeholder + '"></textarea></div>'; }
  function actions(label) { return '<div class="tool-actions"><button class="btn btn-primary" type="submit">' + label + '</button><button class="btn btn-secondary" type="button" data-copy hidden>Copy result</button><button class="btn btn-ghost" type="reset">Reset</button></div>'; }

  function mount() {
    var ui = C.initialize(); if (!ui || ui.root.dataset.toolGroup !== "developer") return;
    var slug = ui.slug; var form;
    if (slug === "json-toolkit") {
      ui.app.innerHTML = '<form>' + textArea("JSON", '{"toolbox": true}') + '<div class="field"><label class="field-label" for="json-mode">Action</label><select class="field-select" id="json-mode"><option value="format">Format</option><option value="minify">Minify</option><option value="validate">Validate</option></select></div>' + actions("Run JSON tool") + '</form>';
      form = ui.app.querySelector("form"); form.addEventListener("submit", function (e) { e.preventDefault(); var parsed = parseJSON(document.getElementById("dev-input").value); if (parsed.error) return ui.showError(parsed.error); var mode = document.getElementById("json-mode").value; var output = mode === "validate" ? "Valid JSON ✓" : JSON.stringify(parsed.value, null, mode === "format" ? 2 : 0); ui.showText(output, mode === "validate" ? "Validation result" : "JSON result"); wireCopy(output); });
    } else if (slug === "base64-toolkit" || slug === "url-toolkit" || slug === "html-entity-toolkit") {
      var toolName = slug === "base64-toolkit" ? "Base64" : slug === "url-toolkit" ? "URL component" : "HTML entities";
      ui.app.innerHTML = '<form>' + textArea("Input", "Enter text") + '<div class="field"><label class="field-label" for="codec-mode">Action</label><select class="field-select" id="codec-mode"><option value="encode">Encode</option><option value="decode">Decode</option></select></div>' + actions("Run " + toolName + " tool") + '</form>';
      form = ui.app.querySelector("form"); form.addEventListener("submit", function (e) { e.preventDefault(); try { var input = document.getElementById("dev-input").value; var mode = document.getElementById("codec-mode").value; var output; if (slug === "base64-toolkit") output = mode === "encode" ? utf8ToBase64(input) : base64ToUtf8(input); else if (slug === "url-toolkit") output = mode === "encode" ? encodeURIComponent(input) : decodeURIComponent(input); else { var area = document.createElement("textarea"); if (mode === "encode") output = C.escapeHTML(input); else { area.innerHTML = input; output = area.value; } } ui.showText(output, "Result"); wireCopy(output); } catch (error) { ui.showError("Unable to decode that input: " + error.message); } });
    } else if (slug === "hash-generator") {
      ui.app.innerHTML = '<form>' + textArea("Text to hash", "Enter text") + '<div class="field"><label class="field-label" for="hash-mode">Algorithm</label><select class="field-select" id="hash-mode"><option>SHA-256</option><option>SHA-384</option><option>SHA-512</option></select></div>' + actions("Generate hash") + '</form>';
      form = ui.app.querySelector("form"); form.addEventListener("submit", async function (e) { e.preventDefault(); try { var bytes = new TextEncoder().encode(document.getElementById("dev-input").value); var digest = await crypto.subtle.digest(document.getElementById("hash-mode").value, bytes); var output = Array.from(new Uint8Array(digest)).map(function (byte) { return byte.toString(16).padStart(2, "0"); }).join(""); ui.showText(output, "Cryptographic hash"); wireCopy(output); } catch (error) { ui.showError(error.message); } });
    } else if (slug === "timestamp-converter") {
      ui.app.innerHTML = '<form><div class="field-grid"><div class="field"><label class="field-label" for="unix-value">Unix timestamp</label><input class="field-input" id="unix-value" inputmode="numeric" placeholder="seconds or milliseconds"></div><div class="field"><label class="field-label" for="date-value">Local date and time</label><input class="field-input" id="date-value" type="datetime-local"></div></div><p class="field-hint">Fill either field. Values above 100 billion are treated as milliseconds.</p>' + actions("Convert timestamp") + '</form>';
      form = ui.app.querySelector("form"); form.addEventListener("submit", function (e) { e.preventDefault(); var raw = document.getElementById("unix-value").value.trim(); var dateRaw = document.getElementById("date-value").value; var date = raw ? new Date(Math.abs(Number(raw)) >= 1e11 ? Number(raw) : Number(raw) * 1000) : new Date(dateRaw); if (!Number.isFinite(date.getTime())) return ui.showError("Enter a valid timestamp or date."); var output = "ISO: " + date.toISOString() + "\nLocal: " + date.toLocaleString() + "\nUnix seconds: " + Math.floor(date.getTime() / 1000) + "\nUnix milliseconds: " + date.getTime(); ui.showText(output, "Converted time"); wireCopy(output); });
    } else if (slug === "regex-tester") {
      ui.app.innerHTML = '<form><div class="field-grid"><div class="field"><label class="field-label" for="pattern">Pattern</label><input class="field-input" id="pattern" placeholder="\\btool\\w*"></div><div class="field"><label class="field-label" for="flags">Flags</label><input class="field-input" id="flags" value="gi" maxlength="6"></div></div>' + textArea("Test text", "Toolbox has useful tools.") + actions("Test expression") + '</form>';
      form = ui.app.querySelector("form"); form.addEventListener("submit", function (e) { e.preventDefault(); try { var flags = document.getElementById("flags").value; var regex = new RegExp(document.getElementById("pattern").value, flags); var text = document.getElementById("dev-input").value; var matches = []; if (flags.indexOf("g") === -1) { var single = regex.exec(text); if (single) matches.push(single); } else { var match; while ((match = regex.exec(text)) && matches.length < 1000) { matches.push(match); if (match[0] === "") regex.lastIndex += 1; } } ui.showText(matches.length ? matches.map(function (item, index) { return (index + 1) + ". index " + item.index + ": " + item[0]; }).join("\n") : "No matches", matches.length + " match" + (matches.length === 1 ? "" : "es")); } catch (error) { ui.showError(error.message); } });
    } else if (slug === "code-formatter") {
      ui.app.innerHTML = '<form>' + textArea("Source code", "Paste HTML, CSS, or JavaScript") + '<div class="field"><label class="field-label" for="language">Language</label><select class="field-select" id="language"><option value="html">HTML</option><option value="css">CSS</option><option value="javascript">JavaScript</option></select></div><p class="field-hint">This is a lightweight structural formatter, not a parser or linter.</p>' + actions("Format code") + '</form>';
      form = ui.app.querySelector("form"); form.addEventListener("submit", function (e) { e.preventDefault(); var output = formatCode(document.getElementById("dev-input").value, document.getElementById("language").value); ui.showText(output, "Formatted source"); wireCopy(output); });
    } else if (slug === "color-converter") {
      ui.app.innerHTML = '<form><div class="field"><label class="field-label" for="color-input">HEX, RGB, or HSL color</label><input class="field-input" id="color-input" value="#176b52"></div>' + actions("Convert color") + '</form>';
      form = ui.app.querySelector("form"); form.addEventListener("submit", function (e) { e.preventDefault(); try { var color = parseColor(document.getElementById("color-input").value); var output = color.hex + "\n" + color.rgb + "\n" + color.hsl; ui.showHTML('<h2>Converted color</h2><div class="color-preview" style="background:' + color.hex + '"></div><pre class="client-tool-output">' + C.escapeHTML(output) + '</pre>'); wireCopy(output); } catch (error) { ui.showError(error.message); } });
    } else if (slug === "jwt-decoder") {
      ui.app.innerHTML = '<form>' + textArea("JWT", "Paste a three-part token") + '<p class="field-hint">Decoding does not verify the signature or prove that a token is valid or trustworthy.</p>' + actions("Decode JWT") + '</form>';
      form = ui.app.querySelector("form"); form.addEventListener("submit", function (e) { e.preventDefault(); try { var decoded = decodeJWT(document.getElementById("dev-input").value); var output = "Header\n" + JSON.stringify(decoded.header, null, 2) + "\n\nPayload\n" + JSON.stringify(decoded.payload, null, 2); ui.showText(output, "Decoded token (unverified)"); } catch (error) { ui.showError("Unable to decode this token: " + error.message); } });
    } else if (slug === "query-string-parser") {
      ui.app.innerHTML = '<form>' + textArea("URL, query string, or key=value lines", "https://example.com/?q=tools&tag=pdf&tag=image") + '<div class="field"><label class="field-label" for="query-mode">Action</label><select class="field-select" id="query-mode"><option value="parse">Parse to JSON</option><option value="build">Build query from key=value lines</option></select></div>' + actions("Run query tool") + '</form>';
      form = ui.app.querySelector("form"); form.addEventListener("submit", function (e) { e.preventDefault(); try { var input = document.getElementById("dev-input").value; var mode = document.getElementById("query-mode").value; var output; if (mode === "parse") { var query = input.indexOf("?") >= 0 ? input.slice(input.indexOf("?") + 1).split("#")[0] : input.replace(/^\?/, ""); var result = {}; new URLSearchParams(query).forEach(function (value, key) { if (Object.prototype.hasOwnProperty.call(result, key)) result[key] = Array.isArray(result[key]) ? result[key].concat(value) : [result[key], value]; else result[key] = value; }); output = JSON.stringify(result, null, 2); } else { var params = new URLSearchParams(); input.split(/\r?\n/).filter(Boolean).forEach(function (line) { var split = line.indexOf("="); params.append(split < 0 ? line.trim() : line.slice(0, split).trim(), split < 0 ? "" : line.slice(split + 1).trim()); }); output = params.toString(); } ui.showText(output, "Query result"); wireCopy(output); } catch (error) { ui.showError(error.message); } });
    }

    function wireCopy(output) { var button = ui.app.querySelector("[data-copy]"); if (!button) return; button.hidden = false; button.onclick = function () { C.copyText(output, button).catch(function (error) { ui.showError(error.message); }); }; }
    if (form) form.addEventListener("reset", function () { setTimeout(function () { ui.clear(); var copy = ui.app.querySelector("[data-copy]"); if (copy) copy.hidden = true; }, 0); });
  }

  return { utf8ToBase64: utf8ToBase64, base64ToUtf8: base64ToUtf8, parseJSON: parseJSON, decodeJWT: decodeJWT, parseColor: parseColor, formatCode: formatCode, mount: mount };
});

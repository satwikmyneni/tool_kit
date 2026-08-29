(function (root, factory) {
  var common = root ? root.ClientCommon : require("./client-common.js");
  var api = factory(common);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.document) api.mount();
})(typeof window !== "undefined" ? window : null, function (C) {
  "use strict";

  var UNITS = {
    length: { meter: 1, kilometer: 1000, centimeter: 0.01, millimeter: 0.001, inch: 0.0254, foot: 0.3048, yard: 0.9144, mile: 1609.344, "nautical mile": 1852 },
    weight: { kilogram: 1, gram: 0.001, milligram: 0.000001, pound: 0.45359237, ounce: 0.028349523125, stone: 6.35029318 },
    storage: { byte: 1, kilobyte: 1000, megabyte: 1e6, gigabyte: 1e9, terabyte: 1e12, kibibyte: 1024, mebibyte: 1048576, gibibyte: 1073741824, tebibyte: 1099511627776 },
    speed: { "meter/second": 1, "kilometer/hour": 1 / 3.6, "mile/hour": 0.44704, knot: 0.5144444444, "foot/second": 0.3048 }
  };

  function finite(value, label, options) {
    var number = Number(value);
    options = options || {};
    if (!Number.isFinite(number)) throw new Error("Enter a valid " + label + ".");
    if (options.min !== undefined && number < options.min) throw new Error(label + " must be at least " + options.min + ".");
    if (options.positive && number <= 0) throw new Error(label + " must be greater than zero.");
    return number;
  }

  function money(value) { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value); }

  function payment(principal, annualRate, months) {
    if (annualRate === 0) return principal / months;
    var rate = annualRate / 1200;
    return principal * rate * Math.pow(1 + rate, months) / (Math.pow(1 + rate, months) - 1);
  }

  function parseDate(value, label) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) throw new Error("Choose a valid " + label + ".");
    var parts = value.split("-").map(Number);
    var date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    if (date.getUTCFullYear() !== parts[0] || date.getUTCMonth() !== parts[1] - 1 || date.getUTCDate() !== parts[2]) throw new Error("Choose a valid " + label + ".");
    return date;
  }

  function addClamped(date, years, months) {
    var targetYear = date.getUTCFullYear() + years;
    var targetMonth = date.getUTCMonth() + months;
    targetYear += Math.floor(targetMonth / 12); targetMonth = ((targetMonth % 12) + 12) % 12;
    var last = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    return new Date(Date.UTC(targetYear, targetMonth, Math.min(date.getUTCDate(), last)));
  }

  function dateParts(start, end) {
    if (end < start) throw new Error("The end date must not be before the start date.");
    var years = end.getUTCFullYear() - start.getUTCFullYear();
    if (addClamped(start, years, 0) > end) years -= 1;
    var cursor = addClamped(start, years, 0); var months = 0;
    while (months < 11 && addClamped(cursor, 0, months + 1) <= end) months += 1;
    cursor = addClamped(cursor, 0, months);
    var days = Math.round((end - cursor) / 86400000);
    return { years: years, months: months, days: days, totalDays: Math.round((end - start) / 86400000) };
  }

  function convertUnit(value, category, from, to) {
    value = finite(value, "value");
    if (category === "temperature") {
      var celsius = from === "celsius" ? value : from === "fahrenheit" ? (value - 32) * 5 / 9 : value - 273.15;
      if (celsius < -273.15 - 1e-9) throw new Error("Temperature cannot be below absolute zero.");
      return to === "celsius" ? celsius : to === "fahrenheit" ? celsius * 9 / 5 + 32 : celsius + 273.15;
    }
    var units = UNITS[category];
    if (!units || units[from] === undefined || units[to] === undefined) throw new Error("Choose compatible units.");
    return value * units[from] / units[to];
  }

  function calculate(slug, values) {
    var a, b, c, result, lines = [], explanation = "";
    if (slug === "percentage-calculator") {
      a = finite(values.first, "first value"); b = finite(values.second, "second value");
      if (values.mode === "percent-of") { if (b === 0) throw new Error("The second value cannot be zero."); result = a / b * 100; lines = [C.formatNumber(a) + " is " + C.formatNumber(result) + "% of " + C.formatNumber(b)]; explanation = "Formula: first value ÷ second value × 100."; }
      else if (values.mode === "change") { if (a === 0) throw new Error("The original value cannot be zero."); result = (b - a) / Math.abs(a) * 100; lines = ["Percentage change: " + C.formatNumber(result) + "%"]; explanation = "Formula: (new − original) ÷ |original| × 100."; }
      else { result = a / 100 * b; lines = [C.formatNumber(a) + "% of " + C.formatNumber(b) + " = " + C.formatNumber(result)]; explanation = "Formula: percentage ÷ 100 × value."; }
    } else if (slug === "discount-calculator") {
      a = finite(values.price, "original price", { min: 0 }); b = finite(values.discount, "discount", { min: 0 }); if (b > 100) throw new Error("Discount cannot exceed 100%."); result = a * (1 - b / 100); lines = ["Sale price: " + money(result), "You save: " + money(a - result)]; explanation = "Sale price = original price × (1 − discount ÷ 100).";
    } else if (slug === "tip-calculator") {
      a = finite(values.bill, "bill", { min: 0 }); b = finite(values.tip, "tip", { min: 0 }); c = finite(values.people, "people", { positive: true }); if (!Number.isInteger(c)) throw new Error("People must be a whole number."); result = a * b / 100; lines = ["Tip: " + money(result), "Total: " + money(a + result), "Per person: " + money((a + result) / c)]; explanation = "The tip percentage is applied to the bill before splitting evenly.";
    } else if (slug === "age-calculator" || slug === "date-difference-calculator") {
      var start = parseDate(values.start, slug === "age-calculator" ? "birth date" : "start date"); var end = parseDate(values.end, "end date"); var parts = dateParts(start, end); lines = [parts.years + " years, " + parts.months + " months, " + parts.days + " days", C.formatNumber(parts.totalDays, 0) + " total days"]; explanation = "Calendar years and months are counted first; remaining UTC calendar days are then counted.";
    } else if (slug === "time-duration-calculator") {
      if (!/^\d{2}:\d{2}$/.test(values.start) || !/^\d{2}:\d{2}$/.test(values.end)) throw new Error("Choose both times."); var startMinutes = values.start.split(":").map(Number); var endMinutes = values.end.split(":").map(Number); a = startMinutes[0] * 60 + startMinutes[1]; b = endMinutes[0] * 60 + endMinutes[1]; var duration = b - a; if (duration < 0) duration += 1440; lines = [Math.floor(duration / 60) + " hours, " + (duration % 60) + " minutes", duration + " total minutes"]; explanation = "An end time earlier than the start is treated as the next day.";
    } else if (["unit-converter", "length-converter", "weight-converter", "temperature-converter", "data-storage-converter", "speed-converter"].indexOf(slug) !== -1) {
      var category = slug === "unit-converter" ? values.category : { "length-converter": "length", "weight-converter": "weight", "temperature-converter": "temperature", "data-storage-converter": "storage", "speed-converter": "speed" }[slug]; result = convertUnit(values.value, category, values.from, values.to); lines = [C.formatNumber(Number(values.value), 8) + " " + values.from + " = " + C.formatNumber(result, 8) + " " + values.to]; explanation = category === "temperature" ? "Temperature conversions use the exact Celsius, Fahrenheit, and Kelvin equations." : "The value is converted through the category's SI base unit.";
    } else if (slug === "loan-calculator") {
      a = finite(values.principal, "principal", { positive: true }); b = finite(values.rate, "annual rate", { min: 0 }); c = finite(values.years, "term", { positive: true }); var months = Math.round(c * 12); result = payment(a, b, months); lines = ["Monthly payment: " + money(result), "Total payment: " + money(result * months), "Total interest: " + money(result * months - a)]; explanation = "Uses a fixed-rate amortizing loan with monthly payments and no fees.";
    } else if (slug === "compound-interest-calculator") {
      a = finite(values.principal, "principal", { min: 0 }); b = finite(values.rate, "annual rate", { min: 0 }); c = finite(values.years, "years", { positive: true }); var contribution = finite(values.contribution, "monthly contribution", { min: 0 }); var monthlyRate = b / 1200; var periods = Math.round(c * 12); result = a; for (var period = 0; period < periods; period += 1) result = result * (1 + monthlyRate) + contribution; lines = ["Future value: " + money(result), "Contributions: " + money(a + contribution * periods), "Estimated growth: " + money(result - a - contribution * periods)]; explanation = "Interest compounds monthly; each contribution is added at the end of the month.";
    } else if (slug === "simple-interest-calculator") {
      a = finite(values.principal, "principal", { min: 0 }); b = finite(values.rate, "annual rate", { min: 0 }); c = finite(values.years, "years", { min: 0 }); result = a * b / 100 * c; lines = ["Interest: " + money(result), "Final amount: " + money(a + result)]; explanation = "Simple interest = principal × annual rate × years.";
    } else if (slug === "tax-calculator") {
      a = finite(values.amount, "amount", { min: 0 }); b = finite(values.rate, "tax rate", { min: 0 }); if (values.mode === "extract") { result = a - a / (1 + b / 100); lines = ["Pre-tax amount: " + money(a - result), "Included tax: " + money(result), "Total: " + money(a)]; } else { result = a * b / 100; lines = ["Tax: " + money(result), "Total: " + money(a + result)]; } explanation = values.mode === "extract" ? "Included tax = total − total ÷ (1 + rate)." : "Tax = pre-tax amount × rate.";
    } else if (slug === "profit-margin-calculator") {
      a = finite(values.cost, "cost", { min: 0 }); b = finite(values.revenue, "revenue", { positive: true }); result = b - a; lines = ["Profit: " + money(result), "Margin: " + C.formatNumber(result / b * 100, 2) + "%", "Markup: " + (a === 0 ? "Not defined when cost is zero" : C.formatNumber(result / a * 100, 2) + "%")]; explanation = "Margin divides profit by revenue; markup divides profit by cost.";
    } else if (slug === "fuel-cost-calculator") {
      a = finite(values.distance, "distance", { min: 0 }); b = finite(values.efficiency, "fuel consumption", { positive: true }); c = finite(values.price, "fuel price", { min: 0 }); var travelers = finite(values.people, "travelers", { positive: true }); var liters = a * b / 100; result = liters * c; lines = ["Fuel needed: " + C.formatNumber(liters, 2) + " L", "Trip fuel cost: " + money(result), "Per traveler: " + money(result / travelers)]; explanation = "Assumes distance in kilometers and fuel consumption in liters per 100 km.";
    } else throw new Error("This calculator is unavailable.");
    return { lines: lines, explanation: explanation };
  }

  var DEFINITIONS = {
    "percentage-calculator": [["first", "First value", "number", "25"], ["second", "Second value", "number", "200"]],
    "discount-calculator": [["price", "Original price", "number", "100"], ["discount", "Discount (%)", "number", "20"]],
    "tip-calculator": [["bill", "Bill amount", "number", "80"], ["tip", "Tip (%)", "number", "15"], ["people", "People", "number", "2"]],
    "age-calculator": [["start", "Birth date", "date", ""], ["end", "Age on date", "date", "today"]],
    "date-difference-calculator": [["start", "Start date", "date", ""], ["end", "End date", "date", "today"]],
    "time-duration-calculator": [["start", "Start time", "time", "09:00"], ["end", "End time", "time", "17:30"]],
    "loan-calculator": [["principal", "Loan amount", "number", "25000"], ["rate", "Annual interest (%)", "number", "7.5"], ["years", "Term (years)", "number", "5"]],
    "compound-interest-calculator": [["principal", "Starting principal", "number", "10000"], ["rate", "Annual interest (%)", "number", "6"], ["years", "Years", "number", "10"], ["contribution", "Monthly contribution", "number", "100"]],
    "simple-interest-calculator": [["principal", "Principal", "number", "10000"], ["rate", "Annual interest (%)", "number", "5"], ["years", "Years", "number", "3"]],
    "profit-margin-calculator": [["cost", "Cost", "number", "60"], ["revenue", "Revenue", "number", "100"]],
    "fuel-cost-calculator": [["distance", "Distance (km)", "number", "300"], ["efficiency", "Consumption (L/100 km)", "number", "7.5"], ["price", "Price per liter", "number", "1.5"], ["people", "Travelers", "number", "2"]]
  };

  function unitOptions(category) {
    var keys = category === "temperature" ? ["celsius", "fahrenheit", "kelvin"] : Object.keys(UNITS[category] || {});
    return keys.map(function (unit) { return '<option value="' + unit + '">' + unit + '</option>'; }).join("");
  }

  function mount() {
    var ui = C.initialize(); if (!ui || ui.root.dataset.toolGroup !== "calculator") return;
    var slug = ui.slug; var fields = DEFINITIONS[slug]; var html = '<form><div class="field-grid">';
    if (slug === "percentage-calculator") html += '<div class="field"><label class="field-label" for="mode">Calculation</label><select class="field-select" id="mode" name="mode"><option value="of">First % of second</option><option value="percent-of">First is what % of second</option><option value="change">Change from first to second</option></select></div>';
    if (slug === "unit-converter") html += '<div class="field"><label class="field-label" for="category">Category</label><select class="field-select" id="category" name="category"><option value="length">Length</option><option value="weight">Weight</option><option value="temperature">Temperature</option><option value="storage">Data storage</option><option value="speed">Speed</option></select></div>';
    var unitCategory = { "length-converter": "length", "weight-converter": "weight", "temperature-converter": "temperature", "data-storage-converter": "storage", "speed-converter": "speed" }[slug];
    if (slug === "unit-converter" || unitCategory) {
      html += '<div class="field"><label class="field-label" for="value">Value</label><input class="field-input" id="value" name="value" type="number" step="any" value="1" required></div><div class="field"><label class="field-label" for="from">From</label><select class="field-select" id="from" name="from"></select></div><div class="field"><label class="field-label" for="to">To</label><select class="field-select" id="to" name="to"></select></div>';
    } else if (slug === "tax-calculator") {
      html += '<div class="field"><label class="field-label" for="amount">Amount</label><input class="field-input" id="amount" name="amount" type="number" min="0" step="any" value="100" required></div><div class="field"><label class="field-label" for="rate">Tax rate (%)</label><input class="field-input" id="rate" name="rate" type="number" min="0" step="any" value="18" required></div><div class="field"><label class="field-label" for="mode">Mode</label><select class="field-select" id="mode" name="mode"><option value="add">Add tax</option><option value="extract">Extract included tax</option></select></div>';
    } else {
      (fields || []).forEach(function (field) { var value = field[3] === "today" ? new Date().toISOString().slice(0, 10) : field[3]; html += '<div class="field"><label class="field-label" for="' + field[0] + '">' + field[1] + '</label><input class="field-input" id="' + field[0] + '" name="' + field[0] + '" type="' + field[2] + '" value="' + value + '"' + (field[2] === "number" ? ' step="any"' : '') + ' required></div>'; });
    }
    html += '</div><div class="tool-actions"><button class="btn btn-primary" type="submit">Calculate</button><button class="btn btn-ghost" type="reset">Reset</button></div></form><p class="field-hint">Results are estimates for general information, not financial advice.</p>';
    ui.app.innerHTML = html;

    function updateUnits() {
      var category = slug === "unit-converter" ? document.getElementById("category").value : unitCategory;
      if (!category) return;
      document.getElementById("from").innerHTML = unitOptions(category); document.getElementById("to").innerHTML = unitOptions(category);
      if (document.getElementById("to").options.length > 1) document.getElementById("to").selectedIndex = 1;
    }
    if (slug === "unit-converter" || unitCategory) { updateUnits(); if (slug === "unit-converter") document.getElementById("category").addEventListener("change", updateUnits); }

    var form = ui.app.querySelector("form");
    form.addEventListener("submit", function (event) {
      event.preventDefault(); var values = {}; new FormData(form).forEach(function (value, key) { values[key] = value; });
      try { var answer = calculate(slug, values); ui.showHTML('<h2>Result</h2><p class="client-result-value">' + C.escapeHTML(answer.lines[0]) + '</p>' + answer.lines.slice(1).map(function (line) { return '<p>' + C.escapeHTML(line) + '</p>'; }).join("") + '<p class="field-hint">' + C.escapeHTML(answer.explanation) + '</p>'); }
      catch (error) { ui.showError(error.message); }
    });
    form.addEventListener("reset", function () { setTimeout(function () { ui.clear(); if (slug === "unit-converter" || unitCategory) updateUnits(); }, 0); });
  }

  return { calculate: calculate, convertUnit: convertUnit, dateParts: dateParts, payment: payment, mount: mount };
});

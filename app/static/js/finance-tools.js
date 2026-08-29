(function (root, factory) {
  var common = root ? root.ClientCommon : require("./client-common.js");
  var api = factory(common);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.document) api.mount();
})(typeof window !== "undefined" ? window : null, function (C) {
  "use strict";

  function value(input, label, minimum) {
    var number = Number(input);
    if (!Number.isFinite(number) || number < (minimum || 0)) throw new Error("Enter a valid " + label + ".");
    return number;
  }

  function loanPayment(principal, annualRate, months) {
    principal = value(principal, "loan amount", 0.01); annualRate = value(annualRate, "interest rate", 0); months = value(months, "term", 1);
    if (annualRate === 0) return principal / months;
    var rate = annualRate / 1200; var factor = Math.pow(1 + rate, months);
    return principal * rate * factor / (factor - 1);
  }

  function savingsMonths(current, target, monthly, annualRate) {
    current = value(current, "current savings", 0); target = value(target, "goal", 0.01); monthly = value(monthly, "monthly contribution", 0); annualRate = value(annualRate, "annual rate", 0);
    if (current >= target) return 0;
    if (monthly === 0 && annualRate === 0) throw new Error("Add a monthly contribution or growth rate.");
    var balance = current; var rate = annualRate / 1200;
    for (var month = 1; month <= 1200; month += 1) { balance = balance * (1 + rate) + monthly; if (balance >= target) return month; }
    throw new Error("The goal is more than 100 years away with these assumptions.");
  }

  function fields(list) { return '<div class="field-grid">' + list.map(function (field) { return '<div class="field"><label class="field-label" for="' + field[0] + '">' + field[1] + '</label><input class="field-input" id="' + field[0] + '" name="' + field[0] + '" type="number" min="0" step="any" value="' + field[2] + '" required></div>'; }).join("") + '</div>'; }
  function actions() { return '<div class="tool-actions"><button class="btn btn-primary" type="submit">Calculate</button><button class="btn btn-ghost" type="reset">Reset</button></div>'; }
  function number(valueToFormat) { return C.formatNumber(valueToFormat, 2) + " currency units"; }

  function mount() {
    var ui = C.initialize(); if (!ui || ui.root.dataset.toolGroup !== "finance") return;
    var slug = ui.slug; var form;
    if (slug === "budget-planner") {
      var categories = ["Housing", "Food", "Transport", "Bills", "Health", "Education", "Savings", "Other"];
      var saved = C.readJSON("toolbox_budget_plan", {}); if (!saved || typeof saved !== "object") saved = {};
      ui.app.innerHTML = '<form>' + fields([["income", "Monthly income", saved.income || 5000]]) + '<h2>Planned categories</h2>' + fields(categories.map(function (category) { var key = category.toLowerCase(); return [key, category, saved[key] || 0]; })) + actions() + '</form>';
      form = ui.app.querySelector("form"); form.onsubmit = function (event) { event.preventDefault(); try { var data = {}; new FormData(form).forEach(function (item, key) { data[key] = value(item, key, 0); }); var total = categories.reduce(function (sum, category) { return sum + data[category.toLowerCase()]; }, 0); var remaining = data.income - total; C.writeJSON("toolbox_budget_plan", data); ui.showHTML('<h2>Monthly plan</h2><p class="client-result-value">' + C.escapeHTML(number(remaining)) + ' remaining</p><p>Planned spending: ' + C.escapeHTML(number(total)) + '</p><p>Income allocated: ' + C.formatNumber(data.income ? total / data.income * 100 : 0, 1) + '%</p><p class="field-hint">This plan is stored only in this browser.</p>'); } catch (error) { ui.showError(error.message); } };
    } else if (slug === "savings-goal-calculator") {
      ui.app.innerHTML = '<form>' + fields([["current", "Current savings", 1000], ["target", "Savings goal", 10000], ["monthly", "Monthly contribution", 400], ["rate", "Estimated annual growth (%)", 0]]) + actions() + '</form>';
      form = ui.app.querySelector("form"); form.onsubmit = function (event) { event.preventDefault(); try { var months = savingsMonths(document.getElementById("current").value, document.getElementById("target").value, document.getElementById("monthly").value, document.getElementById("rate").value); ui.showHTML('<h2>Goal estimate</h2><p class="client-result-value">' + months + ' month' + (months === 1 ? '' : 's') + '</p><p>About ' + Math.floor(months / 12) + ' years and ' + (months % 12) + ' months.</p><p class="field-hint">Assumes the same contribution at each month end and a constant rate. Returns are not guaranteed.</p>'); } catch (error) { ui.showError(error.message); } };
    } else if (slug === "emi-calculator") {
      ui.app.innerHTML = '<form>' + fields([["principal", "Loan amount", 25000], ["rate", "Annual interest (%)", 7.5], ["years", "Term (years)", 5]]) + actions() + '</form>';
      form = ui.app.querySelector("form"); form.onsubmit = function (event) { event.preventDefault(); try { var months = Math.round(value(document.getElementById("years").value, "term", 0.01) * 12); var principal = value(document.getElementById("principal").value, "loan amount", 0.01); var payment = loanPayment(principal, document.getElementById("rate").value, months); ui.showHTML('<h2>Loan estimate</h2><p class="client-result-value">' + C.escapeHTML(number(payment)) + ' per month</p><p>Total payment: ' + C.escapeHTML(number(payment * months)) + '</p><p>Total interest: ' + C.escapeHTML(number(payment * months - principal)) + '</p><p class="field-hint">Assumes a fixed-rate amortizing loan, monthly payments, and no fees.</p>'); } catch (error) { ui.showError(error.message); } };
    } else if (slug === "split-bill-calculator") {
      ui.app.innerHTML = '<form>' + fields([["bill", "Bill before tax and tip", 100], ["tax", "Tax (%)", 8], ["tip", "Tip on pre-tax bill (%)", 18], ["people", "People", 4]]) + actions() + '</form>';
      form = ui.app.querySelector("form"); form.onsubmit = function (event) { event.preventDefault(); try { var bill = value(document.getElementById("bill").value, "bill", 0); var tax = bill * value(document.getElementById("tax").value, "tax", 0) / 100; var tip = bill * value(document.getElementById("tip").value, "tip", 0) / 100; var people = value(document.getElementById("people").value, "people", 1); if (!Number.isInteger(people)) throw new Error("People must be a whole number."); var total = bill + tax + tip; ui.showHTML('<h2>Bill split</h2><p class="client-result-value">' + C.escapeHTML(number(total / people)) + ' per person</p><p>Total bill: ' + C.escapeHTML(number(total)) + '</p><p>Tax: ' + C.escapeHTML(number(tax)) + ' · Tip: ' + C.escapeHTML(number(tip)) + '</p>'); } catch (error) { ui.showError(error.message); } };
    } else if (slug === "currency-calculator") {
      ui.app.innerHTML = '<form>' + fields([["amount", "Amount", 100], ["rate", "Exchange rate (target per source)", 1]]) + '<div class="field-grid"><div class="field"><label class="field-label" for="source">Source code</label><input class="field-input" id="source" value="USD" maxlength="10"></div><div class="field"><label class="field-label" for="target">Target code</label><input class="field-input" id="target" value="EUR" maxlength="10"></div></div>' + actions() + '<p class="field-hint">Enter a current exchange rate from a source you trust. Toolbox does not fetch or claim live rates.</p></form>';
      form = ui.app.querySelector("form"); form.onsubmit = function (event) { event.preventDefault(); try { var amount = value(document.getElementById("amount").value, "amount", 0); var rate = value(document.getElementById("rate").value, "exchange rate", 0.000000001); var source = document.getElementById("source").value.trim().toUpperCase() || "SOURCE"; var target = document.getElementById("target").value.trim().toUpperCase() || "TARGET"; ui.showHTML('<h2>Converted amount</h2><p class="client-result-value">' + C.formatNumber(amount * rate, 6) + ' ' + C.escapeHTML(target) + '</p><p>' + C.formatNumber(amount, 6) + ' ' + C.escapeHTML(source) + ' at ' + C.formatNumber(rate, 8) + ' ' + C.escapeHTML(target) + ' per ' + C.escapeHTML(source) + '.</p>'); } catch (error) { ui.showError(error.message); } };
    }
    if (form) form.onreset = function () { setTimeout(ui.clear, 0); };
  }

  return { loanPayment: loanPayment, savingsMonths: savingsMonths, mount: mount };
});

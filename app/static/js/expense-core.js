(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ToolboxExpenseCore = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
    var date = new Date(value + "T00:00:00Z");
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function normalizeTransaction(raw, idFactory, existingId) {
    if (!raw || (raw.type !== "income" && raw.type !== "expense")) return null;
    var amount = Number(raw.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !validDate(String(raw.date || ""))) return null;
    var category = String(raw.category || "Other").trim().slice(0, 40) || "Other";
    var description = String(raw.description || "").trim().slice(0, 120);
    var id = existingId || String(raw.id || "") || idFactory();
    return { id: id, type: raw.type, amount: amount, category: category, date: raw.date, description: description };
  }

  function createLedger(storage, key, idFactory) {
    var items = [];
    try {
      var parsed = JSON.parse(storage.getItem(key) || "[]");
      if (Array.isArray(parsed)) {
        items = parsed.map(function (item) { return normalizeTransaction(item, idFactory); }).filter(Boolean);
      }
    } catch (_error) {
      items = [];
    }

    function snapshot() {
      return items.map(function (item) { return Object.assign({}, item); });
    }
    function persist() {
      storage.setItem(key, JSON.stringify(items));
      return snapshot();
    }
    return {
      all: snapshot,
      replace: function (values) {
        items = (Array.isArray(values) ? values : []).map(function (item) {
          return normalizeTransaction(item, idFactory, item && item.id);
        }).filter(Boolean);
        return persist();
      },
      upsert: function (value, id) {
        var normalized = normalizeTransaction(value, idFactory, id || null);
        if (!normalized) throw new Error("Invalid transaction");
        if (id) {
          var index = items.findIndex(function (item) { return item.id === id; });
          if (index < 0) throw new Error("Transaction not found");
          items[index] = normalized;
        } else {
          items.push(normalized);
        }
        return persist();
      },
      remove: function (id) {
        items = items.filter(function (item) { return item.id !== id; });
        return persist();
      },
      clear: function () {
        items = [];
        return persist();
      }
    };
  }

  function filterTransactions(items, month, type, category) {
    return items.filter(function (item) {
      return (!month || item.date.indexOf(month) === 0) &&
        (!type || type === "all" || item.type === type) &&
        (!category || category === "all" || item.category === category);
    }).sort(function (a, b) {
      return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
    });
  }

  function calculateTotals(items, month) {
    return filterTransactions(items, month, "all", "all").reduce(function (totals, item) {
      totals[item.type] += item.amount;
      totals.balance = totals.income - totals.expense;
      return totals;
    }, { income: 0, expense: 0, balance: 0 });
  }

  function csvCell(value) {
    var text = String(value == null ? "" : value);
    if (/^[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function toCSV(items) {
    var rows = [["Date", "Type", "Category", "Description", "Amount"]];
    items.forEach(function (item) {
      rows.push([item.date, item.type, item.category, item.description, item.amount]);
    });
    return rows.map(function (row) { return row.map(csvCell).join(","); }).join("\r\n");
  }

  function parseCSV(text, idFactory) {
    var rows = [];
    var row = [];
    var value = "";
    var quoted = false;
    var source = String(text || "").replace(/^\uFEFF/, "");
    for (var index = 0; index < source.length; index += 1) {
      var character = source[index];
      if (quoted && character === '"' && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = !quoted;
      } else if (character === "," && !quoted) {
        row.push(value);
        value = "";
      } else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && source[index + 1] === "\n") index += 1;
        row.push(value);
        if (row.some(function (cell) { return cell.trim(); })) rows.push(row);
        row = [];
        value = "";
      } else {
        value += character;
      }
    }
    row.push(value);
    if (row.some(function (cell) { return cell.trim(); })) rows.push(row);
    if (!rows.length || rows[0].map(function (cell) { return cell.trim().toLowerCase(); }).join(",") !== "date,type,category,description,amount") return [];
    return rows.slice(1).map(function (cells) {
      return normalizeTransaction({
        date: (cells[0] || "").trim(),
        type: (cells[1] || "").trim().toLowerCase(),
        category: (cells[2] || "").trim(),
        description: (cells[3] || "").trim(),
        amount: (cells[4] || "").trim()
      }, idFactory);
    }).filter(Boolean);
  }

  return {
    createLedger: createLedger,
    filterTransactions: filterTransactions,
    calculateTotals: calculateTotals,
    toCSV: toCSV,
    parseCSV: parseCSV,
    normalizeTransaction: normalizeTransaction
  };
});

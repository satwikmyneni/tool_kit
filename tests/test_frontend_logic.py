"""Executable tests for browser-independent JavaScript logic."""

import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
NODE = shutil.which("node")


def run_node(script):
    if not NODE:
        pytest.skip("Node.js is not available for JavaScript unit tests")
    result = subprocess.run(
        [NODE, "-e", script],
        cwd=ROOT,
        capture_output=True,
        check=True,
        text=True,
    )
    return json.loads(result.stdout)


def test_typing_stats_track_total_correct_errors_accuracy_and_wpm():
    result = run_node(
        r"""
        const core = require('./app/static/js/typing-core.js');
        console.log(JSON.stringify(core.calculateStats('abcdefghijklmnopqrstuvwxy', 'abcdefghijklmnopqrstuvwxZ', 30000)));
        """
    )
    assert result == {"wpm": 10, "accuracy": 96, "total": 25, "correct": 24, "incorrect": 1}


def test_typing_timer_reaches_zero_at_the_exact_deadline():
    result = run_node(
        """
        const core = require('./app/static/js/typing-core.js');
        console.log(JSON.stringify([
          core.remainingSeconds(15000, 0),
          core.remainingSeconds(15000, 14001),
          core.remainingSeconds(15000, 15000),
          core.remainingSeconds(15000, 16000)
        ]));
        """
    )
    assert result == [15, 1, 0, 0]


def test_expense_ledger_add_edit_delete_persist_filter_and_totals():
    result = run_node(
        """
        const core = require('./app/static/js/expense-core.js');
        const values = {};
        const storage = {getItem: k => values[k] ?? null, setItem: (k, v) => { values[k] = v; }};
        let next = 0;
        const ids = () => 'id-' + (++next);
        const ledger = core.createLedger(storage, 'ledger', ids);
        let items = ledger.upsert({type:'expense', amount:10, category:'Food', date:'2026-08-02', description:'Lunch'});
        const expenseId = items[0].id;
        items = ledger.upsert({type:'expense', amount:12.5, category:'Food', date:'2026-08-02', description:'Lunch'}, expenseId);
        items = ledger.upsert({type:'income', amount:50, category:'Other', date:'2026-08-03', description:'Refund'});
        const totals = core.calculateTotals(items, '2026-08');
        const filtered = core.filterTransactions(items, '2026-08', 'expense', 'Food');
        items = ledger.remove(expenseId);
        const reloaded = core.createLedger(storage, 'ledger', ids).all();
        console.log(JSON.stringify({totals, filtered: filtered.length, remaining: items.length, persisted: reloaded.length}));
        """
    )
    assert result == {
        "totals": {"income": 50, "expense": 12.5, "balance": 37.5},
        "filtered": 1,
        "remaining": 1,
        "persisted": 1,
    }


def test_expense_csv_round_trip_handles_commas_newlines_and_formula_prefixes():
    result = run_node(
        r"""
        const core = require('./app/static/js/expense-core.js');
        let next = 0;
        const ids = () => 'csv-' + (++next);
        const input = [
          {id:'one', type:'expense', amount:5.25, category:'Food', date:'2026-08-04', description:'line one,\nline two'},
          {id:'two', type:'expense', amount:2, category:'Other', date:'2026-08-05', description:'=SUM(A1:A2)'}
        ];
        const csv = core.toCSV(input);
        const parsed = core.parseCSV(csv, ids);
        console.log(JSON.stringify({count: parsed.length, safe: csv.includes("'=SUM"), multiline: parsed[0].description.includes('\n'), amount: parsed[0].amount}));
        """
    )
    assert result == {"count": 2, "safe": True, "multiline": True, "amount": 5.25}

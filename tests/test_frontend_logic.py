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


def test_text_toolkit_handles_unicode_cleanup_diff_and_safe_markdown():
    result = run_node(
        r"""
        const text = require('./app/static/js/text-tools.js');
        const stats = text.analyze('Hello 👋 world.\n\nSecond paragraph!');
        const cleaned = text.clean('a\na\nb', 'dedupe');
        const changes = text.diffLines('one\ntwo', 'one\nthree');
        const markdown = text.markdown('# Hi\n<script>alert(1)</script>');
        console.log(JSON.stringify({words:stats.words, paragraphs:stats.paragraphs, cleaned, line:changes[0].line, escaped:markdown.includes('&lt;script&gt;')}));
        """
    )
    assert result == {"words": 4, "paragraphs": 2, "cleaned": "a\nb", "line": 2, "escaped": True}


def test_developer_toolkit_unicode_json_jwt_color_and_formatter():
    result = run_node(
        r"""
        const dev = require('./app/static/js/developer-tools.js');
        const original = 'Toolbox ' + String.fromCodePoint(0x1F331);
        const encoded = dev.utf8ToBase64(original);
        const parsed = dev.parseJSON('{"ok":true}');
        const header = Buffer.from(JSON.stringify({alg:'none'})).toString('base64url');
        const payload = Buffer.from(JSON.stringify({sub:'test'})).toString('base64url');
        const jwt = dev.decodeJWT(header + '.' + payload + '.x');
        const color = dev.parseColor('hsl(0, 100%, 50%)');
        console.log(JSON.stringify({roundtrip:dev.base64ToUtf8(encoded) === original, ok:parsed.value.ok, sub:jwt.payload.sub, color:color.hex, formatted:dev.formatCode('<main><p>x</p></main>', 'html').includes('\n')}));
        """
    )
    assert result == {"roundtrip": True, "ok": True, "sub": "test", "color": "#ff0000", "formatted": True}


def test_calculator_core_conversions_dates_and_loan_formula():
    result = run_node(
        r"""
        const calc = require('./app/static/js/calculator-tools.js');
        const parts = calc.dateParts(new Date(Date.UTC(2020,1,29)), new Date(Date.UTC(2021,1,28)));
        const change = calc.calculate('percentage-calculator', {mode:'change', first:80, second:100});
        console.log(JSON.stringify({meters:calc.convertUnit(1,'length','mile','meter'), freezing:calc.convertUnit(32,'temperature','fahrenheit','celsius'), years:parts.years, payment:Number(calc.payment(12000,0,12).toFixed(2)), change:change.lines[0]}));
        """
    )
    assert result == {"meters": 1609.344, "freezing": 0, "years": 1, "payment": 1000, "change": "Percentage change: 25%"}


def test_secure_generator_and_productivity_helpers():
    result = run_node(
        r"""
        global.crypto = require('crypto').webcrypto;
        const generators = require('./app/static/js/generator-tools.js');
        const productivity = require('./app/static/js/productivity-tools.js');
        const password = generators.password({length:24, lower:true, upper:true, numbers:true, symbols:true, ambiguous:true});
        console.log(JSON.stringify({length:password.length, uuid:/^[0-9a-f-]{36}$/.test(generators.uuidV4()), time:productivity.formatTime(3723000,true), options:productivity.validOptions('a\n\n b ').length}));
        """
    )
    assert result == {"length": 24, "uuid": True, "time": "01:02:03", "options": 2}


def test_finance_helpers_handle_zero_rate_and_savings_goal():
    result = run_node(
        r"""
        const finance = require('./app/static/js/finance-tools.js');
        console.log(JSON.stringify({payment:finance.loanPayment(12000,0,12), months:finance.savingsMonths(0,1200,100,0)}));
        """
    )
    assert result == {"payment": 1000, "months": 12}

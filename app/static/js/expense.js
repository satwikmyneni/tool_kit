(function() {
  'use strict';

  // Constants & defaults
  const STORAGE_KEY = 'toolbox_expenses';
  const CURRENCY_KEY = 'toolbox_expense_currency';
  const Core = window.ToolboxExpenseCore;
  if (!Core) return;
  
  const CATEGORIES = ['Food', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Health', 'Education', 'Other'];
  const DEFAULT_CATEGORIES = { expense: CATEGORIES, income: CATEGORIES };

  const CURRENCY_SYMBOLS = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'INR': '₹',
    'JPY': '¥'
  };

  // State
  let transactions = [];
  let currentCurrency = 'USD';
  let editingId = null;
  let ledger = null;

  // DOM Elements
  const appContainer = document.getElementById('expense-app');
  if (!appContainer) return;

  const currencySelect = document.getElementById('expense-currency');
  const monthInput = document.getElementById('expense-month');
  
  const statIncome = document.querySelector('[data-income]');
  const statExpense = document.querySelector('[data-expense]');
  const statBalance = document.querySelector('[data-balance]');
  const statCurrentMonth = document.querySelector('[data-current-month]');
  
  const form = document.getElementById('expense-form');
  const typeSelect = document.getElementById('tx-type');
  const amountInput = document.getElementById('tx-amount');
  const categorySelect = document.getElementById('tx-category');
  const dateInput = document.getElementById('tx-date');
  const noteInput = document.getElementById('tx-note');
  const customCategoryInput = document.getElementById('tx-custom');
  
  const btnSave = document.querySelector('[data-save]');
  const btnCancelEdit = document.querySelector('[data-cancel-edit]');
  const btnReset = document.querySelector('[data-reset]');
  
  const filterType = document.getElementById('filter-type');
  const filterCategory = document.getElementById('filter-category');
  
  const tableBody = document.querySelector('[data-rows]');
  const emptyMessage = document.querySelector('[data-empty]');
  
  const chartContainer = document.querySelector('[data-chart]');
  
  const btnExport = document.querySelector('[data-export]');
  const fileImport = document.getElementById('expense-import');
  const btnClear = document.querySelector('[data-clear]');
  
  // Initialize
  function init() {
    loadData();
    setupEventListeners();
    
    // Set default month to current month if empty
    if (!monthInput.value) {
      const now = new Date();
      monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    
    // Set default date to today
    if (!dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
    
    populateCategories();
    updateUI();
  }
  
  function loadData() {
    ledger = Core.createLedger(localStorage, STORAGE_KEY, generateUUID);
    transactions = ledger.all();
    
    const storedCurrency = localStorage.getItem(CURRENCY_KEY);
    if (storedCurrency && CURRENCY_SYMBOLS[storedCurrency]) {
      currentCurrency = storedCurrency;
      if (currencySelect) currencySelect.value = currentCurrency;
    } else if (currencySelect) {
      currentCurrency = currencySelect.value;
    }
  }
  
  function saveData() {
    transactions = ledger.replace(transactions);
    localStorage.setItem(CURRENCY_KEY, currentCurrency);
  }
  
  function setupEventListeners() {
    if (typeSelect) typeSelect.addEventListener('change', populateCategories);
    if (currencySelect) currencySelect.addEventListener('change', (e) => {
      currentCurrency = e.target.value;
      saveData();
      updateUI();
    });
    
    if (monthInput) monthInput.addEventListener('change', updateUI);
    if (filterType) filterType.addEventListener('change', updateTableAndCategories);
    if (filterCategory) filterCategory.addEventListener('change', updateTableAndCategories);
    
    if (form) form.addEventListener('submit', handleFormSubmit);
    
    if (btnCancelEdit) btnCancelEdit.addEventListener('click', (e) => {
      e.preventDefault();
      cancelEdit();
    });
    
    if (btnReset) btnReset.addEventListener('click', (e) => {
      e.preventDefault();
      resetForm();
    });
    
    if (btnClear) btnClear.addEventListener('click', handleClearData);
    if (btnExport) btnExport.addEventListener('click', handleExportCSV);
    
    // Import CSV listener
    if (fileImport) {
      fileImport.addEventListener('change', handleImportCSV);
    }
  }
  
  function populateCategories() {
    if (!categorySelect || !typeSelect) return;
    
    const type = typeSelect.value;
    const categories = DEFAULT_CATEGORIES[type] || [];
    
    categorySelect.innerHTML = '';
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      categorySelect.appendChild(option);
    });
  }
  
  function formatCurrency(amount) {
    const symbol = CURRENCY_SYMBOLS[currentCurrency] || '';
    return `${symbol}${amount.toFixed(2)}`;
  }
  
  function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  function handleFormSubmit(e) {
    e.preventDefault();
    
    const type = typeSelect.value;
    const amount = parseFloat(amountInput.value);
    let category = categorySelect.value;
    const date = dateInput.value;
    const description = noteInput.value.trim();
    const customCat = customCategoryInput ? customCategoryInput.value.trim() : '';
    
    if (category === 'Other' || customCat) {
      category = customCat || category;
    }
    
    if (!amount || amount <= 0 || !date) {
      alert('Please enter a valid amount and date.');
      return;
    }
    
    try {
      transactions = ledger.upsert({ type, amount, category, date, description }, editingId);
    } catch (_error) {
      alert('Please enter a valid transaction.');
      return;
    }

    resetForm();
    updateUI();
  }
  
  function startEdit(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    
    editingId = id;
    
    typeSelect.value = tx.type;
    populateCategories();
    
    amountInput.value = tx.amount;
    dateInput.value = tx.date;
    noteInput.value = tx.description;
    
    if (Array.from(categorySelect.options).some(opt => opt.value === tx.category)) {
      categorySelect.value = tx.category;
      if (customCategoryInput) customCategoryInput.value = '';
    } else {
      categorySelect.value = 'Other';
      if (customCategoryInput) customCategoryInput.value = tx.category;
    }
    
    if (btnSave) btnSave.textContent = 'Update transaction';
    if (btnCancelEdit) btnCancelEdit.hidden = false;
  }
  
  function cancelEdit() {
    resetForm();
  }
  
  function resetForm() {
    editingId = null;
    if (form) form.reset();
    populateCategories();
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
    if (btnSave) btnSave.textContent = 'Save transaction';
    if (btnCancelEdit) btnCancelEdit.hidden = true;
  }
  
  function deleteTransaction(id) {
    if (confirm('Are you sure you want to delete this transaction?')) {
      transactions = transactions.filter(t => t.id !== id);
      transactions = ledger.remove(id);
      updateUI();
    }
  }
  
  function getFilteredTransactions() {
    const selectedMonth = monthInput ? monthInput.value : '';
    const selectedType = filterType ? filterType.value : 'all';
    const selectedCategory = filterCategory ? filterCategory.value : 'all';
    
    return Core.filterTransactions(transactions, selectedMonth, selectedType, selectedCategory);
  }
  
  function updateUI() {
    updateStats();
    updateTableAndCategories();
    updateChart();
  }
  
  function updateStats() {
    const selectedMonth = monthInput ? monthInput.value : '';
    const totals = Core.calculateTotals(transactions, selectedMonth);
    const income = totals.income;
    const expense = totals.expense;
    const balance = totals.balance;
    
    if (statIncome) statIncome.textContent = formatCurrency(income);
    if (statExpense) statExpense.textContent = formatCurrency(expense);
    if (statBalance) {
      statBalance.textContent = formatCurrency(balance);
      statBalance.className = 'stat-value ' + (balance >= 0 ? 'positive' : 'negative');
    }
    if (statCurrentMonth) {
      const parts = selectedMonth.split('-');
      const monthDate = parts.length === 2 ? new Date(Number(parts[0]), Number(parts[1]) - 1, 1) : new Date();
      statCurrentMonth.textContent = monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
  }
  
  function updateTableAndCategories() {
    if (!tableBody) return;
    
    const selectedMonth = monthInput ? monthInput.value : '';
    const selectedType = filterType ? filterType.value : 'all';
    
    const availableCategories = new Set();
    transactions.forEach(tx => {
      if (selectedMonth && !tx.date.startsWith(selectedMonth)) return;
      if (selectedType !== 'all' && tx.type !== selectedType) return;
      availableCategories.add(tx.category);
    });
    
    if (filterCategory) {
      const currentCat = filterCategory.value;
      filterCategory.innerHTML = '<option value="all">All</option>';
      Array.from(availableCategories).sort().forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        filterCategory.appendChild(opt);
      });
      if (availableCategories.has(currentCat)) {
        filterCategory.value = currentCat;
      } else {
        filterCategory.value = 'all';
      }
    }
    
    const filteredTx = getFilteredTransactions();
    tableBody.innerHTML = '';
    
    if (filteredTx.length === 0) {
      if (emptyMessage) emptyMessage.hidden = false;
    } else {
      if (emptyMessage) emptyMessage.hidden = true;
      
      filteredTx.forEach(tx => {
        const tr = document.createElement('tr');
        
        const tdDate = document.createElement('td');
        tdDate.textContent = tx.date;
        
        const tdType = document.createElement('td');
        tdType.textContent = tx.type;
        
        const tdCat = document.createElement('td');
        tdCat.textContent = tx.category;
        
        const tdDesc = document.createElement('td');
        tdDesc.textContent = tx.description;
        
        const tdAmount = document.createElement('td');
        tdAmount.textContent = formatCurrency(tx.amount);
        tdAmount.className = tx.type === 'income' ? 'amount-income' : 'amount-expense';
        
        const tdActions = document.createElement('td');
        tdActions.className = 'row-actions';
        const btnEdit = document.createElement('button');
        btnEdit.textContent = 'Edit';
        btnEdit.className = 'btn btn-secondary';
        btnEdit.type = 'button';
        btnEdit.addEventListener('click', () => startEdit(tx.id));
        
        const btnDel = document.createElement('button');
        btnDel.textContent = 'Delete';
        btnDel.className = 'btn btn-ghost';
        btnDel.type = 'button';
        btnDel.addEventListener('click', () => deleteTransaction(tx.id));
        
        tdActions.appendChild(btnEdit);
        tdActions.appendChild(btnDel);
        
        tr.appendChild(tdDate);
        tr.appendChild(tdType);
        tr.appendChild(tdCat);
        tr.appendChild(tdDesc);
        tr.appendChild(tdAmount);
        tr.appendChild(tdActions);
        
        tableBody.appendChild(tr);
      });
    }
  }
  
  function updateChart() {
    if (!chartContainer) return;
    
    const selectedMonth = monthInput ? monthInput.value : '';
    
    const categoryTotals = {};
    let maxTotal = 0;
    
    transactions.forEach(tx => {
      if (tx.type !== 'expense') return;
      if (selectedMonth && !tx.date.startsWith(selectedMonth)) return;
      
      categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
      if (categoryTotals[tx.category] > maxTotal) {
        maxTotal = categoryTotals[tx.category];
      }
    });
    
    chartContainer.innerHTML = '';
    
    const sortedCategories = Object.keys(categoryTotals).sort((a, b) => categoryTotals[b] - categoryTotals[a]);
    
    if (sortedCategories.length === 0) {
      chartContainer.innerHTML = '<p class="chart-empty">No expense categories to chart.</p>';
      return;
    }
    
    sortedCategories.forEach(cat => {
      const total = categoryTotals[cat];
      const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
      
      const row = document.createElement('div');
      row.className = 'chart-row';
      
      const label = document.createElement('span');
      label.className = 'chart-label';
      label.textContent = cat;
      
      const barWrap = document.createElement('div');
      barWrap.className = 'chart-bar-wrap';
      
      const bar = document.createElement('div');
      bar.className = 'chart-bar';
      bar.style.width = pct + '%';
      barWrap.appendChild(bar);
      
      const amount = document.createElement('span');
      amount.className = 'chart-amount';
      amount.textContent = formatCurrency(total);
      
      row.appendChild(label);
      row.appendChild(barWrap);
      row.appendChild(amount);
      
      chartContainer.appendChild(row);
    });
  }
  
  function handleClearData() {
    if (confirm('This will delete all expense data. Are you sure?')) {
      transactions = ledger.clear();
      localStorage.setItem(CURRENCY_KEY, currentCurrency);
      resetForm();
      updateUI();
    }
  }
  
  function handleExportCSV() {
    const filteredTx = getFilteredTransactions();
    if (filteredTx.length === 0) {
      alert('No transactions to export.');
      return;
    }
    
    const csvContent = Core.toCSV(filteredTx);
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'toolbox-expenses.csv';
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  
  function handleImportCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
      const imported = Core.parseCSV(event.target.result, generateUUID);
      const importedCount = imported.length;
      
      if (importedCount > 0) {
        transactions = ledger.replace(transactions.concat(imported));
        updateUI();
        alert(`Successfully imported ${importedCount} transactions.`);
      } else {
        alert('Could not parse any transactions from the CSV.');
      }
      
      if (fileImport) fileImport.value = '';
    };
    
    reader.readAsText(file);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

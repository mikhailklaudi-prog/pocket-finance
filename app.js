const tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();
    if (typeof tg.enableClosingConfirmation === 'function') {
        tg.enableClosingConfirmation();
    }
}

const urlParams = new URLSearchParams(window.location.search);
const currentUserId = tg?.initDataUnsafe?.user?.id || parseInt(urlParams.get('user_id')) || 0;

function triggerHaptic(type = 'light') {
    if (tg?.HapticFeedback) {
        try {
            if (type === 'selection') {
                tg.HapticFeedback.selectionChanged();
                return;
            }
            if (['success', 'warning', 'error'].includes(type)) {
                tg.HapticFeedback.notificationOccurred(type);
                return;
            }
            tg.HapticFeedback.impactOccurred(type);
            return;
        } catch (e) {}
    }
    if (navigator.vibrate) {
        if (type === 'selection' || type === 'light') navigator.vibrate(12);
        else if (type === 'success') navigator.vibrate([15, 25, 20]);
        else if (type === 'warning' || type === 'error') navigator.vibrate([30, 40, 30]);
    }
}

const categoryStyles = {
    'Авто': {
        activeCard: ['bg-amber-500/15', 'border-amber-500/50', 'ring-2', 'ring-amber-500', 'text-amber-400'],
        badge: 'text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20'
    },
    'Еда': {
        activeCard: ['bg-orange-500/15', 'border-orange-500/50', 'ring-2', 'ring-orange-500', 'text-orange-400'],
        badge: 'text-xs font-semibold px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20'
    },
    'Покупки': {
        activeCard: ['bg-sky-500/15', 'border-sky-500/50', 'ring-2', 'ring-sky-500', 'text-sky-400'],
        badge: 'text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20'
    },
    'Заметка': {
        activeCard: ['bg-purple-500/15', 'border-purple-500/50', 'ring-2', 'ring-purple-500', 'text-purple-400'],
        badge: 'text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20'
    },
    'Доход': {
        activeCard: ['bg-emerald-500/15', 'border-emerald-400/50', 'ring-2', 'ring-emerald-400', 'text-emerald-300'],
        badge: 'text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
    }
};

const tabStyles = {
    'all': ['bg-blue-600', 'text-white', 'shadow-md', 'shadow-blue-600/20'],
    'expense': ['bg-rose-600', 'text-white', 'shadow-md', 'shadow-rose-600/20'],
    'income': ['bg-emerald-600', 'text-white', 'shadow-md', 'shadow-emerald-600/20'],
    'note': ['bg-purple-600', 'text-white', 'shadow-md', 'shadow-purple-600/20']
};

const defaultCardClasses = ['cat-card', 'flex', 'flex-col', 'items-center', 'justify-center', 'p-2.5', 'rounded-2xl', 'bg-slate-900', 'border', 'border-slate-800', 'text-slate-400'];
const defaultTabClasses = ['tab-btn', 'flex-1', 'py-1.5', 'text-xs', 'font-medium', 'rounded-xl', 'text-slate-400', 'hover:text-slate-200'];

let state = {
    balance: 0,
    income: 0,
    expense: 0,
    currentCategory: 'Авто',
    currentType: 'expense',
    currentFilterTab: 'all',
    transactions: JSON.parse(localStorage.getItem('pocket_transactions') || '[]')
};

const balanceEl = document.getElementById('total-balance');
const incomeEl = document.getElementById('total-income');
const expenseEl = document.getElementById('total-expense');
const amountInput = document.getElementById('input-amount');
const noteInput = document.getElementById('input-note');
const saveBtn = document.getElementById('btn-save');
const resetBtn = document.getElementById('btn-reset');
const catBadge = document.getElementById('current-cat-badge');
const historyList = document.getElementById('history-list');
const historyCounter = document.getElementById('history-counter');
const structureBar = document.getElementById('structure-bar');
const structureLabel = document.getElementById('expense-structure-label');
const tabButtons = document.querySelectorAll('.tab-btn');
const catCards = document.querySelectorAll('.cat-card');

async function syncWithServer() {
    try {
        const res = await fetch(`/api/data?user_id=${currentUserId}`);
        if (!res.ok) throw new Error('Сервер недоступен');
        const data = await res.json();
        if (data.transactions) {
            state.transactions = data.transactions;
            localStorage.setItem('pocket_transactions', JSON.stringify(data.transactions));
        }
    } catch (err) {
        console.warn('Локальный режим:', err);
    }
    render();
}

catCards.forEach(card => {
    card.addEventListener('click', () => {
        triggerHaptic('selection');
        const cat = card.dataset.category;
        state.currentCategory = cat;

        catCards.forEach(c => { c.className = defaultCardClasses.join(' '); });
        const style = categoryStyles[cat];
        if (style) card.classList.add(...style.activeCard);

        const icon = card.querySelector('svg, i');
        if (icon) {
            icon.classList.remove('animate-pop');
            void icon.offsetWidth;
            icon.classList.add('animate-pop');
        }

        if (cat === 'Доход') {
            state.currentType = 'income';
            catBadge.textContent = 'Доход';
        } else if (cat === 'Заметка') {
            state.currentType = 'note';
            catBadge.textContent = 'Заметка';
        } else {
            state.currentType = 'expense';
            const sub = cat === 'Авто' ? 'Топливо' : (cat === 'Еда' ? 'Продукты' : 'Покупки');
            catBadge.textContent = `${cat} / ${sub}`;
        }

        if (style && catBadge) catBadge.className = style.badge;
    });
});

tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        triggerHaptic('selection');
        const tabKey = btn.dataset.tab;
        state.currentFilterTab = tabKey;

        tabButtons.forEach(b => { b.className = defaultTabClasses.join(' '); });
        const activeTabClass = tabStyles[tabKey] || ['bg-blue-600', 'text-white'];
        btn.className = `tab-btn flex-1 py-1.5 text-xs font-semibold rounded-xl ${activeTabClass.join(' ')}`;

        renderHistory();
    });
});

async function saveOperation() {
    const rawVal = amountInput.value.replace(',', '.').trim();
    const amount = parseFloat(rawVal) || 0;
    const note = noteInput.value.trim() || state.currentCategory;

    if (state.currentType !== 'note' && (!amount || amount <= 0)) {
        triggerHaptic('error');
        amountInput.classList.add('border-rose-500', 'ring-2', 'ring-rose-500/50');
        amountInput.focus();
        setTimeout(() => amountInput.classList.remove('border-rose-500', 'ring-2', 'ring-rose-500/50'), 1000);
        return;
    }

    const item = {
        id: Date.now(),
        user_id: currentUserId,
        type: state.currentType,
        category: state.currentCategory,
        amount: state.currentType === 'note' ? 0 : amount,
        note: note,
        date: new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
    };

    state.transactions.unshift(item);
    localStorage.setItem('pocket_transactions', JSON.stringify(state.transactions));
    render();
    triggerHaptic('success');

    amountInput.value = '';
    noteInput.value = '';

    try {
        const res = await fetch('/api/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
        });
        const serverData = await res.json();
        if (serverData.transactions) {
            state.transactions = serverData.transactions;
            render();
        }
    } catch (e) {
        console.error('Ошибка сохранения:', e);
    }
}

if (saveBtn) saveBtn.addEventListener('click', saveOperation);

// Удаление отдельной операции
async function deleteOperation(id) {
    triggerHaptic('warning');
    // Оптимистичное удаление из интерфейса
    state.transactions = state.transactions.filter(t => t.id !== id);
    localStorage.setItem('pocket_transactions', JSON.stringify(state.transactions));
    render();

    // Запрос на сервер для удаления из базы данных
    try {
        const res = await fetch('/api/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUserId, id: id })
        });
        const serverData = await res.json();
        if (serverData.transactions) {
            state.transactions = serverData.transactions;
            render();
        }
    } catch (e) {
        console.error('Ошибка удаления на сервере:', e);
    }
}

if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
        if (state.transactions.length === 0) return;
        if (confirm('Очистить всю историю кошелька?')) {
            triggerHaptic('warning');
            state.transactions = [];
            localStorage.removeItem('pocket_transactions');
            render();
            try {
                await fetch('/api/reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: currentUserId })
                });
            } catch (e) {}
        }
    });
}

function render() {
    let inc = 0;
    let exp = 0;
    const catExpenses = { 'Авто': 0, 'Еда': 0, 'Покупки': 0, 'Другое': 0 };

    state.transactions.forEach(t => {
        const val = parseFloat(t.amount) || 0;
        if (t.type === 'income') {
            inc += val;
        } else if (t.type === 'expense') {
            exp += val;
            if (catExpenses[t.category] !== undefined) catExpenses[t.category] += val;
            else catExpenses['Другое'] += val;
        }
    });

    state.income = inc;
    state.expense = exp;
    state.balance = inc - exp;

    if (balanceEl) balanceEl.textContent = `${state.balance.toLocaleString('ru-RU')} ₽`;
    if (incomeEl) incomeEl.textContent = `+${state.income.toLocaleString('ru-RU')} ₽`;
    if (expenseEl) expenseEl.textContent = `-${state.expense.toLocaleString('ru-RU')} ₽`;
    if (historyCounter) historyCounter.textContent = `${state.transactions.length} зап.`;

    renderExpenseBar(catExpenses, exp);
    renderHistory();
}

function renderExpenseBar(catExp, totalExp) {
    if (!structureBar || !structureLabel) return;
    structureBar.innerHTML = '';

    if (totalExp === 0) {
        structureLabel.textContent = 'Нет данных';
        structureBar.innerHTML = '<div class="w-full h-full bg-slate-800"></div>';
        return;
    }

    structureLabel.textContent = `${totalExp.toLocaleString('ru-RU')} ₽`;
    const colors = {
        'Авто': 'bg-amber-400',
        'Еда': 'bg-orange-400',
        'Покупки': 'bg-sky-400',
        'Другое': 'bg-slate-600'
    };

    for (const [cat, sum] of Object.entries(catExp)) {
        if (sum > 0) {
            const pct = (sum / totalExp) * 100;
            const segment = document.createElement('div');
            segment.className = `h-full ${colors[cat] || 'bg-slate-500'}`;
            segment.style.width = `${pct}%`;
            segment.title = `${cat}: ${Math.round(pct)}%`;
            structureBar.appendChild(segment);
        }
    }
}

function renderHistory() {
    if (!historyList) return;
    historyList.innerHTML = '';

    const filtered = state.transactions.filter(t => {
        if (state.currentFilterTab === 'all') return true;
        return t.type === state.currentFilterTab;
    });

    if (filtered.length === 0) {
        historyList.innerHTML = `
            <div class="text-center text-slate-500 py-6 text-xs border border-dashed border-slate-800 rounded-2xl">
                В этой вкладке пока нет записей
            </div>
        `;
        return;
    }

    const categoryThemes = {
        'Авто': { iconBox: 'bg-amber-500/15 border border-amber-500/30 text-amber-400', cardBorder: 'border-l-4 border-l-amber-500', badgeText: 'text-amber-400', icon: 'car' },
        'Еда': { iconBox: 'bg-orange-500/15 border border-orange-500/30 text-orange-400', cardBorder: 'border-l-4 border-l-orange-500', badgeText: 'text-orange-400', icon: 'utensils' },
        'Покупки': { iconBox: 'bg-sky-500/15 border border-sky-500/30 text-sky-400', cardBorder: 'border-l-4 border-l-sky-500', badgeText: 'text-sky-400', icon: 'shopping-bag' },
        'Заметка': { iconBox: 'bg-purple-500/15 border border-purple-500/30 text-purple-400', cardBorder: 'border-l-4 border-l-purple-500', badgeText: 'text-purple-400', icon: 'file-text' },
        'Доход': { iconBox: 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400', cardBorder: 'border-l-4 border-l-emerald-500', badgeText: 'text-emerald-400', icon: 'banknote' }
    };

    filtered.forEach(t => {
        const isInc = t.type === 'income';
        const isNote = t.type === 'note';

        const theme = categoryThemes[t.category] || {
            iconBox: isInc ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' : 'bg-rose-500/15 border border-rose-500/30 text-rose-400',
            cardBorder: isInc ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-rose-500',
            badgeText: isInc ? 'text-emerald-400' : 'text-rose-400',
            icon: isInc ? 'arrow-down-left' : 'arrow-up-right'
        };

        let amountText = isNote ? 'Заметка' : `${isInc ? '+' : '-'}${parseFloat(t.amount).toLocaleString('ru-RU')} ₽`;
        let amountColor = isNote ? 'text-purple-400 font-medium' : (isInc ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold');

        const row = document.createElement('div');
        row.className = `flex items-center justify-between p-3 bg-slate-900 border border-slate-800/80 rounded-2xl shadow-sm ${theme.cardBorder}`;
        row.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${theme.iconBox}">
                    <i data-lucide="${theme.icon}" class="w-5 h-5"></i>
                </div>
                <div>
                    <div class="font-medium text-slate-100 text-xs">${t.note}</div>
                    <div class="text-[10px] text-slate-500">
                        <span class="${theme.badgeText} font-medium">${t.category}</span> • ${t.date}
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <div class="text-xs ${amountColor}">${amountText}</div>
                <button type="button" class="btn-delete p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors" data-id="${t.id}" title="Удалить запись">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i>
                </button>
            </div>
        `;
        historyList.appendChild(row);
    });

    // Навешиваем слушатели удаления
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            deleteOperation(id);
        });
    });

    if (window.lucide) window.lucide.createIcons();
}

render();
syncWithServer();
if (window.lucide) window.lucide.createIcons();
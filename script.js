const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const currentMonth = currentDate.getMonth();
const currentDay = currentDate.getDate();

let chartInstance = null;
let plannedEvents = [];

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('calc-btn').addEventListener('click', updateChart);
    document.getElementById('add-expense-btn').addEventListener('click', addPlannedEvent);
    updateChart();
});

function addPlannedEvent() {
    const name = document.getElementById('expense-name').value;
    const dateStr = document.getElementById('expense-date').value;
    const amountStr = document.getElementById('expense-amount').value;
    
    if (!name || !dateStr || !amountStr) {
        alert('イベント名・日付・金額を入力してください。');
        return;
    }
    
    plannedEvents.push({
        id: Date.now(),
        name,
        date: new Date(dateStr),
        amount: parseInt(amountStr, 10)
    });
    
    plannedEvents.sort((a, b) => a.date - b.date);
    
    renderEventList();
    updateChart();
    
    document.getElementById('expense-name').value = '';
    document.getElementById('expense-amount').value = '';
}

window.removeEvent = function(id) {
    plannedEvents = plannedEvents.filter(e => e.id !== id);
    renderEventList();
    updateChart();
}

function renderEventList() {
    const list = document.getElementById('expense-list');
    list.innerHTML = '';
    
    plannedEvents.forEach(e => {
        const li = document.createElement('li');
        const d = e.date;
        const fmtDate = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
        const fmtAmount = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(e.amount);
        
        li.innerHTML = `
            <div class="event-info">
                <strong>${e.name}</strong>
                <span>${fmtDate} （支出: ${fmtAmount}）</span>
            </div>
            <button class="delete-btn" onclick="removeEvent(${e.id})">削除</button>
        `;
        list.appendChild(li);
    });
}

function updateChart() {
    const income = parseInt(document.getElementById('income').value, 10) || 0;
    const expenses = parseInt(document.getElementById('expenses').value, 10) || 0;
    const currentSavings = parseInt(document.getElementById('savings').value, 10) || 0;
    const yieldRate = parseFloat(document.getElementById('yield').value) || 0;
    const pastMonths = parseInt(document.getElementById('past-months').value, 10) || 0;
    const futureMonths = parseInt(document.getElementById('future-months').value, 10) || 0;
    
    const monthlyYield = (yieldRate / 100) / 12;
    
    const labels = [];
    const baseSavings = [];
    const actualSavings = [];
    const hasEventMarkers = [];
    
    const groupedEvents = {};
    plannedEvents.forEach(ev => {
        const k = `${ev.date.getFullYear()}-${String(ev.date.getMonth() + 1).padStart(2, '0')}`;
        groupedEvents[k] = (groupedEvents[k] || 0) + ev.amount;
    });

    const totalPeriodSavings = [];
    
    for (let m = -pastMonths; m <= futureMonths; m++) {
        const d = new Date(currentYear, currentMonth + m, currentDay);
        labels.push(`${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`);
    }

    // Math calculation logic
    // Start by finding Month 0 index
    const m0Index = pastMonths; 
    
    // Arrays matching the length of labels
    const len = labels.length;
    baseSavings.length = len;
    actualSavings.length = len;
    hasEventMarkers.length = len;
    
    baseSavings[m0Index] = currentSavings;
    actualSavings[m0Index] = currentSavings;
    hasEventMarkers[m0Index] = false;

    // Calculate Backwards
    for (let m = -1; m >= -pastMonths; m--) {
        const idx = m0Index + m;
        const d = new Date(currentYear, currentMonth + m, 1);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const pExp = groupedEvents[k] || 0;
        
        hasEventMarkers[idx] = pExp > 0;
        baseSavings[idx] = baseSavings[idx + 1] - income + expenses;
        actualSavings[idx] = actualSavings[idx + 1] - income + expenses + pExp;
    }

    // Calculate Forwards
    for (let m = 1; m <= futureMonths; m++) {
        const idx = m0Index + m;
        const d = new Date(currentYear, currentMonth + m, 1);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const pExp = groupedEvents[k] || 0;
        
        hasEventMarkers[idx] = pExp > 0;
        
        const baseInterest = baseSavings[idx - 1] > 0 ? baseSavings[idx - 1] * monthlyYield : 0;
        baseSavings[idx] = baseSavings[idx - 1] + income - expenses + baseInterest;
        
        const actualInterest = actualSavings[idx - 1] > 0 ? actualSavings[idx - 1] * monthlyYield : 0;
        actualSavings[idx] = actualSavings[idx - 1] + income - expenses - pExp + actualInterest;
    }
    
    updateSummaryCards(actualSavings, income, expenses);
    renderChart(labels, actualSavings, baseSavings, hasEventMarkers);

    // AIチャット履歴をリセットし、常に最新の計算結果でアドバイスを作り直す
    const chatMsgs = document.getElementById('chat-messages');
    const aiModal = document.getElementById('ai-chat-modal');
    if (chatMsgs && aiModal) {
        chatMsgs.innerHTML = '';
        // もしチャット画面がすでに開いていれば、即座に新しいアドバイスを表示する
        if (!aiModal.classList.contains('hidden')) {
            generateInitialAdvice();
        }
    }
}

function updateSummaryCards(actualSavings, income, expenses) {
    const finalVal = actualSavings[actualSavings.length - 1];
    const initialVal = actualSavings[0];
    const cumulative = finalVal - initialVal;
    
    const monthlyVal = income - expenses;
    const rateVal = income > 0 ? ((monthlyVal / income) * 100).toFixed(1) : 0;
    
    const fmt = (num) => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(num);

    document.getElementById('val-final').textContent = fmt(finalVal);
    document.getElementById('val-cumulative').textContent = fmt(cumulative);
    document.getElementById('val-monthly').textContent = fmt(monthlyVal);
    document.getElementById('val-rate').textContent = `${rateVal}%`;
}

function renderChart(labels, actualSavings, baseSavings, hasEventMarkers) {
    const ctx = document.getElementById('simulationChart').getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy();
    }

    // Point styling dynamically based on events
    const pointRadii = actualSavings.map((_, i) => hasEventMarkers[i] ? 6 : 0);
    const pointBgColors = actualSavings.map((_, i) => hasEventMarkers[i] ? '#ef4444' : 'transparent');
    const pointBorderColors = actualSavings.map((_, i) => hasEventMarkers[i] ? '#ef4444' : 'transparent');
    const pointHoverRadii = actualSavings.map((_, i) => hasEventMarkers[i] ? 8 : 4);
    
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: '残高',
                    data: actualSavings,
                    borderColor: '#8b5cf6', // Purple solid
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.1,
                    pointRadius: pointRadii,
                    pointBackgroundColor: pointBgColors,
                    pointBorderColor: pointBorderColors,
                    pointBorderWidth: 2,
                    pointHoverRadius: pointHoverRadii,
                    pointHoverBackgroundColor: '#ef4444',
                    order: 1
                },
                {
                    label: '予定支出なし残高',
                    data: baseSavings,
                    borderColor: '#14b8a6', // Teal dashed
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    order: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#1f2937',
                    bodyColor: '#4b5563',
                    borderColor: '#e5e7eb',
                    borderWidth: 1,
                    padding: 12,
                    titleFont: { size: 14, family: 'Inter' },
                    bodyFont: { size: 14, family: 'Inter' },
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                },
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'dash',
                        padding: 20,
                        color: '#4b5563',
                        font: { family: 'Inter', size: 13, weight: '600' }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: '#f3f4f6',
                        drawBorder: false
                    },
                    ticks: { 
                        color: '#9ca3af',
                        font: { family: 'Inter', size: 11 },
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { 
                        color: '#f3f4f6',
                        drawBorder: false
                    },
                    border: { dash: [4, 4] },
                    ticks: { 
                        color: '#9ca3af',
                        font: { family: 'Inter', size: 12 },
                        callback: function(value) {
                            if (value === 0) return '¥0万';
                            return '¥' + (value / 10000) + '万';
                        }
                    }
                }
            }
        }
    });

    // Custom legend dash styling overriding default Chart.js rect
    chartInstance.legend.options.labels.generateLabels = function(chart) {
        const labels = Chart.defaults.plugins.legend.labels.generateLabels(chart);
        labels.forEach(label => {
            if (label.text === '残高') {
                label.pointStyle = 'line';
                label.lineWidth = 2;
            } else if (label.text === '予定支出なし残高') {
                label.pointStyle = 'line';
                label.lineDash = [5, 5];
                label.lineWidth = 2;
            }
        });
        return labels;
    };
}

// AI Chat Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('open-chat-btn').addEventListener('click', openChat);
    document.getElementById('close-chat-btn').addEventListener('click', closeChat);
    document.getElementById('send-chat-btn').addEventListener('click', handleUserChat);
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleUserChat();
    });
});

function openChat() {
    document.getElementById('ai-chat-modal').classList.remove('hidden');
    const msgContainer = document.getElementById('chat-messages');
    
    // Only generate initial advice if empty
    if (msgContainer.children.length === 0) {
        generateInitialAdvice();
    }
}

function closeChat() {
    document.getElementById('ai-chat-modal').classList.add('hidden');
}

function appendMessage(text, sender) {
    const msgContainer = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    div.innerHTML = text.replace(/\n/g, '<br>'); // Simple formatting
    msgContainer.appendChild(div);
    msgContainer.scrollTop = msgContainer.scrollHeight;
}

function generateInitialAdvice() {
    const income = parseInt(document.getElementById('income').value, 10) || 0;
    const expenses = parseInt(document.getElementById('expenses').value, 10) || 0;
    const yieldRate = parseFloat(document.getElementById('yield').value) || 0;
    
    let advice = "現在のシミュレーション状況を分析しています...<br><br>";
    
    const monthlyBalance = income - expenses;
    if (income === 0 && expenses === 0) {
        advice += "まだ収入と支出が入力されていないようです。詳細なアドバイスをご希望の場合は、現在の月収や月支出をご入力ください！";
    } else if (monthlyBalance > 0) {
        const rate = ((monthlyBalance / income) * 100).toFixed(1);
        advice += `毎月 **${new Intl.NumberFormat('ja-JP').format(monthlyBalance)}円** の黒字となっており、貯蓄率 **${rate}%** は非常に優秀な水準です。`;
        if (yieldRate === 0) {
            advice += "現在の貯蓄を現金のままお持ちのようなので、NISAなどを活用しインデックス投資など複利効果（年利3%〜5%程度）を見込める運用を取り入れると、将来の資産形成がさらに加速します。";
        } else {
            advice += `設定されている想定利回り（${yieldRate}%）での運用を継続できれば、計画的な資産増が見込めます。`;
        }
    } else {
        advice += `毎月 **${new Intl.NumberFormat('ja-JP').format(Math.abs(monthlyBalance))}円** の赤字となっている可能性があります。まずは固定費（通信費や保険料など）の見直しを行うことをおすすめします。`;
    }
    
    if (plannedEvents.length > 0) {
        const nextEvent = plannedEvents[0];
        advice += `<br><br>また、直近の大きな予定支出として「**${nextEvent.name}**」（${new Intl.NumberFormat('ja-JP').format(nextEvent.amount)}円）が控えています。これに向けた計画的な現金確保も意識してみてください。`;
    }
    
    advice += "<br><br>資金計画や投資について、気になることがあれば何でも質問してください！AIが専門的な観点からお答えします。";
    
    appendMessage("考え中...", "ai");
    setTimeout(() => {
        const messages = document.getElementById('chat-messages');
        messages.removeChild(messages.lastChild);
        appendMessage(advice, "ai");
    }, 800);
}

function handleUserChat() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    
    appendMessage(text, "user");
    input.value = '';
    
    appendMessage("考え中...", "ai");
    setTimeout(() => {
        const messages = document.getElementById('chat-messages');
        messages.removeChild(messages.lastChild);
        
        let response = "";
        if (text.includes("投資") || text.includes("運用") || text.includes("NISA")) {
            response = "投資についてですね。初心者の方には新NISA制度を活用した「全世界株式」や「S&P500」などのインデックスファンドへの積立投資が定石とされています。月々無理のない範囲（例えば月3万円など）から始めるのがおすすめです。";
        } else if (text.includes("節約") || text.includes("見直し")) {
            response = "節約の第一歩は「固定費の削減」です。スマホを格安SIMに変える、不要なサブスクリプションを解約する、保険の重複を見直すといった行動が最も効果が高く、毎月の収支改善に直結します。";
        } else if (text.includes("ありがとう") || text.includes("なるほど")) {
            response = "どういたしまして！シミュレーション結果をもとに、より良い家計管理を目指して頑張ってください。いつでもご相談に乗りますよ。";
        } else {
            response = "ご質問ありがとうございます。専門的なFP（ファイナンシャルプランナー）の観点から言えば、まずは「生活防衛資金（生活費の半年〜1年分）」を現金で確保した上で、余剰資金を運用に回すのが鉄則です。このシミュレーションを活用して、ゴールに向けた計画を立ててみてくださいね。";
        }
        
        appendMessage(response, "ai");
    }, 1500);
}

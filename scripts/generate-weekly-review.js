const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, '..', 'content');
const DATA_DIR = path.join(__dirname, '..', 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

// Обеспечиваем существование директории
if (!fs.existsSync(CONTENT_DIR)) {
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
}

// Форматирование даты
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

function formatDateISO(date) {
    return date.toISOString().split('T')[0];
}

// Создание slug из названия
function createSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

// Генерация статьи "Неделя рынков"
function generateWeeklyReview() {
    console.log('Генерация статьи "Неделя рынков"...');

    // Загружаем историю
    if (!fs.existsSync(HISTORY_FILE)) {
        console.error('Файл history.json не найден');
        return null;
    }

    const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    if (history.length < 7) {
        console.warn('Недостаточно данных для анализа (менее 7 дней)');
        return null;
    }

    // Берём данные за последнюю неделю (7 дней)
    const latest = history[history.length - 1];
    const weekAgo = history[history.length - 7] || history[0];

    const today = new Date();
    const weekAgoDate = new Date(today);
    weekAgoDate.setDate(weekAgoDate.getDate() - 7);

    // Расчёт изменений в процентах и рублях
    function calculateChange(current, previous) {
        if (!current || !previous) return { percent: 0, rubles: 0 };
        const percent = ((current - previous) / previous) * 100;
        const rubles = current - previous;
        return { percent, rubles };
    }

    const changes = {
        usd: calculateChange(latest.usd, weekAgo.usd),
        eur: calculateChange(latest.eur, weekAgo.eur),
        cny: calculateChange(latest.cny, weekAgo.cny),
        gold: calculateChange(latest.gold, weekAgo.gold),
        btc: latest.btc && weekAgo.btc ? calculateChange(latest.btc, weekAgo.btc) : { percent: 0, rubles: 0 }
    };

    // Формируем нейтральный комментарий
    let marketComment = 'На этой неделе валютный рынок показал смешанную динамику. ';
    
    const usdDirection = changes.usd.percent >= 0 ? 'укрепился' : 'ослаб';
    const eurDirection = changes.eur.percent >= 0 ? 'вырос' : 'снизился';
    
    marketComment += `Доллар ${usdDirection} на ${Math.abs(changes.usd.percent).toFixed(2)}%, евро ${eurDirection} на ${Math.abs(changes.eur.percent).toFixed(2)}%. `;
    
    if (changes.gold.percent > 3) {
        marketComment += 'Золото показало значительный рост, что может свидетельствовать о повышенном спросе на защитные активы. ';
    } else if (changes.gold.percent < -3) {
        marketComment += 'Золото скорректировалось вниз после недавних максимумов. ';
    } else {
        marketComment += 'Золото торгуется в боковом диапазоне без выраженной динамики. ';
    }

    // Дата начала недели
    const weekStart = formatDate(weekAgoDate);
    const weekEnd = formatDate(today);

    // Создаём MD файл
    const mdContent = `---
title: Неделя рынков: ${weekStart} – ${weekEnd}
category: Обзоры рынков
date: ${formatDateISO(today)}
slug: nedelya-rynkov-${formatDateISO(today)}
teaser: Обзор изменений ключевых активов за неделю: доллар, евро, юань, золото и биткоин. Анализ динамики и комментарии.
---

## 📊 Обзор рынка за неделю

Период: **${weekStart} – ${weekEnd}**

### 💱 Валюты

| Актив | Начало недели | Конец недели | Изменение ₽ | Изменение % |
|-------|--------------|--------------|-------------|-------------|
| USD   | ${weekAgo.usd?.toFixed(2) || '—'} | ${latest.usd?.toFixed(2) || '—'} | ${changes.usd.rubles >= 0 ? '+' : ''}${changes.usd.rubles.toFixed(2)} | ${changes.usd.percent >= 0 ? '+' : ''}${changes.usd.percent.toFixed(2)}% |
| EUR   | ${weekAgo.eur?.toFixed(2) || '—'} | ${latest.eur?.toFixed(2) || '—'} | ${changes.eur.rubles >= 0 ? '+' : ''}${changes.eur.rubles.toFixed(2)} | ${changes.eur.percent >= 0 ? '+' : ''}${changes.eur.percent.toFixed(2)}% |
| CNY   | ${weekAgo.cny?.toFixed(2) || '—'} | ${latest.cny?.toFixed(2) || '—'} | ${changes.cny.rubles >= 0 ? '+' : ''}${changes.cny.rubles.toFixed(2)} | ${changes.cny.percent >= 0 ? '+' : ''}${changes.cny.percent.toFixed(2)}% |

### 🥇 Драгметаллы

| Актив | Начало недели | Конец недели | Изменение ₽ | Изменение % |
|-------|--------------|--------------|-------------|-------------|
| Золото (за грамм) | ${weekAgo.gold?.toFixed(2) || '—'} | ${latest.gold?.toFixed(2) || '—'} | ${changes.gold.rubles >= 0 ? '+' : ''}${changes.gold.rubles.toFixed(2)} | ${changes.gold.percent >= 0 ? '+' : ''}${changes.gold.percent.toFixed(2)}% |

### ₿ Криптовалюты

| Актив | Начало недели | Конец недели | Изменение $ | Изменение % |
|-------|--------------|--------------|-------------|-------------|
| Bitcoin | ${weekAgo.btc?.toLocaleString() || '—'} | ${latest.btc?.toLocaleString() || '—'} | ${changes.btc.rubles >= 0 ? '+' : ''}${changes.btc.rubles.toFixed(2)} | ${changes.btc.percent >= 0 ? '+' : ''}${changes.btc.percent.toFixed(2)}% |

---

## 📝 Комментарий аналитика

${marketComment}

Важно отметить, что колебания курсов связаны с различными факторами, включая геополитическую ситуацию, изменения цен на нефть и глобальные экономические тренды.

---

<div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 15px; padding: 1.5rem; margin: 2rem 0; font-size: 0.9rem; color: #856404;">

**Дисклеймер:** Данная статья не является инвестиционной рекомендацией. Прошлые результаты не гарантируют будущих доходов. Принимайте инвестиционные решения самостоятельно и осознанно.

</div>
`;

    const fileName = `nedelya-rynkov-${formatDateISO(today)}.md`;
    const filePath = path.join(CONTENT_DIR, fileName);

    // Проверяем, есть ли уже статья за эту неделю
    const existingFiles = fs.readdirSync(CONTENT_DIR).filter(f => 
        f.startsWith('nedelya-rynkov-') && f.endsWith('.md')
    );

    if (existingFiles.length > 0) {
        const latestFile = existingFiles[existingFiles.length - 1];
        const fileDate = latestFile.match(/nedelya-rynkov-(\d{4}-\d{2}-\d{2})\.md/);
        if (fileDate && fileDate[1] === formatDateISO(today)) {
            console.log('Статья за эту неделю уже существует');
            return null;
        }
    }

    fs.writeFileSync(filePath, mdContent, 'utf8');
    console.log(`Создана статья: ${fileName}`);

    return fileName;
}

// Главная функция
function main() {
    const generatedFile = generateWeeklyReview();
    
    if (generatedFile) {
        console.log('Запуск сборки статей...');
        // Запускаем сборку статей
        const { execSync } = require('child_process');
        try {
            execSync('node scripts/build-articles.js', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
        } catch (error) {
            console.error('Ошибка при сборке статей:', error.message);
        }
    } else {
        console.log('Статья не была создана (возможно, уже существует или недостаточно данных)');
    }
}

main();

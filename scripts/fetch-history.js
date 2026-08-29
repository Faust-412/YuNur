const axios = require('axios');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

// Обеспечиваем существование директории
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Форматирование даты для запроса ЦБ (ДД/ММ/ГГГГ)
function formatDateForCBR(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Форматирование даты для JSON (ISO)
function formatDateISO(date) {
    return date.toISOString().split('T')[0];
}

// Получить данные за конкретную дату с ЦБ
async function fetchCBRDataForDate(dateStr) {
    try {
        const url = `https://www.cbr.ru/scripts/XML_daily.asp?date_req=${dateStr}`;
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(response.data);
        
        const valutes = {};
        for (const valve of result.ValCurs.Valute) {
            const charCode = valve.CharCode[0];
            const value = parseFloat(valve.Value[0].replace(',', '.'));
            const nominal = parseInt(valve.Nominal[0]);
            valutes[charCode] = value / nominal;
        }
        
        return valutes;
    } catch (error) {
        console.error(`Ошибка получения данных за ${dateStr}:`, error.message);
        return null;
    }
}

// Получить цену золота за конкретную дату
async function fetchGoldForDate(dateStr) {
    try {
        const url = `https://www.cbr.ru/scripts/XML_metall.asp?date_req=${dateStr}`;
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(response.data);
        
        // Ищем золото (код XAU)
        if (result.Metals && result.Metalls) {
            // Проверяем разные возможные структуры
            const metals = result.Metals.Metall || result.Metalls.Metall || [];
            for (const metal of metals) {
                const code = metal.MetaCode ? metal.MetaCode[0] : '';
                if (code === 'XAU' || (metal.Name && metal.Name[0] && metal.Name[0].includes('золото'))) {
                    const value = parseFloat(metal.Price.replace(',', '.'));
                    const nominal = parseInt(metal.Nominal || 1);
                    return value / nominal;
                }
            }
        }
        
        // Альтернативный парсинг - ищем по массиву
        if (result.Metals) {
            const allMetals = Array.isArray(result.Metals.Metall) 
                ? result.Metals.Metall 
                : (result.Metals.Metall ? [result.Metals.Metall] : []);
            
            for (const metal of allMetals) {
                if (metal.MetaCode && metal.MetaCode[0] === 'XAU') {
                    const value = parseFloat(metal.Price[0].replace(',', '.'));
                    const nominal = parseInt(metal.Nominal ? metal.Nominal[0] : 1);
                    return value / nominal;
                }
            }
        }
        
        return null;
    } catch (error) {
        console.error(`Ошибка получения золота за ${dateStr}:`, error.message);
        return null;
    }
}

// Основная функция для заполнения истории
async function seedHistory() {
    console.log('Заполнение истории за последние 30 дней...');
    
    const today = new Date();
    const records = [];
    
    // Собираем данные за последние 30 дней
    for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        const dateStr = formatDateForCBR(date);
        const isoDate = formatDateISO(date);
        
        console.log(`Получение данных за ${isoDate}...`);
        
        const cbrData = await fetchCBRDataForDate(dateStr);
        
        if (cbrData) {
            let goldPrice = await fetchGoldForDate(dateStr);
            
            // Если золото не найдено, используем расчёт через USD
            if (!goldPrice && cbrData.USD) {
                // Примерная цена золота в USD за унцию (берём среднее)
                const goldPerOunceUSD = 2650;
                const gramsPerOunce = 31.1034768;
                goldPrice = (goldPerOunceUSD / gramsPerOunce) * cbrData.USD;
            }
            
            records.push({
                date: isoDate,
                usd: cbrData.USD || null,
                eur: cbrData.EUR || null,
                cny: cbrData.CNY || null,
                jpy: cbrData.JPY ? cbrData.JPY / 100 : null,
                gold: goldPrice
            });
        }
        
        // Небольшая задержка чтобы не перегружать сервер
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Разворачиваем чтобы старые записи были первыми
    records.reverse();
    
    return records;
}

// Загрузить существующую историю или создать новую
async function loadOrCreateHistory() {
    if (fs.existsSync(HISTORY_FILE)) {
        try {
            const content = fs.readFileSync(HISTORY_FILE, 'utf8');
            const data = JSON.parse(content);
            if (Array.isArray(data) && data.length > 0) {
                console.log(`Загружено существующих записей: ${data.length}`);
                return data;
            }
        } catch (e) {
            console.log('Файл истории повреждён или пуст, создаём новый');
        }
    }
    
    console.log('history.json не существует или пуст, заполняем историю...');
    return await seedHistory();
}

// Добавить новую запись в историю
async function addHistoryRecord() {
    let history = await loadOrCreateHistory();
    
    // Получаем текущие данные
    const today = new Date();
    const isoDate = formatDateISO(today);
    
    // Проверяем, есть ли уже запись за сегодня
    const existingIndex = history.findIndex(r => r.date === isoDate);
    if (existingIndex !== -1) {
        console.log('Запись за сегодня уже существует');
        return history;
    }
    
    const dateStr = formatDateForCBR(today);
    const cbrData = await fetchCBRDataForDate(dateStr);
    
    if (!cbrData) {
        console.error('Не удалось получить данные за сегодня');
        return history;
    }
    
    let goldPrice = await fetchGoldForDate(dateStr);
    if (!goldPrice && cbrData.USD) {
        const goldPerOunceUSD = 2650;
        const gramsPerOunce = 31.1034768;
        goldPrice = (goldPerOunceUSD / gramsPerOunce) * cbrData.USD;
    }
    
    const newRecord = {
        date: isoDate,
        usd: cbrData.USD || null,
        eur: cbrData.EUR || null,
        cny: cbrData.CNY || null,
        jpy: cbrData.JPY ? cbrData.JPY / 100 : null,
        gold: goldPrice
    };
    
    history.push(newRecord);
    
    // Храним только последние 365 записей
    if (history.length > 365) {
        history = history.slice(history.length - 365);
    }
    
    return history;
}

// Главная функция
async function main() {
    let history;
    
    // Проверяем, нужно ли заполнять историю с нуля
    if (!fs.existsSync(HISTORY_FILE) || fs.statSync(HISTORY_FILE).size === 0) {
        history = await seedHistory();
    } else {
        history = await addHistoryRecord();
    }
    
    // Сохраняем
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
    console.log(`История сохранена: ${HISTORY_FILE}`);
    console.log(`Всего записей: ${history.length}`);
}

main().catch(error => {
    console.error('Критическая ошибка:', error);
    process.exit(1);
});

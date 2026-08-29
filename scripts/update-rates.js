const axios = require('axios');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'rates.json');

// Обеспечиваем существование директории data
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function fetchFromCBRXML() {
    // Фолбэк на официальный XML ЦБ
    const response = await axios.get('https://www.cbr.ru/scripts/XML_daily.asp', {
        timeout: 10000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(response.data);
    
    const valutes = {};
    const date = result.ValCurs.$.Date;
    
    for (const valve of result.ValCurs.Valute) {
        const charCode = valve.CharCode[0];
        const value = parseFloat(valve.Value[0].replace(',', '.'));
        const nominal = parseInt(valve.Nominal[0]);
        
        // Нормализуем к курсу за 1 единицу
        valutes[charCode] = {
            value: value / nominal,
            previous: null // Для XML у нас нет предыдущего значения
        };
    }
    
    return { valutes, date };
}

async function fetchFromMirror() {
    // Основной источник - зеркало cbr-xml-daily.ru
    const response = await axios.get('https://www.cbr-xml-daily.ru/daily_json.js', {
        timeout: 10000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    return response.data;
}

async function fetchGoldPrice() {
    try {
        const response = await axios.get('https://api.gold-api.com/price/XAU', {
            timeout: 10000
        });
        return response.data.price; // Цена в USD за тройскую унцию
    } catch (error) {
        console.error('Ошибка получения цены золота:', error.message);
        // Фолбэк цена
        return 2650;
    }
}

async function main() {
    let data;
    
    try {
        data = await fetchFromMirror();
    } catch (error) {
        console.error('Зеркало недоступно, используем официальный XML ЦБ:', error.message);
        const xmlData = await fetchFromCBRXML();
        
        // Преобразуем XML данные в формат, похожий на mirror
        data = {
            Date: xmlData.date,
            PreviousDate: null,
            Valute: {}
        };
        
        for (const [code, info] of Object.entries(xmlData.valutes)) {
            const key = code + '00RUBF_Sell';
            data.Valute[key] = {
                ID: code,
                NumCode: '',
                CharCode: code,
                Nominal: 1,
                Name: code,
                Value: info.value,
                Previous: info.previous
            };
        }
    }
    
    // Получаем цену золота
    const goldPricePerOunceUSD = await fetchGoldPrice();
    
    // Получаем курс доллара для расчёта золота в рублях
    let usdRate;
    if (data.Valute.USD00RUBF_Sell) {
        usdRate = data.Valute.USD00RUBF_Sell.Value || data.Valute.USD00RUBF_Sell.Previous;
    } else {
        // Если доллар не найден, пробуем найти по другому ключу
        for (const key of Object.keys(data.Valute)) {
            if (key.includes('USD')) {
                usdRate = data.Valute[key].Value || data.Valute[key].Previous;
                break;
            }
        }
    }
    
    // Если курс доллара всё ещё не найден, используем примерное значение
    if (!usdRate) {
        usdRate = 90;
        console.warn('Курс доллара не найден, используем значение по умолчанию:', usdRate);
    }
    
    // Расчёт цены золота
    // 1 тройская унция = 31.1034768 г
    const gramsPerOunce = 31.1034768;
    const goldPricePerGramUSD = goldPricePerOunceUSD / gramsPerOunce;
    const goldPricePerGramRUB = goldPricePerGramUSD * usdRate;
    
    // Собираем данные по валютам
    const currencies = [
        {
            code: 'USD',
            name: 'Доллар США',
            value: data.Valute.USD?.Value || data.Valute.USD?.Previous || 0,
            previous: data.Valute.USD?.Previous || null
        },
        {
            code: 'EUR',
            name: 'Евро',
            value: data.Valute.EUR?.Value || data.Valute.EUR?.Previous || 0,
            previous: data.Valute.EUR?.Previous || null
        },
        {
            code: 'CNY',
            name: 'Китайский юань',
            value: data.Valute.CNY?.Value || data.Valute.CNY?.Previous || 0,
            previous: data.Valute.CNY?.Previous || null
        },
        {
            code: 'JPY',
            name: 'Японская иена',
            value: (data.Valute.JPY?.Value || data.Valute.JPY?.Previous || 0) / 100, // JPY за 100 иен, нужно за 1
            previous: data.Valute.JPY?.Previous ? data.Valute.JPY.Previous / 100 : null
        },
        {
            code: 'GOLD',
            name: 'Золото (за грамм)',
            value: goldPricePerGramRUB,
            previous: null // У золота нет предыдущего значения в этом API
        }
    ];
    
    // Формируем итоговый объект
    const ratesData = {
        updatedAt: new Date().toISOString(),
        sourceDate: data.Date,
        currencies: currencies
    };
    
    // Сохраняем в файл
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(ratesData, null, 2), 'utf8');
    
    console.log('Курсы успешно обновлены!');
    console.log('Файл сохранён:', OUTPUT_FILE);
    console.log('Данные:', JSON.stringify(ratesData, null, 2));
}

main().catch(error => {
    console.error('Критическая ошибка:', error);
    process.exit(1);
});

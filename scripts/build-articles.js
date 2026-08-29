const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, '..', 'content');
const ARTICLES_FILE = path.join(CONTENT_DIR, 'articles.json');
const ARTICLES_OUTPUT_DIR = path.join(__dirname, '..', 'articles');

// Обеспечиваем существование директорий
if (!fs.existsSync(CONTENT_DIR)) {
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
}
if (!fs.existsSync(ARTICLES_OUTPUT_DIR)) {
    fs.mkdirSync(ARTICLES_OUTPUT_DIR, { recursive: true });
}

// Парсинг YAML фронтматтера
function parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
        return { frontmatter: {}, body: content };
    }

    const frontmatterStr = match[1];
    const body = match[2];

    const frontmatter = {};
    frontmatterStr.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.slice(0, colonIndex).trim();
            const value = line.slice(colonIndex + 1).trim().replace(/^["']|["']$/g, '');
            frontmatter[key] = value;
        }
    });

    return { frontmatter, body };
}

// Простой Markdown -> HTML конвертер
function markdownToHtml(md) {
    let html = md;

    // Экранирование HTML
    html = html.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');

    // Заголовки
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

    // Жирный текст
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Курсив
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Списки
    html = html.replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Параграфы
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';
    html = html.replace(/^<p><\/p>$/gm, '');

    return html;
}

// Создание тизера из тела статьи
function createTeaser(body, maxLength = 200) {
    const text = body.replace(/[#*]/g, '').trim();
    if (text.length <= maxLength) {
        return text;
    }
    return text.slice(0, maxLength) + '...';
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

// HTML шаблон для страницы статьи
function createArticleHTML(article) {
    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${article.title} — YuNur</title>
    <meta name="description" content="${article.teaser}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;500;700&display=swap&subset=cyrillic" rel="stylesheet">
    <style>
        :root {
            --header-bg: #1b4332;
            --accent-color: #2d6a4f;
            --bg-color: #f2f7f4;
            --text-color: #1b4332;
            --card-bg: #ffffff;
            --white: #ffffff;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'DM Sans', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            line-height: 1.6;
            font-size: 16px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
        }

        header {
            background-color: var(--header-bg);
            color: var(--white);
            padding: 1rem 0;
            position: sticky;
            top: 0;
            z-index: 1000;
        }

        .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .logo {
            display: flex;
            align-items: center;
        }

        .logo img {
            height: 45px;
            border-radius: 8px;
        }

        nav ul {
            display: flex;
            list-style: none;
            gap: 2rem;
        }

        nav a {
            color: var(--white);
            text-decoration: none;
            font-weight: 500;
            transition: opacity 0.3s;
        }

        nav a:hover {
            opacity: 0.8;
        }

        .mobile-menu-btn {
            display: none;
            background: none;
            border: none;
            color: var(--white);
            font-size: 1.5rem;
            cursor: pointer;
        }

        .header-btn {
            background: var(--white);
            color: var(--header-bg);
            padding: 10px 24px;
            border-radius: 40px;
            text-decoration: none;
            font-weight: 600;
            font-size: 0.95rem;
            transition: opacity 0.3s;
        }

        .header-btn:hover {
            opacity: 0.9;
        }

        section {
            padding: 60px 0;
        }

        .article-header {
            background: var(--card-bg);
            padding: 3rem 2rem;
            border-radius: 20px;
            margin-bottom: 2rem;
            border: 1px solid var(--accent-color);
        }

        .article-category {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            margin-bottom: 1rem;
        }

        .article-category.sharia {
            background-color: #e8f5e9;
            color: #1b4332;
        }

        .article-category.gold {
            background-color: #fff8e1;
            color: #f57f17;
        }

        .article-category.zakat {
            background-color: #e3f2fd;
            color: #1565c0;
        }

        .article-category.markets {
            background-color: #fce4ec;
            color: #c2185b;
        }

        .article-category.how {
            background-color: #f3e5f5;
            color: #6a1b9a;
        }

        .article-title {
            font-size: 2.5rem;
            font-weight: 700;
            color: var(--header-bg);
            margin-bottom: 1rem;
            line-height: 1.2;
        }

        .article-meta {
            display: flex;
            gap: 2rem;
            color: #666;
            font-size: 0.95rem;
        }

        .article-content {
            background: var(--card-bg);
            padding: 3rem;
            border-radius: 20px;
            border: 1px solid var(--accent-color);
            margin-bottom: 2rem;
        }

        .article-content h1,
        .article-content h2,
        .article-content h3 {
            color: var(--header-bg);
            margin: 2rem 0 1rem;
        }

        .article-content h1 { font-size: 2rem; }
        .article-content h2 { font-size: 1.75rem; }
        .article-content h3 { font-size: 1.5rem; }

        .article-content p {
            margin-bottom: 1.5rem;
        }

        .article-content ul {
            margin: 1.5rem 0;
            padding-left: 2rem;
        }

        .article-content li {
            margin-bottom: 0.5rem;
        }

        .article-content strong {
            font-weight: 700;
        }

        .disclaimer {
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 15px;
            padding: 1.5rem;
            margin: 2rem 0;
            font-size: 0.9rem;
            color: #856404;
        }

        .article-actions {
            display: flex;
            gap: 1rem;
            justify-content: center;
            flex-wrap: wrap;
        }

        .btn-whatsapp {
            background: #25D366;
            color: white;
            padding: 15px 30px;
            border-radius: 40px;
            text-decoration: none;
            font-weight: 600;
            font-size: 1rem;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            transition: opacity 0.3s;
        }

        .btn-whatsapp:hover {
            opacity: 0.9;
        }

        .btn-application {
            background: var(--accent-color);
            color: white;
            padding: 15px 30px;
            border-radius: 40px;
            text-decoration: none;
            font-weight: 600;
            font-size: 1rem;
            transition: opacity 0.3s;
        }

        .btn-application:hover {
            opacity: 0.9;
        }

        footer {
            background-color: var(--header-bg);
            color: var(--white);
            text-align: center;
            padding: 2rem 0;
        }

        @media (max-width: 768px) {
            .mobile-menu-btn {
                display: block;
            }

            .header-btn {
                display: none;
            }

            nav ul {
                display: none;
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background-color: var(--header-bg);
                flex-direction: column;
                padding: 1rem 0;
                gap: 0;
            }

            nav ul.active {
                display: flex;
            }

            nav ul li {
                text-align: center;
                padding: 0.75rem 0;
            }

            nav ul li a {
                display: block;
                padding: 0.5rem 1rem;
            }

            .article-title {
                font-size: 1.8rem;
            }

            .article-content {
                padding: 1.5rem;
            }

            .article-actions {
                flex-direction: column;
                align-items: stretch;
            }

            .btn-whatsapp,
            .btn-application {
                text-align: center;
                justify-content: center;
            }
        }
    </style>
</head>
<body>
    <header>
        <div class="container header-content">
            <a href="../index.html" class="logo"><img src="../logo.png" alt="YuNur"></a>
            <button class="mobile-menu-btn" onclick="toggleMenu()">☰</button>
            <nav>
                <ul id="nav-menu">
                    <li><a href="../index.html#calculator">Калькулятор</a></li>
                    <li><a href="../index.html#how-it-works">Как это работает</a></li>
                    <li><a href="../index.html#about">О компании</a></li>
                    <li><a href="../rates.html">Курсы валют</a></li>
                    <li><a href="../articles.html">Статьи</a></li>
                </ul>
            </nav>
            <a href="../index.html#application" class="header-btn">Оставить заявку</a>
        </div>
    </header>

    <section>
        <div class="container">
            <div class="article-header">
                <div class="article-category ${article.categoryClass}">
                    <span>${article.categoryIcon}</span>
                    <span>${article.category}</span>
                </div>
                <h1 class="article-title">${article.title}</h1>
                <div class="article-meta">
                    <span>📅 ${formatDate(article.date)}</span>
                </div>
            </div>

            <div class="article-content">
                ${article.content}
                
                ${article.isMarketReview ? `
                <div class="disclaimer">
                    <strong>Дисклеймер:</strong> Данная статья не является инвестиционной рекомендацией. 
                    Прошлые результаты не гарантируют будущих доходов. Принимайте инвестиционные решения 
                    самостоятельно и осознанно.
                </div>
                ` : ''}
            </div>

            <div class="article-actions">
                <a href="https://wa.me/79991234567" class="btn-whatsapp" target="_blank">
                    💬 Задать вопрос в WhatsApp
                </a>
                <a href="../index.html#application" class="btn-application">
                    📝 Оставить заявку
                </a>
            </div>
        </div>
    </section>

    <footer>
        <div class="container">
            <p>&copy; YuNur. Исламская рассрочка без переплат.</p>
        </div>
    </footer>

    <script>
        function toggleMenu() {
            const menu = document.getElementById('nav-menu');
            menu.classList.toggle('active');
        }

        function formatDate(dateStr) {
            const date = new Date(dateStr);
            return date.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        }
    </script>
</body>
</html>`;
}

// Форматирование даты
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

// Категории с иконками и классами
const categories = {
    'Рассрочка и шариат': { icon: '📜', class: 'sharia' },
    'Золото и сбережения': { icon: '🥇', class: 'gold' },
    'Закят': { icon: '💝', class: 'zakat' },
    'Обзоры рынков': { icon: '📊', class: 'markets' },
    'Как мы работаем': { icon: '⚙️', class: 'how' }
};

// Основная функция сборки статей
function buildArticles() {
    console.log('Сборка статей...');

    const articles = [];
    const mdFiles = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));

    mdFiles.forEach(file => {
        const filePath = path.join(CONTENT_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const { frontmatter, body } = parseFrontmatter(content);

        if (!frontmatter.title || !frontmatter.category || !frontmatter.date) {
            console.warn(`Пропущен файл ${file}: отсутствуют обязательные поля`);
            return;
        }

        const slug = frontmatter.slug || createSlug(frontmatter.title);
        const category = categories[frontmatter.category] || { icon: '📄', class: 'how' };
        const teaser = frontmatter.teaser || createTeaser(body);
        const isMarketReview = frontmatter.category === 'Обзоры рынков';

        const article = {
            title: frontmatter.title,
            category: frontmatter.category,
            categoryIcon: category.icon,
            categoryClass: category.class,
            date: frontmatter.date,
            slug: slug,
            teaser: teaser,
            content: markdownToHtml(body),
            isMarketReview: isMarketReview
        };

        // Создаем HTML файл статьи
        const articleHTML = createArticleHTML(article);
        const outputPath = path.join(ARTICLES_OUTPUT_DIR, `${slug}.html`);
        fs.writeFileSync(outputPath, articleHTML, 'utf8');
        console.log(`Создана статья: ${slug}.html`);

        // Добавляем в индекс (без content для компактности)
        articles.push({
            title: article.title,
            category: article.category,
            date: article.date,
            slug: article.slug,
            teaser: article.teaser
        });
    });

    // Сохраняем индекс статей
    fs.writeFileSync(ARTICLES_FILE, JSON.stringify(articles, null, 2), 'utf8');
    console.log(`Индекс статей сохранён: ${ARTICLES_FILE}`);
    console.log(`Всего статей: ${articles.length}`);
}

buildArticles();

# смэш — landing site

Маркетинговый сайт для расширения «смэш» — помощника электронного журнала.

Статический сайт (HTML + CSS + немного ванильного JS), без сборки.

## Локальный запуск

```bash
npm install
npm run dev
```

Откроется live-server на http://localhost:5173.

## Структура

```
home/index.html          — главная          (/home/)
how-it-works/index.html  — как это работает  (/how-it-works/)
pricing/index.html       — тарифы           (/pricing/)
install/index.html       — установка        (/install/)
privacy/index.html       — политика конфиденциальности (/privacy/)
agreement/index.html     — пользовательское соглашение (/agreement/)
index.html                — редирект / → /home/
terms/, legal/*           — редиректы старых ссылок на /agreement/ и /privacy/
assets/                   — шрифты, иконки, видео (сжатые демо-ролики)
styles/                   — токены темы и стили сайта
scripts/                  — переключатель темы и ленивое воспроизведение видео
```

Чистые URL — это папка с `index.html` внутри (стандартное поведение
GitHub Pages), поэтому ссылки внутри страниц пишутся абсолютными путями
со слэшем на конце: `/pricing/`, `/assets/...`, `/styles/...`. Старые
ссылки без слэша (`/pricing`) GitHub Pages сам редиректит на вариант
со слэшем.

## Деплой

Хостинг на GitHub Pages (ветка `main`, папка `/`, без шага сборки).
`CNAME` в корне закрепляет домен `smeshai.xyz`, `.nojekyll` отключает
обработку Jekyll, чтобы файлы отдавались как есть.

> Исходные видеозаписи (крупные `.mp4` в корне) намеренно не входят в
> репозиторий (см. `.gitignore`) — сайт использует сжатые копии из
> `assets/video/`.

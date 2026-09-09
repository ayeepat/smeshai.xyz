# СМЭШ AI product site

Статический HTML/CSS/JavaScript-сайт без шага сборки. Production:
https://smeshai.xyz/.

## Локальный запуск

~~~sh
npm install
npm run dev
~~~

Live server открывается на http://127.0.0.1:5173.

## Основные страницы

- /home/ — продукт;
- /how-it-works/ — сценарий использования;
- /pricing/ — тарифы;
- /checkout/ и /checkout/success/ — серверно подтверждаемая оплата;
- /install/ — установка;
- /privacy/ — политика конфиденциальности;
- /agreement/ — публичная оферта/пользовательское соглашение;
- /ai/ — краткое раскрытие ограничений AI;
- /processors/ — живой публичный реестр разрешённых AI-процессоров.

Checkout и success закрыты от индексации и не входят в sitemap.xml. Возврат
браузера с Robokassa не считается оплатой: интерфейс показывает только статус,
подтверждённый license Worker. Полные реквизиты карты сайт не получает.

## Юридические данные

Privacy, agreement и AI page должны совпадать с фактическими потоками из
соседнего compliance/data-flows.json. Перед публикацией проверять:

- четыре независимых consent choices: terms, AI processing, eligibility и
  optional telemetry off by default;
- entitlement вместо raw license key на AI gateway;
- локальный одноразовый токен сессии электронного журнала, который не уходит на backend;
- текущие processor register, страны, провайдеры и retention;
- отсутствие site analytics/request-content logging;
- точные данные оператора, тарифы, возвраты и способы доставки.

Не публиковать утверждение о российской локализации, если фактическая
инфраструктура его не подтверждает.

## Деплой

GitHub Pages публикует ветку main из корня. CNAME закрепляет smeshai.xyz, а
.nojekyll отдаёт файлы без Jekyll. URL страниц оформлены папками с index.html;
внутренние ссылки используют абсолютные пути со слэшем.

После изменения legal страниц обновить дату редакции, sitemap.xml и проверить
страницы локально на desktop/mobile, с JavaScript и без него.

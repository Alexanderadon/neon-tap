# NEON TAP в Google Play: Trusted Web Activity

Как упаковать PWA в Android-приложение и опубликовать его в Play Market. Основной путь —
**Trusted Web Activity (TWA)** через Bubblewrap: приложение-обёртка открывает
`https://neon-tap-virid.vercel.app` в Chrome без адресной строки, весь код остаётся на сайте,
обновления игры не требуют новой сборки APK. Альтернатива — Capacitor (раздел 7).

Что уже есть в репозитории и нужно для TWA:

| Что | Где | Зачем |
|---|---|---|
| Манифест | `public/manifest.webmanifest` | имя, цвета, `display: standalone`, `orientation: portrait`, иконки (PNG 192/512 + maskable 512) |
| Service worker | `public/sw.js` + `scripts/build-sw.ts` | офлайн-оболочка и кеш медиа — обязательное условие Lighthouse «installable» |
| Digital Asset Links | `public/.well-known/assetlinks.json` | доказательство, что сайт и приложение принадлежат одному автору; без него TWA показывает адресную строку |
| Политика конфиденциальности | `public/privacy.html` → `https://neon-tap-virid.vercel.app/privacy.html` | обязательное поле листинга в Play Console |
| Иконки | `public/icons/*.png`, `npm run assets:icons` | значок приложения (Bubblewrap берёт 512 и maskable из манифеста) |

## 1. Требования

- Node 18+, JDK 17, Android SDK (Bubblewrap скачает JDK и command-line tools сам, если разрешить).
- Аккаунт разработчика Google Play (единоразовый взнос 25 $), пройденная верификация личности.
- Сайт должен быть опубликован по HTTPS и проходить Lighthouse → PWA → «Installable»:
  `npm run build && bash scripts/deploy-fresh.sh <проект>` (см. `CLAUDE.md`), затем
  Chrome DevTools → Lighthouse на `https://neon-tap-virid.vercel.app`.

## 2. Сборка обёртки Bubblewrap

```bash
npm install -g @bubblewrap/cli
mkdir ../neon-tap-android && cd ../neon-tap-android
bubblewrap init --manifest https://neon-tap-virid.vercel.app/manifest.webmanifest
```

`init` читает манифест и задаёт вопросы. Рекомендуемые ответы:

| Вопрос | Значение |
|---|---|
| Domain | `neon-tap-virid.vercel.app` |
| Application name / short name | `NEON TAP — ритм-игра` / `NEON TAP` |
| Application ID | `app.vercel.neon_tap_virid.twa` (то же, что в `assetlinks.json`; менять нельзя после первой публикации) |
| Display mode | `standalone` |
| Orientation | `portrait` |
| Status bar / nav bar color | `#05060a` |
| Splash screen color | `#05060a` (совпадает с `background_color` манифеста и сплэшем в `index.html`) |
| Icon URL / maskable icon | из манифеста: `/icons/icon-512.png`, `/icons/icon-maskable-512.png` |
| Start URL | `/` |
| Include app shortcuts | нет |
| Signing key | создать новый (см. раздел 3) |

Сборка:

```bash
bubblewrap build
```

На выходе `app-release-signed.apk` (для теста на телефоне: `adb install app-release-signed.apk`)
и `app-release-bundle.aab` — его загружают в Play Console. Проверить, что TWA открывается
без адресной строки, можно только после публикации `assetlinks.json` (раздел 4).

Обновление обёртки нужно **только** при смене манифеста (имя, иконки, цвета, ориентация) или
версии: `bubblewrap update && bubblewrap build`; `versionCode` в `twa-manifest.json`
увеличивается на 1 при каждой загрузке в Play Console. Изменения самой игры подхватываются
через сайт и service worker.

## 3. Подпись

Bubblewrap при `init` создаёт keystore (`android.keystore`) — **хранить вне репозитория**
(он уже не попадает в git: репозиторий — только `E:\Projects\neon-tap`, папка обёртки — рядом).
Потеря ключа = невозможность обновить приложение с тем же Application ID.

Рекомендуемый вариант — **Play App Signing**: Google хранит ключ подписи приложения, а ваш
keystore становится «upload key». Тогда в `assetlinks.json` нужен отпечаток **ключа подписи
приложения из Play Console** (Play Console → приложение → Настройка → Целостность приложения →
«App signing key certificate» → SHA-256), а не локального keystore. Для локальной установки
APK через `adb` (до публикации) добавьте вторым отпечатком локальный upload key:

```bash
keytool -list -v -keystore android.keystore -alias android -storepass <пароль> | grep SHA256
```

## 4. Digital Asset Links

Файл `public/.well-known/assetlinks.json` в репозитории — плейсхолдер. Заменить строку
`REPLACE_WITH_UPLOAD_KEY_SHA256:…` на реальные отпечатки (можно несколько — upload key и
Play App Signing key), например:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "app.vercel.neon_tap_virid.twa",
      "sha256_cert_fingerprints": [
        "AB:CD:…:12",
        "34:56:…:EF"
      ]
    }
  }
]
```

После деплоя проверить:

- `https://neon-tap-virid.vercel.app/.well-known/assetlinks.json` отдаётся с `Content-Type: application/json`
  и статусом 200 (заголовок задан в `vercel.json`; Vite копирует `public/.well-known` в `dist`);
- Google-валидатор: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://neon-tap-virid.vercel.app&relation=delegate_permission/common.handle_all_urls`
  должен вернуть statement с вашим package_name;
- `bubblewrap validate --url https://neon-tap-virid.vercel.app` — проверка PWA-критериев.

Если отпечаток не совпадает, TWA открывается **с адресной строкой** — это главный симптом
ошибки в `assetlinks.json`.

## 5. Листинг в Play Console

Создать приложение: Play Console → «Создать приложение» → название `NEON TAP`, язык по
умолчанию — русский, «Игра», бесплатно. Далее по чек-листу «Настройка приложения»:

| Пункт | Что указать |
|---|---|
| Политика конфиденциальности | `https://neon-tap-virid.vercel.app/privacy.html` |
| Доступ к приложению | «Все функции доступны без специального доступа» (нет логина) |
| Реклама | «Нет рекламы» |
| Возрастной рейтинг | анкета IARC: категория «Игра», без насилия, без покупок, без общения между пользователями (онлайн-таблица — только ники, без чата) → обычно **3+ / PEGI 3 / Everyone** |
| Целевая аудитория | 13+ (проще всего: не попадает под правила Families) |
| Безопасность данных | «Приложение не собирает и не передаёт данные пользователя». Если включена онлайн-таблица: «Собирает: другие идентификаторы — ник (необязательно, вводится пользователем), передача через шифрование, можно запросить удаление». IP для rate-limit не хранится |
| Категория | Игры → Музыка |
| Контакты | e-mail разработчика (виден в листинге) |
| Государственные приложения / новости / COVID | нет |

Графика листинга (готовится отдельно, в репозитории нет):

- значок 512×512 PNG — `public/icons/icon-512.png` подходит (без прозрачности лучше `icon-maskable-512.png`);
- баннер 1024×500;
- минимум 2 скриншота телефона (портрет, 9:16, ≥ 320 px по короткой стороне; лучше 1080×1920):
  меню, игра с холдами и слайдами, экран результата;
- при желании — короткое видео на YouTube.

Описание: короткое (≤ 80 символов) — «Ритм-игра: карта нот из любого MP3, 31 CC0-трек, офлайн»;
полное — из README (что делает автогенерация, механики, что файл не покидает устройство).

## 6. Публикация и обновления

1. Play Console → «Тестирование» → «Внутреннее тестирование» → загрузить `app-release-bundle.aab`,
   добавить тестировщиков по e-mail, проверить установку с реального телефона (адресной строки
   быть не должно, сплэш тёмный, звук после первого тапа, офлайн-запуск после первого захода).
2. Заполнить листинг (раздел 5), отправить на проверку («Production» → «Создать выпуск»).
   Первая проверка новых аккаунтов — до 7 дней; с 2023 г. для личных аккаунтов обязателен
   закрытый тест с ≥ 12 тестировщиками в течение 14 дней перед production.
3. Обновление игры: деплой сайта — и всё. Пользователь при следующем запуске увидит тост
   «Доступно обновление — обновить». Новый AAB нужен только при смене манифеста/иконок/ID.

Отладка на устройстве: `chrome://inspect` на десктопе видит вкладку TWA как обычную страницу
Chrome; логи service worker — там же (Application → Service Workers).

## 7. Альтернатива: Capacitor

Если нужны нативные возможности (вибрация в такт, покупки, push, Game Center/Play Games) или
iOS App Store — Capacitor заворачивает ту же сборку `dist/` в WebView:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android   # НЕ в этом репозитории — см. ниже
npx cap init "NEON TAP" app.vercel.neon_tap_virid --web-dir dist
npx cap add android
npm run build && npx cap sync android
npx cap open android   # Android Studio → Build → Generate Signed Bundle
```

Отличия от TWA:

- код игры лежит **внутри** APK — каждое обновление игры = новая версия в Play (и проверка);
  service worker при этом не нужен, всё уже локально; `start_url` заменяет `capacitor.config.ts`
  (`server.androidScheme: 'https'` — иначе `localStorage` и Web Audio ведут себя иначе);
- WebView на старых Android (< 10) отстаёт от Chrome по Web Audio (латентность выше,
  `AudioContext.outputLatency` отсутствует) — калибровка задержки остаётся обязательной;
- аудио-разблокировка та же: первый тап (`widgets/audio-gate`);
- нужен `@capacitor/app` для события `appStateChange` → пауза (в TWA хватает `visibilitychange`).

Правило проекта «рантайм-зависимости — только `react` и `react-dom`» относится к игре: обёртку
Capacitor держать в отдельном репозитории/папке (`../neon-tap-capacitor`), где `dist/` этого
проекта копируется или подключается как `webDir`.

## 8. Чек-лист перед отправкой

- [ ] Lighthouse PWA: installable, `sw.js` зарегистрирован, манифест без ошибок
- [ ] `assetlinks.json` с реальными SHA-256, валидатор Google видит statement
- [ ] TWA на телефоне открывается без адресной строки, сплэш `#05060a`
- [ ] Офлайн: включить авиарежим после первого запуска — меню и сыгранные треки работают
- [ ] `privacy.html` открывается, ссылка указана в Play Console
- [ ] Анкета рейтинга, «Безопасность данных», «Реклама», «Доступ к приложению» заполнены
- [ ] Иконка 512, баннер 1024×500, ≥ 2 скриншота
- [ ] keystore и пароли сохранены вне репозитория (менеджер паролей)

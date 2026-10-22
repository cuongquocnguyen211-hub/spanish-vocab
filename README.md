# Spanish Vocabulary · Từ vựng Tây Ban Nha — v1.0.2

A personal, offline-first Spanish vocabulary app for iPhone and computer.
Spanish is the target language; Vietnamese and English are support languages.

**Your data stays on your device.** No login, no cloud database, no server-side code, no analytics, no ads.
*Dữ liệu chỉ nằm trên thiết bị của bạn — không tài khoản, không đám mây, không quảng cáo.*

---

## 1. What is in this version

| Area | What works now |
|---|---|
| **Library** | Add, edit, search (accent-insensitive: `manana` finds `mañana`; Vietnamese without tones works too), filter by part of speech / topic / status, sections (All, Recent, To review, Favorites, Learned, Phrases, Topics, Trash). Delete goes to Trash first; restore or delete forever. |
| **Word entry** | Spanish, Vietnamese, English, part of speech, article (el/la), gender, plural, verb forms, adjective forms, IPA, example in 3 languages, collocations, topic, source, page, notes, and **where the information came from** (my book / dictionary-checked / my own / AI suggestion / uncertain). Accent keys: á é í ó ú ü ñ ¿ ¡. Duplicate warning while typing. Unsaved drafts are kept automatically. |
| **Import** | Paste a list (from a photo via iPhone Live Text, from a PDF, or typed). Step 1 get text → Step 2 proposed entries → Step 3 you review, edit, approve. Duplicates are unchecked by default; app-made guesses (e.g. article → gender) are highlighted yellow. Original line, source name and page are kept. |
| **Review (spaced repetition)** | Flashcards in 4 directions (ES→VI, ES→EN, VI→ES, EN→ES, or mixed). Four answers: Incorrect · Difficult · Correct with effort · Easy. Next review date is saved. A word is “Learned” only after 3+ successful reviews in a row and a 3-week interval — never after one answer. |
| **Practice games** | Multiple choice, matching, fill in the blank (uses your example sentences). Results go to history; they do not change the review schedule. |
| **Dashboard** | Total, new, due, recalled, in progress, learned, 14-day activity, accuracy, difficult words — all calculated from your saved data. |
| **Backup** | Full JSON backup (words + schedule + history), restore with **Merge** (safe, default) or **Replace** (asks twice), CSV export for Excel/Sheets, backup reminder after 7 days. |
| **Offline / PWA** | Works offline after the first visit; can be added to the iPhone Home Screen. |

**Not in this version (planned later):** automatic OCR inside the app, automatic translations / AI suggestions, generated dialogues. These need either a large offline OCR library or an external service, and an external service would need your explicit consent each time. For now the app never sends anything anywhere.

## 2. Files and how they fit together

```
index.html             App shell: header, screen area, bottom tab bar
manifest.webmanifest   Name, icons, colours — lets iPhone install it on the Home Screen
sw.js                  Service worker: keeps a copy of the APP FILES for offline use (never your data)
css/styles.css         All styling (mobile-first, light & dark mode)
icons/                 App icons (180, 192, 512, maskable 512)
js/app.js              Start-up, navigation, Home dashboard, Library, word page, add/edit form
js/db.js               IndexedDB storage (vocab, cards, logs, imports, meta) + backup/restore
js/state.js            In-memory copy of the data; every change is written to IndexedDB first
js/srs.js              Spaced-repetition schedule and learning status rules
js/practice.js         Flashcard review, multiple choice, matching, fill in the blank
js/importer.js         Import: paste → proposed entries → review & approve
js/more.js             Backup, restore, CSV, storage status, settings, starter words, delete all
js/labels.js           Three-language labels (parts of speech, topics, status)
js/nav.js, js/util.js  Small shared helpers (duplicates, accent keys, dialogs, files, speech)
tests/e2e.mjs          Automated test (43 checks) used during development
```

Data model: each word has a stable ID. Its review schedule (`cards`) and review history (`logs`) are stored separately, so editing a word never resets its learning history.

## 3. Put the app online (one time, free) · Đưa ứng dụng lên mạng

The iPhone needs to open the app from an **HTTPS web address** once, so that it can be added to the Home Screen and cached for offline use. The host only serves these static files — **your vocabulary is never sent to it**.

### Recommended: GitHub Pages
1. Create a free account at github.com (if you don't have one).
2. Create a new repository, e.g. `spanish-vocab` (Public is fine — it only contains the app code, not your words).
3. Click **Add file → Upload files**, drag in **everything inside** the `spanish-vocab` folder (keep the `css`, `js`, `icons` folders), then **Commit changes**.
4. Go to **Settings → Pages**. Under “Build and deployment”, choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
5. After 1–2 minutes your app is at `https://YOUR-USERNAME.github.io/spanish-vocab/`.

Other static hosts (Cloudflare Pages, Netlify) also work. Any host is fine as long as it uses HTTPS and serves the files unchanged.

### Try it on your computer first (optional)
In a terminal, inside the `spanish-vocab` folder:
```
python3 -m http.server 8000
```
Then open `http://localhost:8000` in Chrome, Edge or Safari. (Opening `index.html` by double-clicking will **not** work — browsers block app features on `file://` pages.)

## 4. Install on iPhone · Cài lên iPhone
1. Open your app address in **Safari**.
2. Tap the **Share** button (square with an arrow ↑). On newer iOS versions you may first need to tap **•••**, then **Share**.
3. Scroll down and tap **Add to Home Screen**. If you see an **Open as Web App** switch, leave it on. Tap **Add**.
4. From now on, **always open the app from the Home Screen icon.** It opens full-screen like an app and works offline.
5. Open the app once while online and wait a few seconds so that the offline copy finishes downloading.

*Mở bằng Safari → Chia sẻ → Thêm vào Màn hình chính → Thêm. Sau đó luôn mở từ biểu tượng trên màn hình chính.*

To be clear: this is a web app added to the Home Screen, not an App Store app. It behaves like an app (own icon, full-screen, offline), but iOS manages its storage as website data.

## 5. Important iPhone storage facts · Lưu ý quan trọng về dữ liệu
- **The Home Screen app and Safari have separate storage.** Words added in a Safari tab will not appear in the Home Screen app. Add the app to the Home Screen first, then enter your words there. (If you already added words in Safari: Backup in Safari → Restore in the Home Screen app.)
- **Data can be lost if:** you delete the Home Screen icon, clear Safari website data (Settings → Apps → Safari → Clear History and Website Data, or Advanced → Website Data), reset or replace the phone, or iOS removes website data when the phone is very low on storage. Safari can also remove data of websites that are not used for several days; regular use from the Home Screen icon is the safest way.
- **No automatic sync** between iPhone and computer. To move data: More → Download full backup → on the other device, More → Restore → Merge.
- **Make a weekly backup.** More → *Download full backup*. On iPhone choose **Save to Files** (iCloud Drive or On My iPhone). The app reminds you if 7 days pass without a backup.
- Pronunciation (🔊) uses your iPhone's own Spanish voice. If it is missing: Settings → Accessibility → Spoken Content → Voices → Spanish.

## 6. Importing words from a photo or PDF (this version)
1. Add → *Import a list* (or More → Import).
2. Tap **📷 Photo** and choose the textbook photo. Press and hold on the words in the photo, select, then **Copy** (iPhone Live Text runs on your phone).
3. Paste into the text box. One word per line, e.g. `la casa - nhà - house`. Choose the column order, topic, source name and page.
4. Tap **Show proposed entries**, correct anything, uncheck what you don't want, then **Save approved**.

For PDFs: open the PDF, copy the text, paste. For scanned PDFs, take a screenshot and use Live Text.

## 7. Updating the app later (without losing data)
1. Change the files, then increase `VERSION` in `sw.js` (for example `v1.0.2` → `v1.0.3`) and `APP_VERSION` in `js/state.js`.
2. Upload the changed files to the same GitHub repository.
3. Open the app; a message “A new version of the app is ready — Update” appears. Tap **Update**.

Updates replace only the app files. Your words live in IndexedDB and are not touched. Database changes in future versions may only **add** storage, never remove your data. Make a backup before any big update anyway.

## 8. Privacy
- No network requests except loading the app's own files from your host.
- No analytics, tracking, ads, cookies, accounts, cloud sync, or API keys.
- Photos and PDFs you choose are only shown on your device; they are not uploaded or stored.

## 9. Testing
`tests/e2e.mjs` runs 43 automated checks in a phone-sized Chromium browser with Playwright. It covers saving, reopening the browser, search, filters, editing, review scheduling, the three games, import with duplicates, trash/restore, dashboard numbers, JSON backup, CSV, delete-all, restore, merge, rejecting a bad backup file, and offline loading.
These checks ran in Chromium, not in iPhone Safari. Please also check the app once on your iPhone using the steps in section 10.

## 10. First check on your iPhone (2 minutes)
1. Install it (section 4) and open it from the Home Screen icon.
2. Add one word, e.g. `mañana`.
3. Close the app completely (swipe it away), reopen it → the word must still be there.
4. Turn on Airplane Mode, open the app → it must still open and show the word.
5. More → Download full backup → Save to Files. You now have a safety copy.

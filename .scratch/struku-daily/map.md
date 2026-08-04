<!-- wayfinder:map -->
# Struku — Layak Dipakai Harian

## Destination

Struku enak dipakai **satu user beneran (pemilik repo) setiap hari** tanpa jengkel:
ledger-nya kebaca (bisa dilihat, diringkas, dicari), salah catat bisa dibenerin
setelah ke-commit, dan bot terasa seperti lawan bicara — bukan mesin kasir yang
cuma nerima format tertentu.

Reaching the end = semua keputusan yang menghalangi itu sudah jadi ADR, dan slice
berikutnya siap diserahkan ke `/to-spec`. **Planning only** — map ini tidak
membangun; ia memutuskan.

Tolok ukurnya bukan daftar fitur, tapi satu pertanyaan yang bisa diuji:
*pemilik repo memakai Struku tujuh hari berturut-turut dan tidak menemukan hal
yang bikin dia berhenti.*

## Notes

- **Domain:** chat-first personal-finance bot di Cloudflare Workers (Hono + D1 +
  Durable Objects via Agents SDK + Workers AI). Sumber kebenaran *apa*:
  [`docs/global-prd.md`](../../docs/global-prd.md),
  [`docs/global-srs.md`](../../docs/global-srs.md).
- **Ini map kedua.** Map pertama —
  [Struku v1 — Foundations Map](../struku-v1/map.md) — destination-nya **tercapai**:
  8 decision ticket resolved (ADR-0001..0006), tracer #1 (tiket 09–13) dibangun,
  dideploy, dan live di `@StrukuBot`. Map ini melanjutkan dari sana, bukan
  menggantikannya. Fog di map lama yang masuk destination ini digraduasikan ke
  sini; sisanya tetap di sana.
- **Stack sudah fixed** (SRS §2.4) — bukan keputusan. Fog-nya *bagaimana*, bukan
  *apakah*.
- **ADR 0001–0006 sudah committed dan closed.** Menambah kemampuan yang mengubah
  kontrak parsing (ADR-0005) adalah **revisi ADR**, bukan tweak prompt diam-diam.
  ⚠️ **ADR-0005 §1 dan §2 sekarang punya revisi tertunda** dari
  [15](issues/15-conversational-surface.md) (2026-08-02): satu-panggilan-flat →
  dua panggilan, dan satu-model-terkunci → model berbeda per panggilan. **ADR-nya
  belum ditulis** — keputusannya ada di tiket 15.
  ⚠️ **Rencana "tunggu 25 supaya §2 menyebut model yang benar" tidak jalan seperti
  dugaan.** [25](issues/25-small-model-for-reply-composition.md) **resolved** tapi
  **tidak memilih model** — ia mempersempit ke 2 kandidat + 1 kontrol dan menyerahkan
  pilihan finalnya ke probe, karena latency dan kualitas generasi Bahasa Indonesia
  **tidak dijawab dokumentasi untuk model mana pun**. Jadi §2 sekarang menunggu
  **`npm run test:live`** (butuh pemilik repo), bukan menunggu tiket. Dua hal dari 25
  yang **harus** masuk revisi ADR terlepas dari model mana yang menang: worst case
  retry **9,6s** lawan anggaran 10s, dan `json_schema` sebagai **syarat seleksi
  kandidat** — bukan properti yang diasumsikan — sehingga kontrak defensif §7 berlaku
  untuk **kedua** panggilan.
  ⚠️ **Hal ketiga yang masuk revisi ADR, dari [28](issues/28-transaction-gate-arity.md)
  (2026-08-04):** ADR-0005 §6 menulis *clarify, never invent*, tapi ada jalur yang
  **tidak mengklarifikasi dan tidak mencatat** — kasus yang ADR-nya tidak pernah
  bayangkan. Revisi §1 mengganti gerbang deterministik dengan panggilan-1, jadi ia
  **wajib menyatakan** apa yang terjadi saat maksudnya transaksi tapi satu field
  esensial gagal ditebak. Kalau tidak, celahnya ikut pindah ke arsitektur baru.
- **Skills tiap sesi:** `/grilling` + `/domain-modeling` (default), `/prototype`
  (spike), `/research` (fakta eksternal). Catat keputusan sebagai ADR di
  `docs/adr/`, tambah istilah ke [`CONTEXT.md`](../../CONTEXT.md).
- **Telusuri tiap keputusan balik ke SRS FR-ID** di ADR-nya.
- **Guardrail Workers (dari sesi deploy, jangan dilanggar):** miniflare ≠ workerd.
  Dua bug produksi lolos dari suite lokal yang hijau. Kalau menyentuh seam
  `env.AI` atau `fetch`, `npm run test:live` + deploy nyata + `wrangler tail`
  itu **wajib**, bukan opsional.
- ⚠️ **Kanal dokumentasi bisa tertutup, tergantung environment.** Di sesi remote
  2026-08-03, `developers.cloudflare.com` **dan** `docs.mcp.cloudflare.com`
  ditolak egress policy (403 dari proxy; dikonfirmasi lewat
  `$HTTPS_PROXY/__agentproxy/status`) — persis kedua kanal yang AGENTS.md tunjuk
  untuk memenuhi aturan STOP-nya. `/root/.ccr/README.md` melarang mengakalinya.
  Yang tersisa: `WebSearch` ber-`allowed_domains`, yang membaca halaman resminya
  tapi mengembalikan **ringkasan, bukan tabel verbatim**. Efeknya asimetris —
  klaim "angkanya cocok" tetap kuat, klaim "angka ini tidak ada di dokumentasi"
  jadi lebih lemah. **Cek kanal ini di awal tiap sesi riset** dan tandai kelas
  buktinya; jangan diam-diam menurunkan mutu bukti.
  Kredensial Cloudflare juga tidak ada di environment remote (`wrangler whoami`
  = not authenticated), jadi **`test:live` dan `wrangler d1 --remote` hanya bisa
  dijalankan pemilik repo di mesinnya.**
- **Mode:** planning-by-default (tidak ada override eksekusi).
- **🧊 DEPLOYMENT FREEZE (diputuskan 2026-08-01, berlaku sampai map ini selesai).**
  Tidak ada `wrangler deploy` sampai **map selesai dan tidak ada kesalahan**.
  Pembangunan, commit, dan `npm test` jalan seperti biasa; hanya rilis ke
  produksi yang ditahan, lalu dilakukan **sekali di akhir**.
  - **Yang tidak ikut beku:** `npm run test:live`. Ia memanggil model sungguhan
    tapi **tidak me-rilis apa pun**, jadi kontrak parser tetap bisa diuji lawan
    `env.AI` asli. Tetap dipakai.
  - ⚠️ **Risiko yang diterima sadar:** guardrail `env.AI` (`test:live` + deploy
    nyata + `wrangler tail`) jadi **tertunda, bukan hilang**. Setelah
    [15](issues/15-conversational-surface.md) (2026-08-02) risiko ini **naik
    tajam**: arsitektur barunya memanggil `env.AI` **dua kali per pesan** dan
    melepas gerbang deterministik, jadi yang dibangun tanpa bukti workerd bukan
    lagi satu-dua fitur melainkan **seluruh jalur masuk pesan**. Yang **bisa**
    dibuktikan sekarang lewat `test:live` (tidak ikut beku): bentuk output
    `reply` + `summary` tetap flat dan tidak spiral, plus kandidat model kecil
    [25](issues/25-small-model-for-reply-composition.md). Yang **tidak bisa**:
    latency dua panggilan berurutan di workerd asli lawan anggaran NFR-PERF-01
    5–10s. Kalau tembus, ketahuannya menumpuk di ujung. Miniflare ≠ workerd tetap
    berlaku — dua bug produksi sudah pernah lolos lewat celah ini.
  - **Utang verifikasi yang menunggu deploy terakhir** (jangan dianggap lunas):
    [22](issues/22-persist-entry-description.md) (`description` verbatim + shim
    `ALTER TABLE` di Coordinator lama) dan
    [23B](issues/23-draft-confirmation-surface.md) (balasan tiga baris +
    `Pengeluaran hari ini`). Keduanya sudah dibangun & hijau lokal, **belum
    pernah terbukti di produksi**.
  - 🚨 **Kondisi produksi berubah 2026-08-03 dan freeze perlu ditimbang ulang.**
    `test:live` menemukan jalur pencatatan transaksi **gagal 7/7** dengan
    `AiError: 5024: JSON Model couldn't be met` — dua run terpisah, bukan transien
    → [29](issues/29-parse-schema-5024.md). `ai.run` **melempar**, dan tidak ada
    satu pun `try`/`catch` di `coordinator.ts`, jadi errornya menembus seluruh
    jalur pesan. Kalau produksi memang rusak, menahan perbaikan sampai map selesai
    berarti bot **tidak bisa dipakai sama sekali** sampai saat itu — padahal
    destination map ini justru *"dipakai harian"*. **Keputusan pemilik repo, bukan
    agent** — tercatat di butir 3 tiket 29, jangan diputuskan sepihak.
  - **Kondisi produksi selama freeze:** versi terpasang `7436f2b5`, dan bot
    **masih menjebak di mode edit** ([24](issues/24-edit-mode-escape.md)).
    Tambalan cepat ditawarkan dan **ditolak** — konsisten dengan freeze.
    Konsekuensinya: pemakaian harian nyata praktis terhenti, jadi fog yang
    menunggu "bukti pemakaian" (beban konfirmasi, akurasi kategori, kategori
    kustom, budget) **tidak akan bergerak** sampai freeze dicabut.

## Decisions so far

<!-- index only — one line per resolved ticket, gist + link; detail lives in the ticket -->

- [14 · Kapabilitas query agregat D1](issues/14-d1-aggregate-query-capability.md)
  (research) — **D1 tidak memaksa keputusan apa pun**: `SUM`/`GROUP BY`/CTE/window
  function/`strftime` semua jalan (`ROLLUP` dan `sqlite_version()` tidak), dan tak
  ada limit yang mengikat laporan satu user. Perbandingan rentang `TEXT`
  **memakai index**; `strftime` di `GROUP BY` tetap mempertahankannya selama
  `WHERE` menyaring kolom mentah. `batch()` satu-satunya primitif transaksi
  (`BEGIN`/`COMMIT` ditolak). **Tiga jebakan untuk [16](issues/16-reporting-query-surface.md):**
  (a) `PRAGMA optimize` tidak ada di migrasi mana pun — tanpanya planner
  *mengabaikan* `idx_journal_entries_user_date` dan rentang tanggal tidak
  menyaring sama sekali; (b) filter naif `direction='debit'` mencemari breakdown
  dengan `cash` — harus lewat `accounts.type`; (c) `status` harus disaring atau
  reversal terhitung ganda (mengikat ke [17](issues/17-post-commit-correction.md)).
  ✅ **Verifikasi `--remote` selesai (2026-08-01)** — caveat "baru lokal" dibayar.
  Produksi terkonfirmasi **tidak punya `sqlite_stat1` sama sekali**, dan plan
  remote-nya persis rencana yang salah itu. Diukur ulang pada volume realistis
  (2000 entry): **58.116 → 7.278 VM step, 8×**, melebar seiring ledger tumbuh.
  **Koreksi penting:** menaruh `ANALYZE` di migrasi **tidak bekerja** (diuji —
  migrasi jalan di DB kosong, statistiknya tidak tertulis, planner balik salah
  begitu data masuk); migrasi `0003` ditulis lalu dibuang. Statistik harus
  di-refresh setelah ada data dan berulang → digraduasikan jadi
  [20 · Kapan `PRAGMA optimize` dijalankan](issues/20-stats-refresh-trigger.md),
  yang sekarang **memblokir 16**.
  → [temuan lengkap](research/14-d1-aggregate-query-capability.md) +
  [verifikasi remote](issues/14-d1-aggregate-query-capability.md#verifikasi---remote-2026-08-01--caveat-1-dibayar).
  Branch `research/14-d1-aggregate` **sudah ter-merge** (`d955e91`).

- [17 · Koreksi transaksi setelah commit](issues/17-post-commit-correction.md)
  (grilling) — **ditunda, bukan ditolak; pertahanannya dipindah ke hulu.** Pemilik
  repo: koreksi pasca-commit baru masuk akal setelah reporting ada — tak bisa
  menunjuk transaksi yang salah tanpa cara melihatnya dulu. Jadi arah dependensi
  yang ditulis ragu-ragu di badan tiket ("16 *mungkin* prasyarat") **dikeraskan
  jadi pasti**: tiket koreksi nanti *blocked by*
  [16](issues/16-reporting-query-surface.md). Sebagai gantinya, transaksi salah
  ditahan **sebelum** masuk ledger → digraduasikan jadi
  [22 · Simpan teks asli ke `description`](issues/22-persist-entry-description.md)
  (tidak ke-block, **prioritas waktu** — teks asli hilang permanen tiap hari ini
  ditunda) dan
  [23 · Konfirmasi draft](issues/23-draft-confirmation-surface.md) (blocked by 22).
  **Dua temuan kode yang mengubah diskusi:** balasan pasca-commit hanya *"Sip,
  sudah dicatat!"* — user tak punya cara tahu kategorinya meleset; dan
  `description` **tak pernah ditulis** meski ada di skema sejak migrasi pertama,
  sehingga kata "kopi" di *"yang kopi tadi salah"* tidak ada di kolom mana pun.
  Empat jawaban soal mekanika koreksi (jendela lebar, reversal 3 entry, jejak
  terlihat, konfirmasi mungkin tak perlu) tercatat di tiket sebagai **arah yang
  dicondongi — sengaja bukan keputusan**, karena dijawab sebelum bentuk masalahnya
  terlihat. Jebakan (c) riset 14 belum jadi ancaman nyata (nol jalur tulis
  `reversed`/`reversal` di `src/`), tapi
  [16](issues/16-reporting-query-surface.md) tetap sebaiknya menyaring `status`
  sejak awal.

- [22 · Simpan teks asli transaksi ke `description`](issues/22-persist-entry-description.md)
  (grilling) — **`description` = label tampilan yang default-nya teks mentah user,
  bukan arsip.** Istilah itu dipilih sengaja: "teks mentah" di sini **bukan** janji
  immutability. Yang disimpan adalah teks user apa adanya (*"warteg 25rb"*) —
  pemilik repo membayangkan laporan [16](issues/16-reporting-query-surface.md)
  berisi baris verbatim dan menyebutnya *"enak, as intended"*. Boleh diedit di
  **dua** tempat: saat konfirmasi draft (→
  [23](issues/23-draft-confirmation-surface.md), murah — draft masih di tangan)
  dan saat membaca laporan (→ butuh
  [17](issues/17-post-commit-correction.md) + [16](issues/16-reporting-query-surface.md),
  **bukan blocker 22**, tapi jadi alasan tambahan membuka 17 lagi nanti). Saat
  diedit teks asli **ditimpa** — tanpa kolom kedua, tanpa migrasi: ini ledger
  pribadi, satu penulis satu pembaca, bukan sistem audit. Input pendek nol-informasi
  (*"25rb"*) **tidak dicegah di depan**; perbaikannya lewat jalur edit.
  `description` NULL untuk entry lama diterima (backfill mustahil). **Tidak ada ADR
  baru** — ADR-0002 sudah memesan kolomnya, dan ADR-0005 **tak tersentuh** justru
  karena teks mentah yang dipilih. **Tiga temuan kode yang mengoreksi tiket** (tiket
  ditulis sebelum kodenya dibaca): (a) opsi "normalisasi parser" di butir 1 **tidak
  ada barangnya** — `ParseResult` tak punya field deskripsi/merchant sama sekali,
  jadi baris *"Keterangan: Warteg"* pada flow 23 tidak diproduksi apa pun, dan
  mendapatkannya = revisi ADR-0005 + prompt + schema; (b) teks mentah **sudah di
  tangan** saat `startDraft()` lalu dibuang (dipakai hanya untuk
  `detectAssetAccountSlug`), `PendingDraft` tidak membawanya — jadi implementasinya
  **bukan sekadar menambah kolom ke `INSERT`**, `PendingDraft` harus membawa teks
  itu sampai commit; (c) kedua opsi butir 1 **tidak setara ongkosnya**, tiket
  menyajikannya seolah setara. Jalur ini tidak menyentuh `env.AI`, tapi ini jalur
  tulis harian yang hidup → deploy nyata tetap sepadan. Siap `/implement`.

- [23 · Konfirmasi draft: edit natural + balasan commit berrincian](issues/23-draft-confirmation-surface.md)
  (grilling) — digrilling **dua tahap terpisah** karena ongkos A dan B jauh
  berbeda. **B sudah dibangun** (`099ca39`); **A baru diputuskan, belum dibangun.**
  **B — balasan commit:** rinciannya **echo**, bukan info baru; yang benar-benar
  baru hanya angka harian. ⚠️ **B tidak menutup lubang deteksi kategori** yang
  melahirkan tiket ini — temuan kode: kategori **sudah** tampil sebelum commit
  ([`reply.ts:48`](../../src/worker/parsing/reply.ts)), jadi masalahnya **menekan
  Konfirmasi tanpa membaca**, dan meng-echo teks yang sama tidak memperbaikinya.
  Agregat "Pengeluaran hari ini": `entry_date` (bukan `created_at`), **hanya
  pengeluaran bukan net**, **satu mata uang tanpa FX** (opsi A polos, tanpa label
  — pengeluaran mata uang lain di hari sama diam-diam tak terhitung, diterima
  sadar) → ADR-0002 utuh dan **23 tidak perlu di-block ke
  [16](issues/16-reporting-query-surface.md)**. Jebakan riset
  [14](issues/14-d1-aggregate-query-capability.md) (b) dan (c) ditangani di
  [`ledger/daily-total.ts`](../../src/worker/ledger/daily-total.ts) — (c)
  diverifikasi: tanpa `status='posted'`, entry `reversed` menggelembungkan total
  25.000 → 124.000. **Jebakan (a) tidak ditangani** — agregat ini berjalan di atas
  planner yang salah sampai [20](issues/20-stats-refresh-trigger.md) mendarat.
  **A — edit bahasa natural (belum dibangun):** tetap di jalur draft, **bukan
  intent baru** — `ParseResult` **sudah memuat keempat field yang bisa diedit**,
  jadi kalimat edit dilempar ke `TextParser` yang ada dan field non-null diambil
  sebagai delta → **ADR-0005 tidak tersentuh**. Semantiknya **menambal** (null =
  jangan sentuh), bukan menulis ulang — opsi tulis-ulang sempat dipilih lalu
  dibatalkan setelah terlihat bahwa kalimat contoh pemilik repo sendiri di
  [17](issues/17-post-commit-correction.md) tidak jalan di mode itu.
  **`currency` tidak pernah ikut diedit** (non-null, default `'IDR'` → tanpa ini
  tiap edit menimpa draft USD jadi IDR, `$ 15` → `Rp 15`); ganti mata uang =
  batalkan dan ketik ulang. **Dua mode gagal, dua mekanisme:** gagal terang
  (semua null) → **fallback ke menu lama, yang dipertahankan** karena sudah hijau
  di test, nol panggilan AI, dan satu-satunya jalur yang hidup saat `env.AI` mati;
  gagal diam (terbaca tapi salah, *"jangan makan, tapi transport"* → `food`) →
  **tampilan diff** (`Kategori: Makan → Transportasi`) hanya di jalur natural.
  Guardrail: **A menyentuh `env.AI`**, jadi `test:live` + deploy nyata +
  `wrangler tail` **wajib** — beda dari B yang tidak menyentuhnya.

- [25 · Model kecil mana untuk panggilan-2 (menyusun jawaban)](issues/25-small-model-for-reply-composition.md)
  (research) — **tidak bisa memilih pemenang dari dokumentasi, dan itu temuannya.**
  81 model dipersempit jadi **2 kandidat + 1 kontrol + 1 jawaban sah "tidak ada"**,
  pilihan finalnya diserahkan ke probe: utama `@cf/zai-org/glm-4.7-flash`
  (dialog-tuned, 100+ bahasa, biaya sekelas 8B), cadangan kualitas
  `@cf/aisingapore/gemma-sea-lion-v4-27b-it` (**satu-satunya model yang dokumentasi
  Cloudflare-nya menyebut Indonesian dengan nama**), kontrol
  `@cf/meta/llama-3.1-8b-instruct-fast`. ⚠️ **Premis [15](issues/15-conversational-surface.md)
  butir 2 tidak punya dasar:** Cloudflare **tidak mendokumentasikan latency untuk
  model mana pun**, jadi "model kecil lebih cepat" — satu-satunya alasan memilih
  model kecil — tak terbukti, dan di platform serverless bisa **salah** (antrian GPU
  per model; model kecil yang jarang dipakai bisa lebih lambat). Kalau probe
  menunjukkan begitu, jawaban jujurnya **70B untuk kedua panggilan**, dan riset ini
  **memperkuat** kemungkinan itu. ⚠️ **Worst case 9,6s yang 15 butir 2 tidak
  hitung:** ADR-0005 §7 mengizinkan satu retry per panggilan → 4 × 2,4s dari
  anggaran 10s NFR-PERF-01, **tanpa margin**, sebelum D1 + Telegram → revisi ADR
  harus menerimanya sadar **atau** membedakan kebijakan retry panggilan-2.
  **Pertanyaan `json_schema` tidak terjawab dokumentasi** — daftar model JSON Mode
  bahkan tidak memuat 70B yang repo ini pakai dan terbukti bekerja, jadi daftar itu
  tak boleh jadi otoritas negatif; **15 butir 5 tidak batal**, tapi `json_schema`
  jadi **syarat seleksi kandidat**, bukan properti yang boleh diasumsikan, dan
  kontrak defensif ADR-0005 §7 **wajib juga untuk panggilan-2**. **JSON Mode tidak
  streaming** → menutup jalan keluar "kirim dua tahap". **Peringatan yang paling
  mudah terlewat:** ADR-0005 me-retire risiko Bahasa Indonesia untuk **ekstraksi**,
  bukan **generasi** — buktinya tidak bisa dipinjam ke panggilan-2 bahkan untuk model
  yang sama. Temuan di luar tiket: **prompt caching** (`x-session-affinity`) adalah
  ungkitan gratis, tapi **reset harian 15 butir 6 mengundang tanggal masuk system
  prompt dan itu merusak cache seluruhnya**; biaya tidak akan pernah mengikat (≈450
  pesan/hari gratis), jadi memilih SEA-LION yang 7,8× lebih mahal murah dibayar; dan
  **18 model dideprekasi 30 Mei 2026** dengan daftar yang gagal diekstrak — wajib
  diverifikasi sebelum mengunci kandidat. Probe **sudah terisi** di
  [`test/live/reply-composer-probe.test.ts`](../../test/live/reply-composer-probe.test.ts),
  typecheck bersih, 77/77 tetap hijau. Kanal terdegradasi seperti
  [21](issues/21-vendored-skill-doc-reliability.md).
  ✅ **PROBE SUDAH DIJALANKAN pemilik repo (2026-08-03)** — tiket ini sekarang
  `[DOC]` **+** `[PROBE]`, dan hasilnya **membalik sebagian peringkat [DOC]**:
  kontrak dua field flat `{ reply, summary }` **terbukti utuh tanpa spiral** (satu
  hal dari keputusan 15 yang bisa dibuktikan selama freeze — **lolos**); premis
  "lebih kecil = lebih cepat" **terbukti telak** (8B **725ms** vs 70B **10.370ms**,
  14×), jadi 15 butir 2 selamat; tapi **dua kandidat teratas riset dokumentasi
  (GLM dan SEA-LION) dua-duanya mengembalikan kosong**, dan yang menang justru
  kandidat **kontrol** yang dimasukkan karena *tidak* diharapkan menang. ⚠️ Jangan
  dulu mencoret keduanya — probe run-1 punya titik buta (`normalize()` meruntuhkan
  payload jadi `""`, tak bisa membedakan "model abaikan skema" dari "bentuk tak
  dikenal"); probe **sudah diperbaiki**, **jalankan ulang**. ⚠️ **Baseline
  ADR-0005 §2 kedaluwarsa:** 70B kini **10,4s per panggilan** lawan p95 ~2,4s yang
  tercatat — seluruh aritmetika anggaran NFR-PERF-01 di 15 butir 2 dan tiket ini
  berdiri di atas angka yang tidak berlaku lagi. **Pelanggaran slot pertama
  tertangkap:** 70B menulis kata user (*"warteg"*) di tempat `{category}`, jadi app
  tak punya apa pun untuk disubstitusi — fog "kontrak slot angka" kini punya kasus
  konkret dan ternyata **lebih luas dari sekadar slot angka**. Kualitas bahasa:
  kedua model yang bekerja menghasilkan Indonesia **kaku** (8B memakai *"Anda"*),
  padahal prompt meminta kasual → menaikkan urgensi fog **"Nada dan persona bot"**.
  → [temuan lengkap](research/25-small-model-for-reply-composition.md) +
  [§ Hasil probe](issues/25-small-model-for-reply-composition.md).
  🚨 **Run yang sama menemukan jalur transaksi rusak** →
  [29 · Skema parsing ADR-0005 §3 ditolak model](issues/29-parse-schema-5024.md).
  🔴 **Run-2 membalik dua kesimpulan run-1 — baca § Hasil probe run-2 tiket 25
  sebelum memakai angka mana pun di atas.** (a) **SEA-LION tidak gagal** — ia
  menjawab sempurna, memakai `{amount}` **dan** `{category}`, dengan Indonesia
  **kasual** persis yang diminta (*"Oke, sudah dicatat pengeluaranmu … ya!"*),
  sementara 70B dan 8B dua-duanya kaku **dan** menjatuhkan `{category}` (8B bahkan
  menulis `Rp` sendiri). Yang salah adalah `normalize()` di probe. (b) **Binding
  mengembalikan dua bentuk berbeda tergantung model** — `{ response }` untuk Llama,
  **chat completion ala OpenAI** untuk GLM/SEA-LION — dan
  [`workers-ai-text-parser.ts:92-110`](../../src/worker/parsing/workers-ai-text-parser.ts)
  **hanya mengenal `.response`**, jadi bekas luka lama itu masih terbuka dan bukan
  anomali sekali jalan. GLM ternyata **reasoning model** (`content: null`, anggaran
  token habis di `.reasoning`), bukan gagal skema. (c) Klaim "baseline ADR-0005 §2
  kedaluwarsa" **dikoreksi jadi "variansi besar"** — 70B 10.370ms lalu 3.240ms; itu
  **lebih menyulitkan** anggaran, bukan lebih ringan. Probe sudah diperbaiki untuk
  ketiganya; **angka SEA-LION dan GLM belum final, jalankan ulang.**
  ✅ **Run-3 final (2026-08-03): pemenangnya `@cf/aisingapore/gemma-sea-lion-v4-27b-it`.**
  **1.390ms** (2,4× lebih cepat dari 70B), `json_schema` ✅, **satu-satunya dengan
  nol catatan pelanggaran** — ketiga slot utuh **dan** nada kasual persis persona
  Gita (*"Oke, sudah dicatat pengeluaranmu sebesar {amount} untuk {category} ya!"*),
  konsisten di dua run. 70B dan 8B dua-duanya **menjatuhkan `{category}`** dan
  menggantinya dengan kata user; 8B bahkan menjatuhkan `{total_harian}` juga dan
  pernah menulis `Rp` sendiri (padahal mata uang urusan app, ADR-0005 §4). GLM
  **dicoret** — reasoning model, `content: null`, 1.769 char habis di `.reasoning`,
  dan **10.880ms**, paling lambat. **15 butir 2 selamat dan terbukti.** Sinyal
  [DOC] yang paling prediktif ternyata yang paling sederhana: dokumentasi menyebut
  Indonesian **dengan nama**. ⚠️ Pelanggaran slot 70B/8B bukan sekadar cacat
  kandidat kalah — ia bukti **slot butuh verifikasi sebelum kirim**, bukan sekadar
  instruksi prompt, karena kalimat yang kehilangan slot **tetap terlihat wajar**.

- [21 · Seberapa luas dokumen skill yang divendor salah angka](issues/21-vendored-skill-doc-reliability.md)
  (research) — **47% klaim numerik tidak bisa dipertanggungjawabkan** (23 dari 49
  yang diadili di 7 subdir yang benar-benar disentuh Struku). Pola dominannya
  **dikarang, bukan basi — 16 lawan 5**, dan **10 dari 16 karangan** berbentuk
  tabel bertier free/paid, bentuk yang paling terbaca otoritatif (tabel "Plan Tier
  Limits" `d1/gotchas.md:47-56`: 5 dari 8 baris tanpa padanan resmi). Yang basi
  bergerak **ke arah aman** (batas resmi naik, dokumen tertinggal) jadi akibatnya
  konservatif; yang dikarang **tidak akan membaik dengan menunggu upstream**.
  **Hipotesis genre tiket gugur:** halaman referensi biasa **60%** bermasalah,
  lebih buruk daripada `gotchas.md` **41%** — jadi mitigasi yang menyasar nama
  file tidak bekerja. **Pola ketiga yang tak terduga:** angka resmi dipasang di
  kamar yang salah (64 env-var-free dilabeli "bindings"; 25 MiB per-file dilabeli
  "per deployment") — paling sulit dideteksi karena angkanya memang ada.
  Karangan yang sama direplikasi lintas file (batch size 3×, session 15 menit 3×),
  jadi tak ada satu file buruk yang bisa dikarantina. **Bentuk masalahnya bukan
  kekurangan aturan:** `SKILL.md:29` sudah menyuruh percaya dokumentasi di atas
  file referensi dan **menamai persis** kategori yang gagal (*"numeric limits,
  pricing tiers"*) — peringatan cuma bekerja kalau pembacanya punya alasan curiga,
  dan tabel bertier yang rapi menghapus alasan itu. → digraduasikan jadi
  [27 · Mitigasi dokumen skill yang divendor](issues/27-vendored-skill-doc-mitigation.md)
  (grilling, prioritas rendah, **butir 0-nya menanyakan apakah ia masuk
  destination sama sekali**). ⚠️ **Bukti terdegradasi, dan ini permanen untuk
  environment tanpa akses:** `developers.cloudflare.com` **dan**
  `docs.mcp.cloudflare.com` ditolak egress policy (403) — **kedua kanal yang
  AGENTS.md tunjuk**, diverifikasi independen sesi induk. Semua [DOC] lewat
  `WebSearch`, jadi vonis COCOK kuat tapi vonis DIKARANG lebih lemah; riset layak
  diulang saat `WebFetch` terbuka. 56 subdir lain tidak tersampel dan riset ini
  **tidak berhak** mengklaim apa pun tentang mereka.
  → [temuan lengkap](research/21-vendored-skill-doc-reliability.md).

- [15 · Permukaan percakapan → arsitektur percakapan menyeluruh](issues/15-conversational-surface.md)
  (grilling) — **arah pemilik repo diterima penuh dan diperkeras jadi keputusan.**
  Bentuk barunya: tiap pesan lewat **panggilan-1 (tebak maksud + ekstraksi) →
  business process → panggilan-2 (susun jawaban + ringkasan)**. Enam keputusan:
  (1) **semua** balasan disusun model, angka disisipkan app lewat **slot** — opsi
  "hanya jalur obrolan" ditawarkan dan **ditolak**, alasannya rasa personal;
  (2) panggilan-2 **selalu jalan**, pakai **model lebih kecil** (ADR-0005 §2
  sendiri menulis kapan pengecualian boleh diambil), cadangan kirim dua tahap;
  (3) panggilan-1 **menggantikan gerbang deterministik** — (a-penuh), bukan
  (a-router); (4) kegagalan model dibalas *"sistem sedang bermasalah"* yang
  dibedakan dari *"aku belum ngerti"*, **tanpa parser cadangan**; (5) ingatan
  percakapan = **ringkasan berjalan dititipkan ke panggilan-2** sebagai output
  kedua (`reply` + `summary`, dua string **flat** — yang bikin spiral 14s di
  spike itu objek bersarang, bukan ini); (6) ringkasan **reset harian**, identitas
  user (nama/locale/timezone dari tabel `users`) **tidak** ikut direset.
  **Koreksi fakta:** gerbang menuntut **empat** field non-null (termasuk
  `category`), bukan tiga — jadi hari ini transaksi yang kategorinya gagal
  ditebak tak pernah jadi draft. ⚠️ **Ongkos yang ditunjukkan dua kali lalu tetap
  dipilih:** [`workers-ai-text-parser.ts:77`](../../src/worker/parsing/workers-ai-text-parser.ts)
  balikin `UNKNOWN_REPHRASE_RESULT` saat model gagal — **tidak pernah throw** —
  dan hari ini yang menahannya justru gerbang itu. Seam ini **sudah pernah gagal
  diam-diam di produksi** (`.response` salah bentuk → seluruh parse jatuh ke
  unknown padahal model menjawab benar, lolos dari suite hijau). **Konsekuensi
  diterima sadar: kalau `env.AI` mati, Struku tidak bisa mencatat apa pun.**
  → **revisi ADR-0005 §1 + §2**, `intent` bertambah konsep "ubah",
  **[23A](issues/23-draft-confirmation-surface.md) batal** (belum dibangun, tak
  ada kode dibongkar), **[24](issues/24-edit-mode-escape.md) berubah bentuk**.
  Digraduasikan: [25](issues/25-small-model-for-reply-composition.md) (riset model
  kecil) dan [26](issues/26-spending-habits-memory.md) (kebiasaan belanja,
  blocked by 16). **Lima hal belum tertutup** — tercatat di § "Yang belum
  tertutup" tiket.

## Not yet specified

<!-- in-scope fog; graduates into tickets as the frontier advances -->

- **Koreksi transaksi setelah commit — mekanikanya.**
  [17](issues/17-post-commit-correction.md) memutuskan *kapan* (setelah
  [16](issues/16-reporting-query-surface.md)), bukan *bagaimana*. Tetap **di
  dalam** destination — keluhannya nyata dan belum terselesaikan; yang berubah
  cuma urutannya. Digraduasikan jadi tiket begitu 16 resolved, karena bentuk
  "menunjuk transaksi yang salah" bergantung pada bentuk permukaan reporting yang
  16 putuskan. Arah yang sudah dicondongi pemilik repo (reversal penuh 3 entry,
  jendela koreksi lebih lebar dari transaksi terakhir, jejak koreksi terlihat di
  laporan) tercatat di § "Arah yang dicondongi" tiket 17 — **bahan grilling,
  bukan kesepakatan**. Prasyarat diam-diamnya:
  [22](issues/22-persist-entry-description.md), tanpa itu menunjuk transaksi
  pakai kata-kata mustahil. **Cakupannya bertambah dari 22 (resolved):** pemilik
  repo ingin `description` bisa diedit **juga setelah commit**, saat membaca
  laporan — jadi tiket koreksi nanti bukan cuma soal membetulkan
  jumlah/kategori/tanggal, tapi juga teks keterangannya (ditimpa, bukan
  di-versi).

- ~~**Terjebak di mode edit.**~~ → digraduasikan jadi
  [24 · Terjebak di mode edit: tidak ada jalan keluar](issues/24-edit-mode-escape.md)
  (grilling, 2026-08-01). **Ditemukan di produksi**, bukan dari pembacaan kode:
  saat memverifikasi deploy `7436f2b5`, pemilik repo menekan Edit lalu mengetik
  *"Tidak jadi."* dan **terjebak** — `editState` yang terisi membuat
  `parseDraftCommand` (yang **sudah** mengerti "batal") tak pernah terpanggil
  lagi, dan balasan retry `kind: "text"` menghapus tombol `[Batal]` dari layar.
  Satu-satunya jalan keluar: menunggu timeout 30 menit. **Menghalangi verifikasi
  produksi [22](issues/22-persist-entry-description.md) dan
  [23B](issues/23-draft-confirmation-surface.md)** — tidak ada transaksi yang
  ter-commit di sesi itu, jadi keduanya **masih belum terbukti di workerd**.
  Arahan pemilik repo: jalan keluarnya lewat **model**, bukan menambah kata ke
  daftar sinonim → tiket ini **menyentuh `env.AI`** dan **tumpang tindih besar
  dengan [23](issues/23-draft-confirmation-surface.md) bagian A**; pertimbangkan
  menggabungkan implementasinya, karena 23A menjadikan "jatuh ke menu lama"
  sebagai jaring pengaman padahal **menu lama itulah yang menjebak**.

- **Lubang deteksi: menekan Konfirmasi tanpa membaca.** Digraduasikan dari
  temuan [23](issues/23-draft-confirmation-surface.md) (2026-08-01) dan **masih
  terbuka** — jangan dikira tertutup oleh 23. Grilling
  [17](issues/17-post-commit-correction.md) merumuskannya sebagai *"user tidak
  punya cara tahu kategorinya meleset"*, tapi pembacaan kode membantah itu:
  kategori **sudah** tampil di permukaan konfirmasi sebelum commit
  ([`reply.ts:48`](../../src/worker/parsing/reply.ts)). Jadi masalahnya bukan
  informasinya tidak ada, melainkan **tidak dibaca**. Konsekuensinya, dua hal
  yang tampak menutupnya sebenarnya tidak: balasan commit berrincian (23B) hanya
  meng-echo teks yang sama sedetik kemudian, dan baris diff edit natural (23A)
  hanya melindungi transaksi yang **kebetulan diedit**. Jangan diselesaikan
  dengan menambah teks — itu justru arah yang sudah terbukti tidak bekerja;
  tunggu bukti pemakaian harian soal seberapa sering ini benar-benar menggigit.
  Terikat ke fog **"Beban konfirmasi"** di bawah.
  ⚠️ **Bukti tandingan pertama (2026-08-01, sesi produksi):** pemilik repo
  **membaca** ringkasan, melihat kategorinya meleset ("Hiburan" untuk rokok),
  dan menekan Edit untuk memperbaikinya — lalu terjebak
  ([24](issues/24-edit-mode-escape.md)). Jadi hambatan pertama yang terbukti
  nyata **bukan** keengganan membaca, melainkan **biaya memperbaiki setelah
  membaca**. Timbang ulang fog ini setelah 24 selesai; mungkin bentuk aslinya
  salah.

- **Akurasi kategori pada pemakaian nyata.** Pemilik repo melaporkan setidaknya
  satu transaksi masuk kategori yang salah, tapi frasa persisnya tidak tercatat
  dan insidennya tidak dikejar (keputusan sadar — sedang melihat gambaran besar,
  bukan debugging satu transaksi). Kumpulkan frasa yang meleset selama pemakaian
  harian; kalau polanya muncul, ini bisa jadi ticket parsing tersendiri —
  terpisah dari "tidak bisa dibenerin", yang sudah ditangani
  [17 · Koreksi transaksi setelah commit](issues/17-post-commit-correction.md).
- **Depth dan seam di jalur masuk pesan.** Disurvei 2026-08-04 di jalur AFK
  (`/improve-codebase-architecture`) →
  [temuan lengkap](research/architecture-survey-2026-08-04.md). Enam kandidat
  deepening; **kandidat 01 digraduasikan** jadi
  [28 · Gerbang transaksi ditulis dua kali dengan syarat berbeda](issues/28-transaction-gate-arity.md)
  — satu-satunya yang lubangnya **dibuktikan jalan** (parse `category:null` dengan
  amount lengkap membalas seperti konfirmasi sementara nol baris masuk ledger).
  **Lima sisanya tetap fog dan sengaja tidak di-ticket:** seam `env.AI` yang
  dipasang lewat poke field publik (paling terikat waktu — panggilan-2
  [15](issues/15-conversational-surface.md) adalah adapter kedua yang membuat seam
  itu nyata), urutan keputusan draft yang tak punya permukaan test (akar
  [24](issues/24-edit-mode-escape.md); `draft/` = 477 baris nol test langsung),
  slug chart of accounts yang punya dua deklarasi tanpa tautan tipe, dua idiom
  *conversation context* berdampingan, dan dua aturan yang masing-masing punya dua
  pemilik. ⚠️ **Jangan dianggap in-scope diam-diam:** kelimanya soal *cara
  membangun*, bukan *apakah Struku bisa dipakai harian* — pertanyaan yang sama yang
  [27](issues/27-vendored-skill-doc-mitigation.md) butir 0 tanyakan tentang dirinya
  sendiri, dan survei ini **tidak berhak** menjawabnya sendirian. Bukti kelimanya
  **pembacaan kode**, kelas lebih lemah daripada kandidat 01 yang dibuktikan jalan.

- ~~**Keandalan dokumen skill yang divendor.**~~ → diukur di
  [21](issues/21-vendored-skill-doc-reliability.md) (**resolved** 2026-08-03,
  lihat Decisions so far), mitigasinya digraduasikan jadi
  [27 · Mitigasi dokumen skill yang divendor](issues/27-vendored-skill-doc-mitigation.md)
  (grilling, prioritas rendah, tidak memblokir apa pun). **Jangan dianggap
  tertutup:** 21 hanya mengukur — tidak satu pun baris skill diperbaiki, dan
  keputusan mitigasinya sengaja diserahkan ke 27, termasuk pertanyaan apakah ia
  masuk destination map ini sama sekali.

- ~~**Arsitektur percakapan menyeluruh (arah baru pemilik repo).**~~ →
  **diputuskan** di [15](issues/15-conversational-surface.md) (2026-08-02); lihat
  Decisions so far. Yang **tersisa sebagai fog** dari situ, dan sengaja tidak
  di-ticket karena belum cukup tajam: **bentuk kontrak slot angka.** Butir 1
  memutuskan *prinsipnya* (model menyusun kalimat, app mengisi angka lewat slot),
  tapi bentuknya belum ada — daftar slot yang sah, apa yang terjadi kalau model
  menyebut slot yang tidak dikenal atau malah menulis angka langsung, dan
  bagaimana itu diverifikasi sebelum dikirim ke user. Ini **satu-satunya
  pertahanan** terhadap halusinasi angka di bot keuangan, jadi ia butuh bentuk
  yang keras — tapi bentuknya baru terlihat setelah diketahui model mana yang
  dipakai dan seberapa nurut ia pada instruksi slot.
  ✅ **Syaratnya sekarang terpenuhi** — probe [25](issues/25-small-model-for-reply-composition.md)
  memberi **tiga kasus konkret**: 70B menulis kata user (*"warteg"*) di tempat
  `{category}`; 8B menjatuhkan `{category}` **dan** `{total_harian}` sekaligus, dan
  di run lain menyisipkan `Rp` sendiri. Dua pelajarannya mempertajam bentuk tiket
  yang akan lahir: (a) namanya **terlalu sempit** — yang bocor bukan cuma slot
  *angka*, tapi juga kategori dan simbol mata uang; (b) kalimat yang kehilangan slot
  **tetap terbaca wajar**, jadi instruksi prompt saja tidak cukup — butuh
  **verifikasi sebelum kirim**. Siap digraduasikan jadi tiket; belum dilakukan agar
  tidak mendahului revisi ADR-0005 yang akan menampung kosakatanya.
  ⚠️ **Masih di fog, dan syarat graduasinya bergeser.** Rencana semula "graduasikan
  setelah [25](issues/25-small-model-for-reply-composition.md)" **tidak terpenuhi**:
  25 resolved tanpa memilih model. Syaratnya sekarang **hasil probe**, bukan
  resolusi tiket. Probe-nya
  ([`test/live/reply-composer-probe.test.ts`](../../test/live/reply-composer-probe.test.ts))
  sudah ikut mengukur disiplin slot — ia menandai model yang menulis digit ke
  `reply` alih-alih membiarkan `{amount}` — jadi bahan bakunya akan ada begitu
  pemilik repo menjalankannya.

- **Apakah ringkasan percakapan diumpankan ke panggilan-1?**
  [15](issues/15-conversational-surface.md) butir 5 memutuskan ringkasan
  *dihasilkan* oleh panggilan-2; ke mana ia *dikonsumsi* belum diputuskan.
  Mengumpankannya ke panggilan-1 membuat pesan `"warteg 25rb"` bisa terbaca
  berbeda tergantung obrolan sebelumnya — dan setelah butir 3, panggilan-1 adalah
  **satu-satunya** yang menentukan uang tercatat. Terikat ke dua lubang lain yang
  juga lahir dari butir 3 dan sama-sama belum punya penyelesaian: **pesan ambigu
  saat ada draft** (`"kopi 15rb"` — transaksi baru atau edit?) dan
  **keluar-konteks yang kebetulan ada angkanya** (bisa jadi draft alih-alih
  diluruskan). Ketiganya soal "seberapa banyak konteks yang boleh mempengaruhi
  panggilan-1" — kemungkinan besar satu tiket, bukan tiga, tapi bentuknya baru
  jelas setelah ada implementasi yang bisa dilihat.

- **Nada dan persona bot.** Kalau [15](issues/15-conversational-surface.md)
  memutuskan bot boleh ngobrol, "ngobrol seperti apa" adalah pertanyaan
  berikutnya — dan sebagian jawabannya soal selera, bukan arsitektur.
- **Beban konfirmasi.** Tiap transaksi sekarang wajib dikonfirmasi. Belum
  terbukti mengganggu (belum dipakai harian), tapi kalau iya, pertanyaannya
  menyentuh ADR-0004 dan flow draft. Tunggu bukti pemakaian.
  **Sekarang disentuh dari tiga arah** — jangan diputuskan terpisah di ketiganya:
  [23](issues/23-draft-confirmation-surface.md) (seberapa banyak rincian setelah
  commit sebelum jadi berisik), § "Arah yang dicondongi" tiket
  [17](issues/17-post-commit-correction.md) (apakah koreksi perlu konfirmasi
  sendiri — condong tidak, belum diputuskan), dan
  [22](issues/22-persist-entry-description.md) yang **menambah satu field lagi ke
  permukaan konfirmasi** (keterangan ikut bisa diedit) — menambah beban pada flow
  yang justru dicurigai sudah berat.
  **Jawaban parsial dari [23](issues/23-draft-confirmation-surface.md) (2026-08-01):**
  prinsip yang dipakai adalah **rincian tambahan hanya di jalur yang butuh
  pembuktian**, bukan di semua jalur — baris diff hanya muncul setelah edit
  bahasa natural (jalur yang bisa salah menafsirkan), tidak setelah edit lewat
  menu (user baru saja memilih field-nya). Fog ini **belum tertutup**: yang belum
  terjawab adalah apakah konfirmasi per-transaksi itu sendiri terlalu berat, dan
  itu menunggu bukti pemakaian harian.
- **Kategori kustom (§3.6).** Intent `category` sudah diklasifikasi tapi
  handler-nya stub. Apakah kategori bawaan (16 akun) cukup untuk pemakaian
  harian — belum terbukti. Tunggu bukti pemakaian.
- **Budget chat-native (§3.5).** Intent `budget` juga stub. Kemungkinan besar
  butuh reporting lebih dulu (tak bisa bilang "sisa budget" tanpa bisa
  menjumlahkan), jadi fog ini kemungkinan mencair setelah
  [16](issues/16-reporting-query-surface.md).
- **Multi-currency pada jalur reporting (FR-CUR-03..05).** ADR-0002 sengaja
  menaruh FX hanya di jalur reporting. Begitu reporting nyata, pertanyaannya
  hidup — tapi hanya kalau pemilik repo benar-benar punya transaksi non-IDR.
- **Parsing gambar / struk.** Berpotensi mengurangi ketikan harian secara
  drastis, tapi bergantung pada akurasi OCR bahasa Indonesia yang belum
  divalidasi (risiko PRD §13). Masuk destination hanya kalau mengetik terbukti
  jadi penghambat pemakaian harian.

## Out of scope

Di luar destination "layak dipakai satu user harian". Ini **tidak** akan
digraduasikan; kalau destination digambar ulang, mereka kembali sebagai effort
baru — bukan lanjutan map ini.

- **Billing / freemium + Xendit (§3.13)** — keputusan soal batas dan harga butuh
  data pemakaian nyata yang belum ada sama sekali (DB baru dikosongkan
  2026-08-01, sebelum chat nyata pertama). Memutuskannya sekarang berarti
  menebak, lalu membongkarnya lagi.
- **Admin Console (§3.14–§3.15)** — oversight user/data/langganan, audit log,
  gating Cloudflare Access. Perkakas untuk melayani *banyak* user; destinasi ini
  satu user.
- **WhatsApp / provider kedua** — seam `MessagingProvider` (ADR-0004) sudah ada
  justru supaya ini bisa ditunda tanpa utang arsitektur. Satu user, satu channel.
- **Multi-channel linking + kode sekali-pakai (§3.11)** — hanya berarti kalau
  ada channel kedua.
- **Lapisan i18n penuh (PRD §9)** — copy dwibahasa id/en yang sekarang di-hardcode
  sudah cukup untuk satu user yang tahu kedua bahasa.
- **Enkripsi-at-rest + mekanik hak subjek data UU PDP (NFR-SEC-03, NFR-SEC-08)** —
  kewajiban yang mengikat saat melayani pihak lain; langkah consent eksplisit di
  onboarding sudah ada.
- **Detail web view read-only + `detail_view_tokens` (§3.9)** — permukaan kedua
  di luar chat. [16](issues/16-reporting-query-surface.md) boleh menyimpulkan
  chat saja tidak cukup; kalau begitu, itu menggambar ulang destination.
- **PRD §5.2 kandidat fitur** (alert budget, deteksi transaksi berulang, parsing
  voice-note, split transaction, tagging klien/proyek, alert anomali, program
  referral, ekspor akuntan, ledger bersama) — sudah dicoret dari v1 di SRS §1.2.
- **Dashboard web umum; akuntansi bisnis/UKM; integrasi bank langsung** (SRS §1.2).

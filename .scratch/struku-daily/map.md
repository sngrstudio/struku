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
  belum ditulis** — keputusannya ada di tiket 15, dan menulis revisinya sebaiknya
  menunggu [25](issues/25-small-model-for-reply-composition.md) supaya §2 bisa
  menyebut model yang benar, bukan placeholder.
- **Skills tiap sesi:** `/grilling` + `/domain-modeling` (default), `/prototype`
  (spike), `/research` (fakta eksternal). Catat keputusan sebagai ADR di
  `docs/adr/`, tambah istilah ke [`CONTEXT.md`](../../CONTEXT.md).
- **Telusuri tiap keputusan balik ke SRS FR-ID** di ADR-nya.
- **Guardrail Workers (dari sesi deploy, jangan dilanggar):** miniflare ≠ workerd.
  Dua bug produksi lolos dari suite lokal yang hijau. Kalau menyentuh seam
  `env.AI` atau `fetch`, `npm run test:live` + deploy nyata + `wrangler tail`
  itu **wajib**, bukan opsional.
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
- ~~**Keandalan dokumen skill yang divendor.**~~ → digraduasikan jadi
  [21 · Seberapa luas dokumen skill yang divendor salah angka](issues/21-vendored-skill-doc-reliability.md)
  (research, 2026-08-01). Riset [14](issues/14-d1-aggregate-query-capability.md)
  menemukan `references/d1/gotchas.md` (ikut ter-commit di `5fa95a7`) menyebut
  batas baris 1 MB padahal halaman limits resmi menyebut 2 MB, plus batas batch
  bertier free/paid yang **tidak ada sama sekali** di dokumentasi. Aturan
  AGENTS.md ("ambil dokumentasi terkini") menutupnya secara kebetulan. Tiket 21
  mengukur seberapa luas ketidakcocokannya sebelum mitigasi apa pun diputuskan —
  **prioritas rendah, tidak memblokir apa pun**, ambil hanya saat butuh kerjaan
  AFK.

- ~~**Arsitektur percakapan menyeluruh (arah baru pemilik repo).**~~ →
  **diputuskan** di [15](issues/15-conversational-surface.md) (2026-08-02); lihat
  Decisions so far. Yang **tersisa sebagai fog** dari situ, dan sengaja tidak
  di-ticket karena belum cukup tajam: **bentuk kontrak slot angka.** Butir 1
  memutuskan *prinsipnya* (model menyusun kalimat, app mengisi angka lewat slot),
  tapi bentuknya belum ada — daftar slot yang sah, apa yang terjadi kalau model
  menyebut slot yang tidak dikenal atau malah menulis angka langsung, dan
  bagaimana itu diverifikasi sebelum dikirim ke user. Ini **satu-satunya
  pertahanan** terhadap halusinasi angka di bot keuangan, jadi ia butuh bentuk
  yang keras — tapi bentuknya kemungkinan besar baru terlihat saat
  [25](issues/25-small-model-for-reply-composition.md) menunjukkan model kecil
  mana yang dipakai dan seberapa nurut ia pada instruksi slot. Graduasikan
  setelah 25.

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

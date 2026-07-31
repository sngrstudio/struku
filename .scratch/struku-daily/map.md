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
- **Skills tiap sesi:** `/grilling` + `/domain-modeling` (default), `/prototype`
  (spike), `/research` (fakta eksternal). Catat keputusan sebagai ADR di
  `docs/adr/`, tambah istilah ke [`CONTEXT.md`](../../CONTEXT.md).
- **Telusuri tiap keputusan balik ke SRS FR-ID** di ADR-nya.
- **Guardrail Workers (dari sesi deploy, jangan dilanggar):** miniflare ≠ workerd.
  Dua bug produksi lolos dari suite lokal yang hijau. Kalau menyentuh seam
  `env.AI` atau `fetch`, `npm run test:live` + deploy nyata + `wrangler tail`
  itu **wajib**, bukan opsional.
- **Mode:** planning-by-default (tidak ada override eksekusi).

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
  pakai kata-kata mustahil.

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

- **Nada dan persona bot.** Kalau [15](issues/15-conversational-surface.md)
  memutuskan bot boleh ngobrol, "ngobrol seperti apa" adalah pertanyaan
  berikutnya — dan sebagian jawabannya soal selera, bukan arsitektur.
- **Beban konfirmasi.** Tiap transaksi sekarang wajib dikonfirmasi. Belum
  terbukti mengganggu (belum dipakai harian), tapi kalau iya, pertanyaannya
  menyentuh ADR-0004 dan flow draft. Tunggu bukti pemakaian.
  **Sekarang disentuh dari dua arah** — jangan diputuskan terpisah di keduanya:
  [23](issues/23-draft-confirmation-surface.md) (seberapa banyak rincian setelah
  commit sebelum jadi berisik) dan § "Arah yang dicondongi" tiket
  [17](issues/17-post-commit-correction.md) (apakah koreksi perlu konfirmasi
  sendiri — condong tidak, belum diputuskan).
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

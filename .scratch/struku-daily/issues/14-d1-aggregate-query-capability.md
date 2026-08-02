# 14 — Kapabilitas query agregat D1 untuk reporting

Type: research
Status: resolved
Blocked by: —

## Question

Apa yang **sebenarnya** ditawarkan dan dibatasi D1 untuk jalur reporting Struku,
sehingga [16 · Permukaan reporting & query](16-reporting-query-surface.md) dan
[18 · Revisit keputusan no-ORM](18-revisit-no-orm.md) bisa diputuskan di atas
fakta, bukan ingatan?

Yang perlu dijawab:

1. **Agregasi & pengelompokan.** SQL subset apa yang didukung D1 untuk
   `SUM`/`GROUP BY`/CTE/window function? Reporting butuh menjumlahkan
   `journal_lines.amount_minor` per kategori per rentang tanggal — konfirmasi
   bentuk mana yang jalan.
2. **Bucketing tanggal.** Fakta skema yang sudah dipastikan (jangan diturunkan
   ulang): `journal_entries.entry_date` bertipe **`TEXT` berformat `'YYYY-MM-DD'`**
   — tanggal akuntansi lokal, **bukan** timestamp — dan sudah ada
   `CREATE INDEX idx_journal_entries_user_date ON journal_entries(user_id, entry_date)`.
   `created_at` terpisah dan bertipe `INTEGER`.

   Karena tanggalnya sudah lokal, konversi timezone **tidak** dibutuhkan di
   dalam query — batas rentang cukup dihitung sebagai string di aplikasi
   (`users.timezone`, migrasi `0002`, sudah dialirkan ke `buildParseReply`), lalu
   dibandingkan dengan `BETWEEN`. Yang perlu dikonfirmasi:
   - Apakah perbandingan rentang `TEXT` seperti itu **memakai index** di
     SQLite/D1, atau justru memaksa full scan?
   - Untuk pengelompokan mingguan/bulanan, mana yang lebih baik: fungsi
     `strftime` di SQL, atau menghitung batas tiap bucket di aplikasi lalu
     mengirim beberapa query? Konfirmasi dukungan `strftime` di D1.
   - Perhatikan asimetri ini: `entry_date` lokal tapi `created_at` epoch —
     "transaksi terakhir" ([16](16-reporting-query-surface.md)) mungkin ingin
     mengurutkan dengan `created_at`, bukan `entry_date`.
3. **Batas yang mengikat.** Ambil dari `/d1/platform/limits/`: batas ukuran hasil
   query, waktu eksekusi, jumlah baris. Reporting bulanan satu user tidak akan
   besar, tapi angkanya perlu tercatat supaya keputusan tidak dibuat sambil
   menebak.
4. **Query bertahap.** Kalau satu laporan butuh beberapa query (total + breakdown
   kategori), apakah D1 batching (`batch()`) tepat di sini, dan apa konsekuensinya
   terhadap konsistensi bacaan?

**Kerjakan lewat subagent `/research`.** AGENTS.md menetapkan aturan STOP:
ambil dokumentasi Cloudflare terkini sebelum pekerjaan D1 apa pun — jangan
menjawab dari ingatan model. Catat temuan di
`.scratch/struku-daily/research/14-d1-aggregate-query-capability.md`.

**Konteks yang sudah ada — jangan diturunkan ulang:**

- Skema ledger: [ADR-0002](../../../docs/adr/0002-double-entry-ledger-schema.md) —
  minor units integer + `currencies.exponent`, `direction` enum, satu mata uang
  per entry, `(user_id, slug)` sebagai kunci join.
- Migrasi ada di repo; `journal_entries` / `journal_lines` sudah terisi dan
  balanced pada pemakaian nyata, jadi datanya nyata, bukan hipotetis.
- Ingatan proyek `no-orm-tracer-1` mencatat tracer #1 sengaja memakai SQL tulisan
  tangan tanpa ORM, dengan catatan eksplisit: **revisit at reporting.**

## Answer

**D1 tidak memaksa keputusan apa pun di jalur reporting.** Semua yang dibutuhkan
tersedia, dan tidak ada batas yang mengikat untuk laporan bulanan satu user.
Temuan lengkap (dengan tiap klaim menyandang URL sumber, dan penandaan `[PROBE]`
untuk yang diverifikasi sendiri vs `[DOC]` untuk yang dari dokumentasi):
[`research/14-d1-aggregate-query-capability.md`](../research/14-d1-aggregate-query-capability.md)
— commit `209b6a7` di branch `research/14-d1-aggregate` (belum di-merge).

### 1. Agregasi & pengelompokan

Jalan: `SUM`, `COUNT(DISTINCT)`, `GROUP BY`/`HAVING`, CTE, window function
(`SUM OVER`, `LAG`, `RANK`), `strftime`, agregasi kondisional, `UNION ALL`.

Tidak jalan: `GROUP BY ROLLUP(...)` (`no such function: ROLLUP`) dan
`sqlite_version()` (diblokir — jadi versi engine tidak pernah bisa diintrospeksi;
buktikan fitur satu per satu, jangan menyimpulkan dari versi).

Dokumentasi tidak pernah menerbitkan matriks fitur SQL, hanya "compatible with
most SQLite's SQL convention" — itu sebabnya hasil di atas diverifikasi lewat
probe, bukan diasumsikan.

### 2. Bucketing tanggal

- Perbandingan rentang `TEXT` **memakai index**, terkonfirmasi lewat query plan:
  `SEARCH e USING INDEX idx_journal_entries_user_date (user_id=? AND entry_date>? AND entry_date<?)`.
- **`strftime` di SQL menang** atas N-query per bucket, dan index tetap terpakai
  karena penyaringan tetap `BETWEEN` telanjang di kolom mentah — `strftime` hanya
  melabeli `GROUP BY`. Jangan pernah membungkus `entry_date` di dalam `WHERE`.
- **Asimetri `created_at` yang dicurigai tiket ini nyata**: mengurutkan dengan
  `created_at` menambah `USE TEMP B-TREE FOR ORDER BY` atas seluruh baris user
  meski ada `LIMIT 5`; `entry_date` tersortir gratis dari index. Ongkosnya bisa
  diabaikan pada skala satu user, tapi pilihannya jadi sadar.
- Pakai batas **half-open** (`>= awal AND < awal_periode_berikutnya`) sebagai
  konvensi rentang — lebih tahan banting daripada `BETWEEN` inklusif.

### 3. Batas yang mengikat

30 detik durasi query maksimum (berlaku untuk **keseluruhan** panggilan batch,
bukan per statement); 1.000 query per invocation (berbayar) / 50 (gratis); 100
bound parameter; statement 100 KB; baris 2 MB; jumlah baris tak terbatas.
**Tidak ada satu pun yang mengikat laporan bulanan satu user.**

Catat sebagai *ketiadaan angka*, bukan sebagai kelonggaran: **tidak ada batas
ukuran hasil query yang terdokumentasi.** Karena itu agregasikan di SQL, jangan
bersandar pada plafon yang dibayangkan.

### 4. Query bertahap

`batch()` memberi atomisitas + satu round-trip; batas per-statement tetap
dihitung individual terhadap kuota. `BEGIN`/`COMMIT` eksplisit **ditolak**, jadi
`batch()` adalah satu-satunya primitif transaksi.

### Tiga temuan yang harus mengubah rencana ticket 16

1. **`PRAGMA optimize` hilang, dan itu diam-diam mematikan index.** Sebelum
   dijalankan, planner **mengabaikan** `idx_journal_entries_user_date` sepenuhnya
   dan men-drive query dari `journal_lines` — rentang tanggalnya tidak menyaring
   sama sekali. Sesudahnya, plan berubah jadi index seek yang benar. Dokumentasi
   menganjurkannya setelah membuat index; **tidak ada di migrasi `0001` maupun
   `0002`**. "Index-nya ada" ≠ "index-nya dipakai". Di mana ia dijalankan
   (migrasi baru vs langkah rutin pasca-deploy) adalah keputusan
   [16](16-reporting-query-surface.md) — tapi kebutuhannya sudah pasti.
2. **Filter naif `direction='debit'` mencemari breakdown dengan akun `cash`,**
   karena entry pemasukan men-debit `cash`. Breakdown harus menyaring lewat
   `accounts.type` (`'expense'`/`'income'`), bukan lewat `direction` saja.
   Jebakan double-entry yang gampang lolos review.
3. **Saring `status`.** `journal_entries.status` bernilai
   `'posted'|'reversed'|'reversal'`; tanpa filter, entry pembalik akan
   dihitung ganda. Ini mengikat langsung ke
   [17](17-post-commit-correction.md) — begitu koreksi ada, reversal jadi nyata.

### Dua caveat yang harus dibawa sesi berikutnya

- **Query plan diverifikasi lokal saja.** Akses D1 remote diblokir permission
  classifier. Mengingat ingatan proyek `miniflare-vs-workerd-gap` — suite lokal
  hijau tidak membuktikan apa pun soal seam yang menyentuh binding nyata —
  plan-plan ini **harus dikonfirmasi ulang dengan `--remote`** sebelum
  [16](16-reporting-query-surface.md) mengunci bentuk query. Perlakukan angka
  plan di atas sebagai kuat-tapi-belum-final.
- **Dokumen skill yang divendor bertentangan dengan halaman limits resmi:**
  `references/d1/gotchas.md` mengklaim batas baris 1 MB (resmi: 2 MB) dan
  menyebut batas batch yang tidak ada di dokumentasi. Aturan "percayai dokumen
  resmi" yang diikuti di sini benar; tapi ini berarti **materi skill yang
  divendor tidak bisa dipercaya buta** untuk angka.

### Untuk ticket 18 (no-ORM)

Kapabilitas D1 **tidak memaksa** keputusan ke arah mana pun — jadi
[18](18-revisit-no-orm.md) bisa diputuskan atas dasar ergonomi dan perawatan,
bukan atas dasar batasan database. Dua batas yang relevan kalau ORM
dipertimbangkan: maksimum **100 bound parameter** per query dan **statement
100 KB** — query builder yang meng-generate `IN (...)` panjang bisa menabraknya.
`PRAGMA optimize` tetap dibutuhkan terlepas dari ORM atau bukan; itu urusan
operasional skema, bukan layer akses data.

## Verifikasi `--remote` (2026-08-01) — caveat #1 dibayar

Caveat "query plan diverifikasi lokal saja" **sudah ditutup**. Akses `--remote`
tidak lagi diblokir; probe dijalankan langsung ke `struku-ledger` produksi.

**1. Temuan inti terkonfirmasi di produksi.** `SELECT name FROM sqlite_master
WHERE name='sqlite_stat1'` mengembalikan **kosong** — produksi tidak punya
statistik tabel sama sekali. `EXPLAIN QUERY PLAN` breakdown kategori bulanan di
remote persis rencana yang salah itu:

```
SEARCH l USING INDEX idx_journal_lines_account (user_id=?)
SEARCH e USING INDEX sqlite_autoindex_journal_entries_1 (id=?)
```

`idx_journal_entries_user_date` tidak muncul; rentang tanggal tidak menyaring.

**2. Plan di remote hari ini tidak konklusif — dan ini penting.** Produksi baru
berisi **2 entry / 4 line** (DB dikosongkan 2026-08-01). Setelah `PRAGMA
optimize` dijalankan di remote, plan-nya jadi `SCAN e` + `SCAN l`, *bukan* index
seek. Itu **bukan** regresi: pada tabel 2 baris full scan memang lebih murah dan
planner benar. Artinya plan yang diukur di produksi kosong tidak membuktikan
apa pun soal perilaku pada volume nyata.

**3. Diukur ulang pada volume realistis** (sqlite lokal dari `migrations/0001` +
`0002`, 2000 entry / 4000 line). Di sini efeknya bersih dan cocok dengan temuan
riset asli:

| | plan | VM steps |
|---|---|---|
| tanpa `sqlite_stat1` | drive dari `journal_lines`, tanggal tidak menyaring | **58.116** |
| setelah `PRAGMA optimize` | `SEARCH e USING idx_journal_entries_user_date (user_id=? AND entry_date>? AND entry_date<?)` | **7.278** |

**8× lipat**, dan rasionya **melebar** seiring ledger tumbuh: tanpa statistik
biaya mengikuti *total* baris user, bukan baris di dalam rentang tanggal.
Wall-clock sama-sama ~4 ms pada 2000 baris — jadi ini tidak akan terasa saat
dipakai, tapi tetap ditagih D1 sebagai rows read.

### Koreksi terhadap rekomendasi #1 riset ini

Riset asli bilang *"tambahkan `PRAGMA optimize`"* sebagai item actionable, dan
implikasi wajarnya adalah menaruhnya di migrasi. **Itu tidak akan bekerja** —
diuji, bukan dikira-kira:

- Migrasi jalan sekali, pada DB yang umumnya masih kosong.
- `ANALYZE` pada DB kosong **tidak menulis baris sama sekali** untuk
  `journal_entries` (diverifikasi: `sqlite_stat1` kosong untuk tabel itu).
- Setelah DB diisi sampai 2000 entry tanpa refresh, planner **kembali** ke
  rencana yang salah — identik dengan kondisi tanpa statistik.

Migrasi `0003_analyze_stats.sql` sempat ditulis lalu **dibuang** setelah tes ini
membuktikannya no-op.

Jadi statistik harus di-refresh **setelah ledger punya data, dan berulang**
seiring ia tumbuh — bukan sekali saat deploy. *Di mana* `PRAGMA optimize`
dipanggil (cron trigger? sesudah commit ke-N? saat startup DO?) adalah keputusan
desain yang belum dibuat, dan mengikat [16](16-reporting-query-surface.md).
Sengaja **tidak** diputuskan di sesi ini — ia milik map, bukan efek samping
verifikasi.

Caveat #2 (dokumen skill divendor) tidak tersentuh dan tetap berdiri.

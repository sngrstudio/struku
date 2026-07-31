# 14 — Kapabilitas query agregat D1 untuk reporting (temuan riset)

Status: resolved
Ticket: [14](../issues/14-d1-aggregate-query-capability.md)
Feeds: [16 · Permukaan reporting & query](../issues/16-reporting-query-surface.md),
[18 · Revisit keputusan no-ORM](../issues/18-revisit-no-orm.md)
Tanggal: 2026-08-01

## Cara temuan ini diverifikasi

Dua kelas bukti, dibedakan eksplisit karena bobotnya berbeda:

- **[DOC]** — diambil dari dokumentasi Cloudflare terkini (aturan STOP di AGENTS.md).
  Setiap klaim membawa URL sumbernya.
- **[PROBE]** — diverifikasi empiris terhadap engine D1 lewat
  `wrangler d1 execute --local` (wrangler 4.116.0), memakai skema asli dari
  `migrations/0001` + `0002` dan **3.192 journal_entries / 6.384 journal_lines**
  hasil seed (2 user, rentang 2025-01 s/d 2026-07).

> **Peringatan yang harus dibaca sebelum memakai [PROBE]:** ingatan proyek
> `miniflare-vs-workerd-gap` mencatat suite lokal hijau tidak membuktikan apa pun
> soal perilaku runtime asli. Probe di bawah dijalankan pada D1 **lokal**, karena
> akses `--remote` diblokir permission classifier di sesi ini. Untuk dukungan
> fungsi SQL risikonya kecil (engine SQLite yang sama), tapi **rencana query
> planner dan angka performa wajib dikonfirmasi ulang lewat `--remote` atau
> `test:live`** sebelum ticket 16 mengunci bentuk query. Ini satu-satunya
> pekerjaan verifikasi yang tersisa dari ticket ini.

---

## 1. Agregasi & pengelompokan

**Kesimpulan: semua bentuk yang dibutuhkan reporting jalan. Tidak ada blocker.**

Dokumentasi tidak pernah membuat matriks fitur SQL eksplisit — kalimatnya cuma
D1 "compatible with most SQLite's SQL convention" karena memakai query engine
SQLite ([DOC], https://developers.cloudflare.com/d1/sql-api/sql-statements/).
Karena itu dukungan agregat dibuktikan lewat probe, bukan diasumsikan.

Terbukti jalan dalam satu query [PROBE]:

| Bentuk | Status |
|---|---|
| `SUM()`, `COUNT()`, `COUNT(DISTINCT ...)` | jalan |
| `GROUP BY` + `HAVING` + `ORDER BY` agregat | jalan |
| CTE (`WITH ... AS`) | jalan |
| Window function: `SUM() OVER (ORDER BY ...)`, `LAG()`, `RANK()` | jalan |
| `strftime('%Y-%m', ...)`, `date(..., 'start of month')`, `substr()` | jalan |
| Conditional aggregation (`SUM(CASE WHEN ... )`) | jalan |
| `UNION ALL` (total + breakdown dalam satu round-trip) | jalan |

Dukungan CTE juga terkonfirmasi dari sisi dokumentasi secara tidak langsung: D1
me-retry query read-only yang hanya mengandung keyword `SELECT`, `EXPLAIN`, dan
**`WITH`** — `WITH` diperlakukan sebagai keyword read-only kelas satu
([DOC], https://developers.cloudflare.com/d1/sql-api/sql-statements/).

### Yang TIDAK didukung — catat ini

- **`GROUP BY ROLLUP(...)` gagal**: `no such function: ROLLUP` [PROBE].
  Ini fitur SQLite yang memang tidak ada, bukan batasan D1. Kalau ticket 16 mau
  "total + per-kategori dalam satu hasil", pakai `UNION ALL` atau conditional
  aggregation (dua-duanya sudah diverifikasi jalan), bukan ROLLUP.
- **`sqlite_version()` diblokir**: `not authorized to use function:
  sqlite_version` [PROBE]. Versi engine tidak bisa di-introspect dari dalam SQL,
  dan dokumentasi tidak menyebut nomor versi SQLite di mana pun. Konsekuensinya:
  **jangan pernah menyandarkan keputusan pada nomor versi SQLite** — buktikan
  per-fitur lewat probe seperti di atas.
- **`BEGIN` / `COMMIT` / `SAVEPOINT` eksplisit ditolak** [PROBE], dengan pesan
  error yang mengarahkan ke API transaksi Durable Objects. Tidak ada transaksi
  interaktif. Lihat bagian 4.

---

## 2. Bucketing tanggal

### 2a. Apakah perbandingan rentang TEXT memakai index?

**Ya — index seek, bukan full scan. Tapi ada syarat yang nyaris terlewat.**

`EXPLAIN QUERY PLAN` pada query breakdown kategori bulanan [PROBE]:

```
SEARCH e USING INDEX idx_journal_entries_user_date (user_id=? AND entry_date>? AND entry_date<?)
SEARCH l USING INDEX idx_journal_lines_entry (user_id=? AND entry_id=?)
SEARCH a USING INDEX sqlite_autoindex_accounts_1 (id=?)
USE TEMP B-TREE FOR GROUP BY
```

`entry_date>? AND entry_date<?` di dalam kurung index = rentang dipakai sebagai
batas seek pada index. `BETWEEN` di atas kolom `TEXT` berformat `'YYYY-MM-DD'`
bekerja persis seperti yang diharapkan, karena urutan leksikografis format itu
identik dengan urutan kronologis. Aturan multi-kolom Cloudflare terpenuhi:
query menyertakan `user_id` (kolom paling kiri) plus `entry_date`
([DOC], https://developers.cloudflare.com/d1/best-practices/use-indexes/ —
index dipakai hanya bila query mencakup "all of the columns, or a subset of the
columns provided all columns to the 'left' are also within the query").

> **TEMUAN YANG MENGEJUTKAN — ini yang paling penting di ticket ini.**
> Sebelum `PRAGMA optimize` dijalankan, planner **mengabaikan**
> `idx_journal_entries_user_date` sepenuhnya dan malah men-drive query dari
> `journal_lines` lewat `idx_journal_lines_account`. Rentang tanggalnya tidak
> ikut menyaring sama sekali. Setelah `PRAGMA optimize`, plan-nya langsung
> berubah jadi index seek yang benar seperti di atas [PROBE].
>
> Dokumentasi memang menganjurkan menjalankan `PRAGMA optimize` setelah membuat
> index, untuk mengumpulkan statistik tabel
> ([DOC], https://developers.cloudflare.com/d1/best-practices/use-indexes/),
> tapi repo ini **tidak pernah menjalankannya** — tidak ada di `migrations/0001`
> maupun `0002`. Artinya index reporting bisa saja ada tapi tidak terpakai di
> produksi. Ini item konkret untuk ticket 16, dan sekaligus alasan kenapa
> "sudah ada index" tidak sama dengan "index dipakai".

### 2b. `strftime` di SQL vs hitung batas bucket di aplikasi

**Rekomendasi: `strftime` di SQL. Satu query, index tetap kepakai.**

Kekhawatiran wajarnya adalah membungkus kolom dengan fungsi akan mematikan
index. Di sini tidak, karena `strftime` hanya muncul di `GROUP BY` (untuk
melabeli bucket), sedangkan **penyaringannya tetap perbandingan `BETWEEN`
telanjang di atas kolom mentah**. Plan-nya [PROBE]:

```
SEARCH e USING INDEX idx_journal_entries_user_date (user_id=? AND entry_date>? AND entry_date<?)
USE TEMP B-TREE FOR GROUP BY
```

Jadi satu query mengembalikan seluruh seri bulanan sekaligus. Pola N-query
(satu per bucket) tidak ada untungnya dan malah memakan kuota query per
invocation (bagian 3). `USE TEMP B-TREE FOR GROUP BY` bukan masalah pada
kardinalitas laporan pribadi (belasan bucket).

Aturan yang harus dipegang: **jangan pernah menulis
`WHERE strftime('%Y-%m', entry_date) = ?`** — itu membungkus kolom dalam
predikat dan akan memaksa scan. Filter selalu dengan rentang mentah;
`strftime` hanya untuk `GROUP BY` / label.

Batas rentang tetap dihitung di aplikasi dari `users.timezone`, persis seperti
premis ticket. Catatan kecil dari probe: `BETWEEN '2026-07-01' AND '2026-07-31'`
dan half-open `>= '2026-07-01' AND < '2026-08-01'` memberi hasil identik pada
data ini [PROBE] — **tapi hanya karena `entry_date` dijamin tepat 10 karakter**.
Kalau suatu saat ada nilai dengan komponen waktu, `'2026-07-31' < '2026-07-31T23:59'`
bernilai true [PROBE], dan batas inklusif akan diam-diam membuang baris terakhir.
Half-open lebih tahan banting; pilih itu sebagai konvensi.

### 2c. Asimetri `entry_date` vs `created_at`

**Firasat di ticket benar, dan ada ongkosnya.** Plan perbandingan [PROBE]:

```
ORDER BY entry_date DESC LIMIT 5  ->  SEARCH e USING INDEX idx_journal_entries_user_date (user_id=?)
                                      (tidak ada langkah sort — urutan gratis dari index)

ORDER BY created_at DESC LIMIT 5  ->  SEARCH e USING INDEX idx_journal_entries_user_date (user_id=?)
                                      USE TEMP B-TREE FOR ORDER BY
```

"Transaksi terakhir" yang diurutkan pakai `created_at` memaksa temp B-tree sort
atas **seluruh** baris milik user itu, bahkan dengan `LIMIT 5`. Untuk satu user
personal-finance ini murah dan sepenuhnya bisa diterima sekarang. Yang perlu
dicatat untuk ticket 16 adalah pilihan semantiknya, bukan performanya:

- `entry_date` = tanggal akuntansi yang dinyatakan user (bisa mundur ke masa lalu).
- `created_at` = kapan barisnya benar-benar tercatat (epoch millis, monotonic).

Untuk "yang barusan saya catat", `created_at` yang benar. Karena PK-nya UUIDv7
(`ADR-0002`, terlihat di `writer.ts` lewat `uuidv7()`), `ORDER BY id DESC` juga
setara secara kronologis dan gratis dari primary key — opsi ketiga kalau sort
itu pernah jadi masalah. Belum perlu index baru sekarang.

---

## 3. Batas yang mengikat

Semua dari `/d1/platform/limits/`
([DOC], https://developers.cloudflare.com/d1/platform/limits/):

| Batas | Nilai |
|---|---|
| Maximum query duration | **30 detik** |
| Queries per Worker invocation | **1.000 (Paid) / 50 (Free)** |
| Maximum bound parameters per query | **100** |
| Maximum SQL statement length | **100.000 byte (100 KB)** |
| Maximum SQL function arguments | 32 |
| Maximum row size | 2.000.000 byte (2 MB) |
| Maximum columns per table | 100 |
| Maximum rows per table | Unlimited (dibatasi storage) |
| Maximum database size | 10 GB (Paid) / 500 MB (Free) |
| Time Travel | 30 hari (Paid) / 7 hari (Free) |

Catatan yang relevan langsung ke reporting:

- **Tidak ada batas ukuran hasil query yang didokumentasikan.** Halaman limits
  tidak menyebutkan batas byte untuk response/result set sama sekali — satu-satunya
  batas ukuran adalah row size (2 MB) dan panjang statement (100 KB) [DOC].
  Ini bukan izin untuk menarik baris tanpa batas; ini artinya **tidak ada angka
  resmi untuk disandari**, jadi reporting harus tetap mengagregasi di SQL dan
  mengembalikan puluhan baris, bukan ribuan. Jangan catat batas hasil sebagai
  fakta yang diketahui — yang diketahui justru ketiadaannya.
- **Batas 30 detik berlaku untuk seluruh panggilan batch**, bukan per statement:
  "Requests to Cloudflare API must resolve in 30 seconds. Therefore, this
  duration limit also applies to the entire batch call" [DOC].
- **Batas per-statement berlaku ke tiap statement di dalam batch**: "Limits for
  individual queries (listed above) apply to each individual statement contained
  within a batch statement" [DOC]. Jadi batch 5 statement memakan 5 dari kuota
  1.000.
- **Tidak ada batas jumlah statement per batch yang didokumentasikan** [DOC].
  Perlu diluruskan: file skill ter-vendor di repo
  `.claude/skills/cloudflare/references/d1/gotchas.md` mengklaim batch cap
  1.000/10.000 statement dan row size 1 MB — **dua-duanya tidak ada di halaman
  limits resmi, dan angka row size-nya bertentangan (resmi: 2 MB)**. Skill itu
  sendiri memerintahkan "when a reference file and the docs disagree, trust the
  docs". Jadi pakai tabel di atas, bukan gotchas.md.
- Enam koneksi D1 konkuren per Worker invocation; tiap database memproses query
  secara sekuensial [DOC].

**Penilaian:** laporan bulanan satu user tidak akan mendekati satu pun batas ini.
Ukuran seed realistis (3.192 entries / 6.384 lines untuk 19 bulan × 2 user)
menghasilkan query breakdown dengan `duration` sub-milidetik [PROBE]. Batas yang
paling mungkin tergigit lebih dulu bukan ukuran data, melainkan **50 query per
invocation di free tier** kalau reporting memakai pola N-query per bucket —
alasan tambahan untuk agregasi satu query di bagian 2b.

---

## 4. Query bertahap & `batch()`

**`batch()` cocok, tapi bukan karena alasan konsistensi yang mungkin diasumsikan.**

Yang dijamin dokumentasi [DOC],
https://developers.cloudflare.com/d1/worker-api/d1-database/:

- "Batched statements are SQL transactions. If a statement in the sequence
  fails, then an error is returned for that specific statement, and it aborts or
  rolls back the entire sequence."
- "D1 operates in auto-commit. Our implementation guarantees that each statement
  in the list will execute and commit, sequentially, non-concurrently."

Jadi batch memberi **atomisitas dan eksekusi sekuensial dalam satu round-trip**
— itulah yang sudah dipakai `src/worker/ledger/writer.ts` untuk menulis entry +
lines secara atomik, dan pemakaian itu tepat.

Untuk **membaca**, keuntungan sebenarnya adalah menghemat latensi round-trip,
bukan jaminan snapshot. Dokumentasi menyebut batching "reduces latency from
network round trips to D1" [DOC]. Yang **tidak** dinyatakan dokumentasi di mana
pun: snapshot isolation, tingkat isolasi baca, atau apakah write bersamaan bisa
menyelip di antara statement dalam satu batch. Karena statement di-commit satu
per satu ("execute and commit, sequentially"), **jangan berasumsi total dan
breakdown dalam satu batch pasti melihat snapshot database yang identik.**

Konsekuensi praktis untuk ticket 16, berurut preferensi:

1. **Paling baik: hindari masalahnya.** Total + breakdown kategori bisa dijawab
   satu query lewat `UNION ALL` atau conditional aggregation — dua-duanya sudah
   diverifikasi jalan [PROBE]. Satu statement = satu titik konsistensi, tidak
   ada pertanyaan isolasi sama sekali, dan hanya memakan 1 kuota query.
2. **Kalau tetap butuh beberapa query**, `batch()` tetap pilihan yang benar demi
   latensi dan atomisitas. Risiko ketidakkonsistenannya sangat kecil di Struku:
   satu user, penulisan hanya lewat alur commit-nya sendiri, dan laporan
   membaca rentang tanggal masa lalu yang praktis tidak berubah saat dibaca.
3. **Sessions API (`withSession()`)** menyediakan sequential consistency dan
   diperlukan kalau read replication dipakai — tanpa Sessions API semua query
   dilayani database primary [DOC]. **Belum dibutuhkan sekarang**; catat sebagai
   jalur kalau replica diaktifkan nanti.

Transaksi interaktif bukan opsi: `BEGIN`/`COMMIT`/`SAVEPOINT` eksplisit ditolak
engine [PROBE]. `batch()` adalah satu-satunya primitif transaksi yang tersedia.

---

## Apa artinya untuk ticket 16 dan 18

### Untuk [16 · Permukaan reporting & query](../issues/16-reporting-query-surface.md)

Tidak ada blocker teknis. D1 sanggup melakukan seluruh reporting di sisi SQL.
Yang harus dibawa ke desain:

1. **Tambahkan `PRAGMA optimize`.** Ini temuan paling actionable di sini. Tanpa
   statistik tabel, planner mengabaikan `idx_journal_entries_user_date` dan
   men-drive query dari tabel yang salah. Perlu diputuskan di mana ia dijalankan
   (migrasi baru, atau langkah rutin setelah deploy) — keputusan itu milik
   ticket 16, tapi kebutuhannya sudah pasti.
2. **Satu query agregat, bukan N query per bucket.** `strftime` untuk `GROUP BY`,
   `BETWEEN`/half-open mentah untuk `WHERE`. Jangan pernah membungkus
   `entry_date` di dalam predikat `WHERE`.
3. **Pakai batas half-open** (`>= awal AND < awal_bulan_berikutnya`) sebagai
   konvensi rentang, lebih tahan banting daripada `BETWEEN` inklusif.
4. **Urutkan "transaksi terakhir" dengan `created_at`** (atau `id`, karena
   UUIDv7), bukan `entry_date` — pilihan semantik, dan ongkos sort-nya bisa
   diabaikan pada skala ini.
5. **Hati-hati akun `cash` mencemari breakdown.** Probe menunjukkan filter naif
   `direction='debit'` memunculkan `cash` di samping kategori belanja, karena
   entry pemasukan men-debit `cash` [PROBE]. Breakdown harus disaring lewat
   `accounts.type` (`'expense'` / `'income'`), bukan lewat `direction` saja.
   Ini jebakan double-entry yang gampang lolos review.
6. **Saring `status`.** `journal_entries.status` punya `'posted'|'reversed'|'reversal'`;
   laporan hampir pasti hanya mau `'posted'`, kalau tidak entri pembalik akan
   dihitung dobel.
7. **Sisa verifikasi:** jalankan ulang `EXPLAIN QUERY PLAN` di D1 **remote**
   sebelum mengunci bentuk query (lihat peringatan di awal dokumen).

### Untuk [18 · Revisit keputusan no-ORM](../issues/18-revisit-no-orm.md)

Ticket ini sengaja tidak mengambil keputusan itu. Fakta yang relevan:

- Reporting **tidak** memerlukan fitur yang cuma bisa didapat lewat ORM. Bentuk
  query yang dibutuhkan — agregat, CTE, window function, conditional aggregation
  — semuanya SQL biasa yang sudah terbukti jalan di D1, dan justru bagian yang
  paling sensitif (rentang tanggal yang tetap sargable, `strftime` yang hanya di
  `GROUP BY`, penyaringan lewat `accounts.type`) adalah hal yang paling mudah
  dikaburkan oleh query builder.
- Argumen tandingannya: query reporting jauh lebih besar dari SQL yang ada
  sekarang di `src/worker/ledger/` (`writer.ts` hanya INSERT sederhana), jadi
  biaya perawatan SQL tulisan tangan memang naik nyata.
- Batas D1 yang perlu diingat kalau ORM dipertimbangkan: **maksimum 100 bound
  parameter per query** dan **statement 100 KB** [DOC] — query builder yang
  meng-generate `IN (...)` panjang bisa menabrak batas itu.
- `PRAGMA optimize` tetap dibutuhkan terlepas dari ORM atau bukan; itu urusan
  operasional skema, bukan urusan layer akses data.

Kesimpulannya: kapabilitas D1 **tidak memaksa** keputusan ke arah mana pun.
Ticket 18 bisa diputuskan atas dasar ergonomi dan perawatan, bukan atas dasar
keterbatasan database — dan itulah gunanya ticket ini.

---

## Sumber

- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/d1/worker-api/d1-database/
- https://developers.cloudflare.com/d1/worker-api/prepared-statements/
- https://developers.cloudflare.com/d1/sql-api/sql-statements/
- https://developers.cloudflare.com/d1/best-practices/use-indexes/
- https://developers.cloudflare.com/d1/best-practices/query-d1/
- Probe lokal: `wrangler 4.116.0`, `wrangler d1 execute struku-ledger --local`,
  skema dari `migrations/0001_ledger_core.sql` + `0002_users_timezone.sql`

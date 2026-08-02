# 22 — Simpan teks asli transaksi ke `description`

Type: grilling
Status: resolved
Blocked by: —

## Question

Kolom `journal_entries.description` **ada di skema sejak migrasi pertama**
([`0001_ledger_core.sql:66`](../../../migrations/0001_ledger_core.sql)) tapi
`INSERT` di [`writer.ts:84-87`](../../../src/worker/ledger/writer.ts) tidak
pernah menulisnya — hanya 6 kolom, `description` bukan salah satunya:

```sql
INSERT INTO journal_entries (id, user_id, entry_date, source, currency, created_at)
VALUES (?, ?, ?, 'text', ?, ?)
```

Akibatnya teks asli user (*"warteg 25rb"*) **hilang permanen** begitu draft
di-commit. Yang tersimpan hanya tanggal, jumlah, akun, arah. Kemungkinan besar
ini **kelalaian tracer #1**, bukan keputusan desain — ADR-0002 memesan kolomnya.

Ditemukan saat me-resolve
[17 · Koreksi transaksi setelah commit](17-post-commit-correction.md); dipisah
jadi tiket sendiri karena tidak bergantung pada koreksi maupun reporting.

**Kenapa ini mendesak meski kecil:** ini satu-satunya butir di sekitar tiket 17
yang **datanya hilang kalau ditunda**. Tiap transaksi yang dicatat mulai
sekarang tanpa `description` adalah teks asli yang tidak bisa direkonstruksi
nanti. Menunggu berarti melubangi ledger secara permanen.

Yang harus diputuskan:

1. **Apa persisnya yang disimpan?** Teks mentah user apa adanya (*"warteg 25rb"*),
   atau keterangan hasil normalisasi parser (*"Warteg"* — seperti di baris
   "Keterangan:" pada flow konfirmasi yang digambar pemilik repo di
   [17](17-post-commit-correction.md))? Keduanya berbeda: yang pertama merekam
   apa yang terjadi, yang kedua lebih enak dibaca di laporan. Bisa juga keduanya
   — tapi itu berarti kolom kedua, dan skema hanya memesan satu.
2. **Apakah user boleh mengubahnya?** Flow edit draft yang ada sekarang
   menawarkan jumlah/kategori/tanggal/jenis — tidak ada keterangan. Kalau
   keterangan ikut ditampilkan di konfirmasi (dan
   [23](23-draft-confirmation-surface.md) memang mengarah ke sana), wajar kalau
   user ingin membetulkannya.
3. **Bagaimana dengan entry yang sudah ada?** Ledger produksi sudah punya isi
   (dikosongkan 2026-08-01, lalu dipakai). Backfill mustahil — teks aslinya
   memang tidak pernah disimpan. Konfirmasi bahwa `description` NULL untuk entry
   lama dapat diterima, dan pastikan jalur baca menanganinya.
4. **Apakah ini menyentuh ADR?** ADR-0002 memesan kolomnya tanpa menentukan
   isinya. Mengisinya kemungkinan **bukan** ADR baru — tapi kalau butir 1
   memilih menyimpan teks mentah user, itu keputusan privasi kecil yang layak
   dicatat (teks bebas tersimpan permanen di ledger).

## Konteks yang sudah pasti

- **Pemilik repo sudah memilih menyimpan teks aslinya** saat grilling
  [17](17-post-commit-correction.md), dengan konsekuensi yang disebut eksplisit:
  ledger menyimpan teks mentah apa adanya, termasuk typo dan catatan pribadi.
  Yang tersisa di tiket ini adalah **bentuknya**, bukan **apakah**.
- **Manfaat langsung ke [16](16-reporting-query-surface.md):** laporan yang hanya
  bisa menampilkan *"belanja 25rb"* nyaris tak terbaca seminggu kemudian;
  *"warteg 25rb"* langsung berarti. Ini alasan kedua kenapa tiket ini sebaiknya
  mendahului 16, bukan mengekor.
- **Manfaat ke tiket koreksi nanti:** tanpa `description`, kata "kopi" di
  *"yang kopi tadi salah"* tidak ada di kolom mana pun — menunjuk transaksi
  secara natural mustahil. Tiket ini prasyarat diam-diam untuk itu.

## Catatan

Kecil dan nyaris pasti bisa langsung `/implement` setelah butir 1 dan 2
diputuskan. Kalau grilling-nya ternyata sesingkat dugaan, pertimbangkan
menggabungkannya ke sesi yang sama dengan [23](23-draft-confirmation-surface.md)
— keduanya menyentuh permukaan yang sama (apa yang user lihat saat konfirmasi).

## Answer

**`description` = label tampilan yang default-nya teks mentah user.** Bukan
arsip. Istilah ini dipilih sengaja supaya "teks mentah" tidak salah dibaca
sebagai janji immutability.

### Butir 1 — apa yang disimpan: **teks mentah apa adanya**

Pemilik repo ditanya membayangkan laporan tiket
[16](16-reporting-query-surface.md) berisi baris teks mentah verbatim
(*"warteg 25rb"*, *"gojek ke kantor 15k"*); jawabannya "enak, as intended".
Yang ingin dilihat adalah apa yang diketik, bukan versi rapian mesin.

Opsi "keterangan hasil normalisasi parser" **gugur**, dan itu keputusan yang
murah — lihat temuan kode di bawah: opsi itu belum ada barangnya sama sekali.

### Butir 2 — boleh diedit: **ya, di dua tempat**

1. **Saat konfirmasi draft** — "keterangan" masuk ke daftar hal yang bisa
   diedit (sekarang hanya jumlah/kategori/tanggal/jenis). Ini pekerjaan
   [23](23-draft-confirmation-surface.md), murah: draft masih di tangan,
   tidak ada yang perlu "ditunjuk".
2. **Saat membaca laporan** — setelah entry ter-commit. Ini **tidak bisa
   dikerjakan sekarang**: butuh cara menunjuk entry lama
   ([17](17-post-commit-correction.md), ditunda) dan butuh laporan yang
   menampilkan transaksi ([16](16-reporting-query-surface.md), blocked by
   14, 20). Bukan blocker untuk 22 — jadi **alasan tambahan untuk membuka
   17 lagi nanti**.

**Konsekuensi yang diterima eksplisit:** saat diedit, teks asli **ditimpa**.
Tidak ada kolom kedua, tidak ada migrasi tambahan. Alasannya: ini ledger
pribadi harian, bukan sistem audit — satu penulis, satu pembaca. Menyimpan
"apa yang diketik sebelum dirapikan" nilainya mendekati nol, sementara
ongkosnya migrasi + satu konsep permanen yang harus terus diingat.

Efek samping yang diterima: alasan awal menyimpan `description` (agar kata
*"kopi"* di *"yang kopi tadi salah"* ada di kolom yang bisa dicari) **melemah
setelah baris diedit**. Diterima, karena edit justru membuat teksnya lebih
mudah ditunjuk, bukan lebih sulit.

**Input pendek nol-informasi** (*"25rb"*, *"350"* — parser menerimanya karena
`category` diisi AI, bukan oleh teks) **tidak dicegah di depan.** Tidak ada
validasi/nag saat konfirmasi. Perbaikannya lewat jalur edit di atas.

### Butir 3 — entry lama: **NULL, diterima**

Backfill mustahil — teks aslinya memang tidak pernah disimpan. Jalur baca
wajib menangani `description IS NULL` (relevan begitu 16 mendarat).

### Butir 4 — ADR: **tidak ada ADR baru**

ADR-0002 sudah memesan kolomnya; mengisinya bukan keputusan arsitektural
baru. ADR-0005 **tidak tersentuh** justru karena butir 1 memilih teks mentah.
Keputusan privasi (teks bebas tersimpan permanen, termasuk typo dan catatan
pribadi) tercatat di sini dan sudah disebut eksplisit saat grilling
[17](17-post-commit-correction.md) — cukup, tidak perlu ADR sendiri.

## Temuan kode (dibaca saat grilling, mengoreksi asumsi tiket)

Tiket ini ditulis sebelum kodenya dibaca; dua asumsinya keliru.

1. **Opsi "normalisasi parser" di butir 1 tidak ada hari ini.** `ParseResult`
   ([`parsing/types.ts:19-27`](../../../src/worker/parsing/types.ts)) **tidak
   punya field deskripsi/merchant sama sekali** — hanya `intent`, `txn_type`,
   `amount`, `currency`, `category`, `date`, `clarification`. Baris
   *"Keterangan: Warteg"* pada flow tiket 23 **tidak diproduksi oleh apa pun**.
   Mendapatkannya berarti revisi ADR-0005 + ubah prompt + ubah schema parser.
2. **Teks mentah sudah di tangan saat draft dibuat, lalu dibuang.**
   `startDraft()` ([`coordinator.ts:134-161`](../../../src/worker/coordinator.ts))
   menerima `rawText`, memakainya **hanya** untuk `detectAssetAccountSlug()`
   (baris 144), lalu membuangnya. `PendingDraft`
   ([`draft/types.ts:6-16`](../../../src/worker/draft/types.ts)) tidak
   membawanya, sehingga saat `confirmDraft()` (baris 163) teksnya sudah hilang.
   **Implikasi implementasi: ini bukan sekadar menambah kolom ke `INSERT`** —
   `PendingDraft` harus membawa teks itu sampai commit.
3. **Kedua opsi butir 1 tidak setara ongkosnya.** Teks mentah = perubahan
   lokal, nol dampak ADR. Normalisasi = revisi ADR-0005 + prompt + schema.
   Tiket menyajikannya seolah setara.

**Terverifikasi sesuai tiket** (tidak perlu koreksi): `journal_entries.description
TEXT` ada dan nullable ([`0001_ledger_core.sql:66`](../../../migrations/0001_ledger_core.sql));
`INSERT` di [`writer.ts:85-86`](../../../src/worker/ledger/writer.ts) hanya
menulis 6 kolom; grep repo-wide memastikan **tidak ada apa pun di `src/` yang
pernah menulis `description`**.

## Jalan ke implementasi

Ruang lingkup yang boleh dikerjakan sekarang:

1. `PendingDraft` membawa `rawText` (`draft/types.ts` + `saveDraft`/`loadDraft`).
2. `startDraft()` menyimpannya alih-alih membuangnya.
3. `confirmDraft()` meneruskannya ke `commitTransaction()`.
4. `INSERT` di `writer.ts` menulis kolom `description`.

Di luar ruang lingkup 22: menampilkan & mengedit keterangan saat konfirmasi
(→ [23](23-draft-confirmation-surface.md)), mengedit setelah commit
(→ [17](17-post-commit-correction.md), masih ditunda).

Catatan uji: jalur ini **tidak menyentuh `env.AI`**, jadi suite lokal cukup
representatif — tapi ini jalur tulis harian yang hidup, jadi deploy sungguhan
tetap sepadan sebelum dianggap beres.

## Status implementasi (2026-08-01)

**Terbangun & ter-deploy**, `434a343` → versi `eff3e738`. Empat langkah di atas
terpasang semua; 71/71 test lokal hijau, `tsc` bersih. Code review dua sumbu
menemukan satu defect nyata (`.trim()` di writer melanggar jaminan verbatim
butir 1) — sudah dibetulkan, plus test regresi (`"  wartegg  25rb  "`).

⚠️ **Verifikasi produksi belum dilakukan — di-skip atas permintaan pemilik repo,
bukan karena sudah beres.** Yang belum terbukti di workerd:

- **Shim `ALTER TABLE` di `ensureDraftTable`** — inilah yang paling perlu dilihat.
  Jalur `PRAGMA table_info` + `ALTER` **hanya** berjalan pada Coordinator yang
  tabelnya mendahului `raw_text`. DO di test selalu segar, jadi jalur ini
  **tidak pernah tersentuh suite lokal**; miniflare ≠ workerd (guardrail map).
  Sudah diuji lawan skema pre-22 di `node:sqlite` (kolom bertambah, baris lama
  `NULL`, panggilan kedua tidak throw) — tapi itu bukan workerd.
- **Satu transaksi asli** lewat `@StrukuBot` → `description` terisi verbatim.

Baseline produksi saat deploy: **2 entry, keduanya `description` NULL** (entry
pra-22, sesuai butir 3). Entry berikutnya yang muncul adalah bukti pertama.

Cara memverifikasi nanti: `npx wrangler tail` di satu terminal, kirim
`warteg 25rb` ke bot lalu konfirmasi, kemudian
`npx wrangler d1 execute struku-ledger --remote --json --command "SELECT description FROM journal_entries ORDER BY created_at DESC LIMIT 1"`.

**TODO(remove after 2026-08-08)** di `store.ts` bergantung pada verifikasi ini —
jangan cabut shim-nya sebelum terbukti jalan di produksi.

**Percobaan verifikasi 2026-08-01 (deploy `7436f2b5`) — GAGAL DILAKUKAN, bukan
gagal.** D1 dikosongkan dan migrasi dijalankan ulang; onboarding berhasil (1 user,
16 akun). Draft **terbentuk dengan benar** (`"rokok malboro 55k"` →
`Pengeluaran Rp 55.000`, `env.AI` terbukti sehat), tapi **tidak ada satu pun
transaksi yang ter-commit**: pemilik repo menekan Edit lalu terjebak di mode edit
tanpa jalan keluar → [24](24-edit-mode-escape.md). Jadi `description` terisi
verbatim dan shim `ALTER TABLE` **masih belum terbukti di workerd**. Ulangi
verifikasi setelah 24 selesai.

🧊 **Terkena deployment freeze (map, 2026-08-01):** verifikasi ini **tidak
dijadwalkan ulang sampai map selesai**. Utangnya tetap terbuka — jangan anggap
lunas. **TODO(remove after 2026-08-08)** di `store.ts` juga **jangan dicabut**:
tanggalnya akan lewat sebelum deploy terakhir, tapi shim-nya baru boleh dibuang
setelah terbukti setiap Coordinator hidup punya kolom `raw_text`.

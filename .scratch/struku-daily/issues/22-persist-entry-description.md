# 22 — Simpan teks asli transaksi ke `description`

Type: grilling
Status: open
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

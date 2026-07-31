# 16 — Permukaan reporting & query: apa yang bisa ditanyakan, dan seperti apa jawabannya

Type: prototype
Status: open
Blocked by: 14

## Question

Permintaan pemilik repo: *"bot belum bisa melaporkan total pengeluaran
(harian/mingguan/bulanan/custom range)."* Dan saat ditanya apa yang dia mau dari
"lihat isi ledger", jawabannya **empat-empatnya**: transaksi terakhir, ringkasan
per periode, cari transaksi tertentu, dan benerin yang sudah masuk (yang terakhir
ditangani [17](17-post-commit-correction.md), bukan di sini).

Jadi ini bukan satu laporan — ini permukaan baca. Yang harus diputuskan:

1. **Bentuk jawabannya seperti apa di chat?** Pemilik repo belum tahu dan ingin
   melihat dulu. **Itu sebabnya ini tiket prototype:** bikin beberapa contoh
   balasan yang konkret dan kasar — teks ringkas per kategori, teks dengan
   perbandingan periode sebelumnya, dan satu bentuk yang lebih kaya — lalu
   minta dia bereaksi. Jangan bertanya "kamu mau bentuk apa" secara abstrak
   untuk kedua kalinya; tunjukkan.
   Ingat NFR-USE-02: user melihat "Pengeluaran/Pemasukan", nama kategori, dan
   jumlah — **tidak pernah** "debit"/"credit"/"journal entry".
2. **Bagaimana rentang waktu dinyatakan?** "hari ini", "minggu ini", "bulan lalu",
   "3 hari terakhir", "1–15 Agustus". Apakah rentang diekstrak oleh model
   (perluasan kontrak ADR-0005 — lihat interaksi dengan
   [15](15-conversational-surface.md)), atau dikenali deterministik dengan
   pencocokan kata kunci di aplikasi seperti
   [`payment-method.ts`](../../../src/worker/ledger/payment-method.ts) yang
   sengaja **tidak** dijadikan field AI supaya kontrak ADR-0005 tetap tertutup?
   Preseden itu ada dan disengaja — timbang, jangan abaikan.
3. **Batas "minggu" dan "bulan" milik siapa?** Bucketing harus sadar timezone;
   `users.timezone` sudah ada. Minggu mulai Senin atau Minggu? Ini keputusan
   produk, bukan teknis, dan menentukan bentuk query dari [14](14-d1-aggregate-query-capability.md).
4. **Apakah `query` cukup sebagai satu intent?** "transaksi terakhir" dan "total
   bulan ini" bentuknya berbeda jauh. Satu intent dengan parameter, atau pecah?
5. **Apakah chat cukup?** Kalau prototype menunjukkan jawaban yang berguna tidak
   muat di satu pesan chat, itu temuan penting — tapi hati-hati: detail web view
   ada di **Out of scope** map ini. Menyimpulkan chat tidak cukup berarti
   menggambar ulang destination, dan itu keputusan pemilik repo, bukan keputusan
   tiket ini.

**Sudah ada pintu masuknya.** `intent: query` sudah diklasifikasi ADR-0005 dan
sudah dirouting; handler-nya stub "Fitur ini belum tersedia"
([`reply.ts:62`](../../../src/worker/parsing/reply.ts)). Jadi yang dibangun
adalah isi handler yang pintunya sudah terpasang.

**Data untuk prototype sudah nyata** — `journal_entries`/`journal_lines` terisi
dan balanced. Tapi perhatikan: DB dikosongkan 2026-08-01 sebelum chat nyata
pertama, jadi volumenya kecil. Kalau prototype butuh data yang lebih tebal,
menyemai transaksi sintetis lebih jujur daripada berpura-pura punya riwayat
setahun.

Tautkan prototype-nya sebagai aset dari tiket ini; jangan tempel kodenya di sini.

## Wajib dibaca sebelum mulai — hasil riset [14](14-d1-aggregate-query-capability.md)

Riset D1 sudah selesai dan **menghapus seluruh ketidakpastian teknis**: D1 sanggup
melakukan semua agregasi yang dibutuhkan dan tidak ada limit yang mengikat. Jadi
tiket ini murni soal **bentuk dan produk**, bukan soal "apakah bisa".

Tiga jebakan yang sudah terbukti — masukkan ke desain, jangan ditemukan ulang:

1. **`PRAGMA optimize` tidak ada di migrasi mana pun.** Tanpanya planner
   *mengabaikan* `idx_journal_entries_user_date` dan men-drive query dari
   `journal_lines` — rentang tanggal tidak menyaring sama sekali. **Keputusan
   milik tiket ini:** dijalankan lewat migrasi baru, atau langkah rutin
   pasca-deploy?
2. **Jangan menyaring breakdown dengan `direction='debit'`** — entry pemasukan
   men-debit `cash`, jadi `cash` bocor ke daftar kategori belanja. Saring lewat
   `accounts.type`.
3. **Selalu saring `status`** (`'posted'|'reversed'|'reversal'`) atau entry
   pembalik terhitung ganda. Ini mengikat ke
   [17](17-post-commit-correction.md): begitu koreksi dibangun, reversal jadi
   nyata dan laporan yang tidak menyaring `status` akan salah.

Panduan bentuk query yang sudah tervalidasi: `strftime` untuk melabeli `GROUP BY`
tapi **`WHERE` harus menyaring kolom `entry_date` mentah** (kalau dibungkus
fungsi, index-nya mati); pakai batas half-open; urutkan "transaksi terakhir"
dengan `created_at`/`id` (UUIDv7), bukan `entry_date`.

⚠️ **Query plan di riset itu baru diverifikasi lokal** — akses D1 remote diblokir
permission classifier. Ingat `miniflare-vs-workerd-gap`: konfirmasi ulang dengan
`--remote` **sebelum** mengunci bentuk query.

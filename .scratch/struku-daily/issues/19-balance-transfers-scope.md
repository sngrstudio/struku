# 19 — Saldo & transfer antar-rekening: masuk destination atau tidak

Type: grilling
Status: open
Blocked by: 16

## Question

Saat ditanya seberapa penting akurasi saldo, pemilik repo menjawab **belum
kepikiran** — jadi ini justru keputusan yang harus dipetakan, bukan diasumsikan.
Tiket ini menentukan apakah saldo masuk destination "layak dipakai harian", dan
kalau ya, sedalam apa.

Yang harus diputuskan:

1. **Apakah "saldo gue berapa" itu pertanyaan yang akan dia tanyakan?** Kalau
   yang dia pedulikan hanya *berapa yang keluar per periode*, seluruh tiket ini
   gugur dan jadi **Out of scope** — itu hasil yang sah dan menghemat banyak
   pekerjaan. Tanyakan langsung, jangan simpulkan.
2. **Kalau ya, saldo butuh tiga hal yang belum ada:**
   - **Saldo awal.** Akun `opening_balance` (equity) sudah ada di bagan akun,
     tapi tidak pernah dipakai — tidak ada jalur bagi user untuk menyatakan
     "rekening gue isinya 5 juta". Tanpa ini, saldo yang ditampilkan salah, dan
     saldo yang salah lebih buruk daripada tidak ada saldo.
   - **Transfer antar-rekening (aset→aset).** Bentuk transaksi ketiga di luar
     income/expense. ADR-0005 sengaja menyerahkannya ke tiket masa depan; ini
     tiket itu. Menyentuh kontrak parsing — dua akun aset diselesaikan lewat
     slug, bukan satu kategori. Fog ini digraduasikan dari
     [map v1](../../struku-v1/map.md).
   - **Kartu kredit & utang pribadi.** Slug `credit_card` dan `personal_debt`
     ada di bagan akun tapi tidak pernah tersentuh tracer #1. Saldo yang benar
     untuk liabilitas berperilaku berbeda dari aset (arahnya terbalik).
3. **Bisakah dipecah?** Saldo awal + saldo baca saja, tanpa transfer, mungkin
   sudah memberi sebagian besar nilainya dengan pekerjaan jauh lebih sedikit.
   Kalau iya, pecah jadi tiket-tiket terpisah alih-alih satu bongkahan.

**Diblokir oleh [16](16-reporting-query-surface.md)** karena begitu permukaan
baca ada, akan jauh lebih jelas apakah saldo terasa hilang atau tidak — dan
karena keduanya berbagi bentuk pertanyaan yang sama ("tanya, dijawab angka").
Kalau [16](16-reporting-query-surface.md) ternyata sudah cukup memuaskan, tiket
ini bisa langsung ditutup sebagai out of scope.

**Kalau jawabannya "tidak masuk destination"** — jangan resolve di jalur; **tutup
tiketnya** dan tulis satu baris di bagian **Out of scope** map, sesuai aturan
wayfinder soal batas scope. Batas scope bukan langkah pada rute.

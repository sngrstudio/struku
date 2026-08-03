# 21 — Seberapa luas dokumen skill yang divendor salah angka

Type: research
Status: claimed
Blocked by: —

## Question

Riset [14 · Kapabilitas query agregat D1](14-d1-aggregate-query-capability.md)
menemukan `.claude/skills/cloudflare/references/d1/gotchas.md` menyebut angka
limit yang **bertentangan dengan halaman limits resmi**. Klaimnya masih berdiri
per 2026-08-01, di [`gotchas.md:50-52`](../../../.claude/skills/cloudflare/references/d1/gotchas.md):

| Klaim di `gotchas.md` | Kata halaman limits resmi |
|---|---|
| Row size **1 MB** (free & paid) | **2 MB** |
| Batch size **1.000** statement (free) / **10.000** (paid) | Tidak disebut sama sekali |
| Concurrent requests 10.000/min (free) | Tidak disebut sama sekali |

Dua pola berbeda, dan yang kedua lebih licin dari yang pertama: satu angka yang
**salah**, plus angka yang **dikarang lengkap dengan pembedaan free/paid tier**
yang tidak ada di dokumentasi. Yang kedua lebih berbahaya karena terlihat lebih
otoritatif — tabel bertier terbaca seperti hasil membaca dokumen resmi.

Aturan AGENTS.md ("ambil dokumentasi terkini, jangan andalkan ingatan model")
menyelamatkan riset 14 secara **kebetulan** — riset itu memang mengambil halaman
resmi, jadi ketidakcocokannya ketahuan. Itu bukan jaminan; itu keberuntungan
prosedural. Yang belum diketahui: apakah `d1/gotchas.md` anomali, atau contoh
dari sesuatu yang menyebar.

Skalanya bikin ini bukan pertanyaan sepele: skill `cloudflare` sendirian berisi
**47.379 baris** markdown di **61 subdirektori** `references/`. Struku
benar-benar menyentuh sebagian kecilnya saja — `d1`, `workers`, `durable-objects`,
`workers-ai`, `bindings`, `wrangler`, `miniflare`.

Yang perlu dijawab:

1. **Seberapa luas?** Ambil sampel angka-angka yang bisa dicek (limit, kuota,
   ukuran, harga) dari subdirektori yang **benar-benar disentuh Struku** —
   bukan seluruh 61. Berapa banyak yang tidak cocok dengan halaman resmi?
2. **Polanya apa?** Angka basi (dulu benar, dokumen bergerak) itu satu hal;
   angka yang dikarang tanpa sumber itu hal lain. Yang pertama membusuk perlahan
   dan bisa ditoleransi; yang kedua tidak pernah benar dan tidak akan membaik.
   Bedakan — konsekuensi kedua pola ini berbeda.
3. **Apakah `d1/gotchas.md` mewakili?** File bernama "gotchas" mungkin memang
   genre yang lebih rawan (rangkuman lisan, angka dari ingatan) dibanding halaman
   referensi API. Kalau begitu, mitigasinya bisa menyasar genre, bukan seluruh
   korpus.
4. **Cukupkah aturan AGENTS.md yang sekarang?** Aturannya sudah menutup risiko
   ini, tapi hanya kalau agent benar-benar patuh — dan kepatuhannya tidak
   diperiksa siapa pun. Kalau ketidakcocokannya ternyata luas, apakah perlu
   sesuatu yang lebih keras (peringatan di AGENTS.md yang menyebut skill vendor
   secara spesifik, atau membuang subdirektori yang tidak dipakai)? **Ini
   pertanyaan keputusan** — kalau jawabannya "ya", graduasikan jadi tiket
   `grilling` tersendiri, jangan diputuskan di sini.

## Batasan

- **Ini riset, bukan perbaikan.** Jangan edit file skill apa pun. Keluarannya
  ukuran + pola, supaya keputusan mitigasinya bisa diambil di atas fakta.
- **Halaman resmi `developers.cloudflare.com` adalah wasitnya**, sesuai AGENTS.md.
  Kalau halaman resmi sendiri ambigu, catat sebagai ambigu — jangan dipaksa jadi
  vonis.
- **Sampel, jangan audit total.** 47k baris tidak perlu dibaca semua; yang
  dicari sinyal seberapa luas, bukan daftar lengkap errata.
- Catat temuan di `.scratch/struku-daily/research/`, ikut pola riset 14.

## Kenapa ini prioritas rendah

Ditulis supaya tidak hilang, **bukan** supaya dikerjakan berikutnya. Tidak
memblokir tiket mana pun dan tidak ada di jalur menuju destination map. Aturan
AGENTS.md sudah menutup risiko praktisnya hari ini. Ambil ini saat butuh
kerjaan AFK — bukan sebagai ganti tiket frontier
([17](17-post-commit-correction.md), [15](15-conversational-surface.md),
[20](20-stats-refresh-trigger.md)), yang semuanya butuh manusia dan semuanya
lebih dekat ke destination.

Asalnya: caveat #2 riset [14](14-d1-aggregate-query-capability.md), yang tetap
berdiri setelah verifikasi `--remote` 2026-08-01 menutup caveat #1.

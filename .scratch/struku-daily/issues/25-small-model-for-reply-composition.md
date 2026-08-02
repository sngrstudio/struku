# 25 — Model kecil mana untuk panggilan-2 (menyusun jawaban)

Type: research
Status: open
Blocked by: —

## Question

[15](15-conversational-surface.md) butir 2 memutuskan panggilan-2 (menyusun
jawaban + ringkasan) memakai **model lebih kecil** daripada
`@cf/meta/llama-3.3-70b-instruct-fp8-fast` yang dipakai panggilan-1. Model
kecilnya **belum dipilih**, dan sengaja **tidak ditebak dari ingatan** — AGENTS.md
melarang mengandalkan pengetahuan lama soal Workers AI, dan katalog model berubah.

Riset ini memilih kandidatnya. Yang harus dijawab:

1. **Model apa saja yang tersedia di Workers AI hari ini** yang cocok untuk
   menyusun kalimat pendek dwibahasa (id/en)? Ambil dari katalog resmi, bukan
   ingatan.
2. **Apakah kandidatnya mendukung `response_format: json_schema`?** Panggilan-2
   harus mengembalikan **dua field flat**: `reply` (string) + `summary` (string).
   Kalau JSON mode tidak didukung, kontraknya harus lain — dan itu mengubah
   keputusan 15 butir 5.
3. **Berapa latency dan biaya neuron-nya** dibanding 70B? Angka pembanding ada di
   ADR-0005 §2: p50 ~1.7s / p95 ~2.4s, ~11 neuron/call. Anggaran gabungan dua
   panggilan harus muat di NFR-PERF-01 (5–10s).
4. **Bagaimana kualitas Bahasa Indonesia-nya?** ADR-0005 mencatat `id` **tidak**
   ada di daftar bahasa resmi Meta untuk Llama, dan itu risiko yang sudah pernah
   diuji lewat spike untuk 70B. Model lebih kecil kemungkinan lebih rapuh di sini
   — dan panggilan-2 adalah **satu-satunya** yang menghasilkan kalimat yang
   dibaca user, jadi kualitas bahasanya langsung terlihat.
5. **`max_tokens` berapa yang aman?** ADR-0005 §2 mencatat default 256 memotong
   output pada 70B.

## Kenapa ini research, bukan keputusan

Semua di atas adalah **fakta eksternal** yang bisa diambil dari dokumentasi
Cloudflare — bukan selera pemilik repo. Setelah faktanya terkumpul, pemilihan
finalnya mungkin sepele (satu kandidat jelas menang) atau butuh grilling singkat
kalau ada trade-off nyata antara latency dan kualitas Bahasa Indonesia.

## Cara memverifikasi

`npm run test:live` **tidak ikut deployment freeze** — ia memanggil model
sungguhan tanpa merilis apa pun. Jadi kandidat terpilih **bisa dan harus** diuji
sungguhan sebelum implementasi: tulis file sementara di `test/live/`, jalankan
`npx vitest run --config vitest.live.config.ts`, lalu hapus filenya. `console.log`
ditelan reporter — paksa nilainya keluar lewat assertion yang sengaja gagal.

Ini penting karena ini **satu-satunya bagian** dari keputusan 15 yang bisa
dibuktikan sebelum freeze dicabut. Sekalian buktikan bahwa output dua field flat
(`reply` + `summary`) **tidak memicu spiral whitespace** seperti skema bersarang
di spike ADR-0005 §1.

## Catatan

- **Tidak memblokir apa pun untuk saat ini**, tapi memblokir implementasi 15.
- Kalau ternyata **tidak ada** model kecil yang layak, itu temuan yang sah:
  15 butir 2 kembali ke 70B untuk kedua panggilan, dan cadangan "kirim dua tahap"
  jadi lebih penting.

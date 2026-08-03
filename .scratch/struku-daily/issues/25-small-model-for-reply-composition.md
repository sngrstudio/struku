# 25 — Model kecil mana untuk panggilan-2 (menyusun jawaban)

Type: research
Status: resolved
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

## Answer

Diriset 2026-08-03 lewat subagent, lalu diverifikasi ulang sesi induk.
→ **[temuan lengkap](../research/25-small-model-for-reply-composition.md)**.

### Jawaban singkatnya: riset ini **tidak bisa memilih pemenang**, dan itu temuannya

Ia mempersempit 81 model jadi **2 kandidat + 1 kontrol + 1 jawaban sah "tidak ada"**,
lalu menyerahkan pilihan finalnya ke probe. Itu bukan riset yang gagal — pertanyaan 3
(latency) dan 4 (kualitas generasi Bahasa Indonesia) **tidak dijawab dokumentasi untuk
model mana pun**, termasuk 70B. ADR-0005 sendiri baru bisa menjawabnya lewat spike.

### Urutan probe (sudah terpasang di `test/live/reply-composer-probe.test.ts`)

| # | Model id | Peran |
|---|---|---|
| 1 | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | baseline, satu-satunya yang `json_schema`-nya **terbukti** di repo ini |
| 2 | `@cf/zai-org/glm-4.7-flash` | **utama** — dialog-tuned, 100+ bahasa, 131.072 ctx, biaya sekelas 8B |
| 3 | `@cf/aisingapore/gemma-sea-lion-v4-27b-it` | **cadangan kualitas** — satu-satunya yang dokumentasinya **menyebut Indonesian dengan nama** |
| 4 | `@cf/meta/llama-3.1-8b-instruct-fast` | **kontrol** — menguji apakah "lebih kecil = lebih cepat" benar sama sekali |

⚠️ **Salin id dari katalog hidup, jangan dari dokumen ini.** Halaman pricing dan halaman
model tidak cocok soal penamaan 8B (`-fp8-fast` vs `-fast`), dan id yang salah **gagal
saat runtime, bukan saat build** — persis kelas bug yang meninggalkan bekas luka di
[`workers-ai-text-parser.ts:94-102`](../../../src/worker/parsing/workers-ai-text-parser.ts).

### ⚠️ Premis 15 butir 2 tidak punya dasar

**Cloudflare tidak mendokumentasikan latency untuk model mana pun** (vonis lolos syarat
≥2 query). Jadi keyakinan *"model lebih kecil = lebih cepat"* — **satu-satunya alasan**
15 butir 2 memilih model kecil — tidak punya dasar dokumentasi maupun pengukuran. Dan
pada platform serverless ia bisa **salah**: latency ditentukan juga oleh ketersediaan
GPU dan antrian **per model**, jadi model kecil yang jarang dipakai bisa lebih lambat
daripada model besar yang "panas".

Kalau probe menunjukkan begitu, keputusan yang jujur adalah **70B untuk kedua
panggilan** — yang tiket ini sudah tulis sebagai kemungkinan sah, dan riset ini
**memperkuat** kemungkinannya alih-alih melemahkannya. Keuntungan yang tidak disebut
tiket: satu model = satu bentuk API, satu normalisasi `.response`, satu permukaan
deprekasi.

### ⚠️ Worst case 9,6s yang tidak dihitung 15 butir 2

ADR-0005 §7 mengizinkan **satu retry per panggilan**. Dua panggilan × retry ≈
**4 × 2,4s ≈ 9,6s dari anggaran 10s NFR-PERF-01** — **tanpa margin**, sebelum D1 +
Telegram. Dengan a-penuh (15 butir 3) tidak ada gerbang deterministik yang memotong
lebih awal.

**Ini harus masuk revisi ADR-0005 sebagai risiko diterima sadar, atau kebijakan retry
panggilan-2 dibedakan dari panggilan-1** — misalnya panggilan-2 tidak retry sama sekali
dan langsung jatuh ke copy statis, jalur mundur yang 15 butir 4 memang sudah memutuskan
tetap dipelihara.

### Pertanyaan 2 (`json_schema`) tidak bisa dijawab dokumentasi

Halaman JSON Mode memuat daftar model yang didukung — tapi
`@cf/meta/llama-3.3-70b-instruct-fp8-fast`, yang **repo ini pakai hari ini dan terbukti
bekerja**, tidak ada di daftar yang berhasil diekstrak. Entah daftarnya tertinggal dari
katalog, entah ringkasan search cuma mengekstrak sebagian — **keduanya melarang** daftar
itu dipakai sebagai otoritas negatif.

**15 butir 5 tidak batal.** Yang berubah: `json_schema` harus diperlakukan sebagai
**syarat seleksi kandidat**, bukan properti yang boleh diasumsikan. Peringatan resmi
Cloudflare (*"can't guarantee that the model responds according to the requested JSON
Schema"*) masih berlaku hari ini → **kontrak defensif ADR-0005 §7 wajib juga untuk
panggilan-2**, bukan cuma panggilan-1. Alternatif terdokumentasi kalau kandidat gagal:
`json_object` (paling murah kehilangannya — panggilan-2 tidak punya enum kategori
maupun tipe numerik yang harus ditegakkan), `guided_json` (Mistral, **bentuk API
berbeda** — ongkos integrasi nyata), function calling, atau buang JSON sama sekali.

⚠️ **JSON Mode tidak mendukung streaming** — ini **menutup** satu jalan keluar yang
mungkin terpikir untuk cadangan 15 butir 2 ("kirim balasan dua tahap").

### Bahasa Indonesia: pembeda paling tajam

Hanya **SEA-LION** yang menyebut Indonesian eksplisit (terkonfirmasi ulang sesi induk).
GLM (*"100+ languages"*) dan Gemma (*"140+"*) cuma klaim jumlah tanpa daftar — sinyal
lemah. Llama dan Mistral tidak menyebut apa pun.

**Peringatan yang paling mudah terlewat:** ADR-0005 me-retire risiko Bahasa Indonesia
untuk **ekstraksi**, bukan **generasi**. Itu dua kemampuan berbeda, dan buktinya
**tidak bisa dipinjam** ke panggilan-2 — bahkan untuk model yang sama. Panggilan-2
adalah satu-satunya yang menghasilkan kalimat yang dibaca manusia.

### Temuan yang tidak diminta tiket tapi mengubah implementasi

- **Prompt caching** (`x-session-affinity`) — ungkitan TTFT + diskon token yang
  **terdokumentasi dan gratis**, tidak ada di tiket. ⚠️ Tapi **15 butir 6 mengundang
  tanggal masuk system prompt** (reset harian), dan itu **merusak cache seluruhnya**.
  Harus diselesaikan saat implementasi, bukan ditemukan belakangan.
- **Model termurah bukan yang terkecil** — `llama-3.2-3b` justru **lebih mahal per input
  token** daripada varian 8B. Mengejar parameter count terkecil demi hemat = optimasi
  salah sasaran.
- **Biaya tidak akan pernah mengikat** untuk bot satu orang: 10.000 neuron/hari gratis
  ≈ **450 pesan/hari** pada dua panggilan. Jadi memilih SEA-LION yang 7,8× lebih mahal
  **murah dibayar** kalau kualitas bahasanya menang.
- **18 model dideprekasi 30 Mei 2026** — daftar lengkapnya **gagal diekstrak** (4 query).
  **Verifikasi wajib pemilik repo sebelum mengunci kandidat.**
- **Konfirmasi silang tiket 21:** 11 neuron/call [ADR-0005] × 26.668 neuron/M input
  ≈ 400 token — konsisten. Klaim *"~2000 neurons"* di file skill vendor berarti ~75.000
  token untuk `"warteg 25rb"`: mustahil. Halaman pricing resmi **mendukung ADR-0005 dan
  membantah file skill**.

### ⚠️ Batas kepercayaan — kanal terdegradasi

`WebFetch` ke `developers.cloudflare.com` **diblokir egress policy (403)**, begitu juga
`docs.mcp.cloudflare.com` dan `huggingface.co` (jadi model card pembuat model tidak
terbaca sama sekali). Semua [DOC] lewat `WebSearch` yang mengembalikan **ringkasan**.
Vonis "angkanya segini" kuat; vonis "tidak ada di dokumentasi" lemah. Harga 3.3-70B
gagal diekstrak dalam 5 query — dipakai proksi 3.1-70B, **ditandai sebagai proksi di
setiap kemunculan**.

### Koreksi sesi induk

Satu, dan ia mengenai kandidat utama: klaim bahwa halaman model GLM menyebut
*"structured outputs"* **tidak bisa dikonfirmasi** dalam dua pencarian independen. Yang
ada di halaman model: *"multi-turn tool calling"* (kapabilitas) dan *"structured tasks"*
(prosa pemasaran); frasa *"structured output"* hidup di tingkat **platform/adapter**.

Ini **persis pola ketiga yang riset 21 baru beri nama** — klaim resmi yang benar,
dipasang di kamar yang salah, dan disebut paling sulit dideteksi. Ia muncul lagi di
riset yang sudah diperingatkan soal itu. Akibatnya: sinyal `json_schema` GLM **turun
dari "kuat" ke "sedang"**; urutan probe tidak berubah, tapi **`json_schema` harus jadi
hal pertama yang diuji pada GLM**.

### Status verifikasi

Probe `test/live/reply-composer-probe.test.ts` **sudah terisi keempat kandidat**,
typecheck bersih, dan `npm test` tetap 77/77 (probe di luar gerbang). **Belum
dijalankan** — tidak ada kredensial Cloudflare di environment agent
(`wrangler whoami` = not authenticated). Satu perintah dari pemilik repo:
`npm run test:live`.

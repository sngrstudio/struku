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

## Hasil probe (2026-08-03, dijalankan pemilik repo)

`npm run test:live` di mesin pemilik repo. **Ini mengubah tiket ini dari `[DOC]`
saja menjadi `[DOC]` + `[PROBE]`** — verifikasi yang § "Cara memverifikasi" minta
sudah dibayar.

| Model | Waktu | `json_schema` | Catatan |
|---|---|---|---|
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | **10.370ms** | ✅ | slot `{amount}` + `{total_harian}` utuh, **tapi `{category}` diganti kata user** |
| `@cf/zai-org/glm-4.7-flash` | 8.192ms | ❌ | respons kosong setelah normalisasi |
| `@cf/aisingapore/gemma-sea-lion-v4-27b-it` | 1.635ms | ❌ | respons kosong setelah normalisasi |
| `@cf/meta/llama-3.1-8b-instruct-fast` | **725ms** | ✅ | **ketiga slot utuh** |

### 1. Kontrak dua field flat **terbukti** — 15 butir 5 aman

`{ reply, summary }` kembali utuh pada 70B **dan** 8B, **tanpa spiral whitespace**.
Ini satu-satunya bagian keputusan 15 yang bisa dibuktikan selama freeze, dan ia
**lolos**. Dugaan "yang bikin spiral di spike ADR-0005 §1 adalah objek bersarang,
bukan dua string sejajar" **terkonfirmasi empiris**.

### 2. Premis "lebih kecil = lebih cepat" **terbukti, dan selisihnya ekstrem**

**8B: 725ms. 70B: 10.370ms. 14×.** Riset [DOC] menyebut premis ini tak
terdokumentasi dan mungkin salah; probe membantahnya telak untuk pasangan ini.
15 butir 2 **selamat** — alasan memilih model kecil ternyata berdiri.

⚠️ **Tapi baseline-nya sendiri bergeser:** 70B **10,4s untuk satu panggilan**,
padahal ADR-0005 §2 mencatat p50 ~1,7s / p95 ~2,4s. **4–6× lebih lambat.** Seluruh
aritmetika anggaran NFR-PERF-01 di tiket ini dan di 15 butir 2 dihitung di atas
angka 2,4s yang **sudah tidak berlaku**. Dengan 70B untuk dua panggilan hari ini,
satu pesan ≈ **20s** — lewat anggaran 10s **tanpa retry sama sekali**.

Konsekuensi langsung: **"70B untuk kedua panggilan" (jawaban sah keempat) sekarang
jauh lebih mahal daripada saat riset [DOC] menuliskannya.**

### 3. Dua kandidat teratas riset [DOC] **dua-duanya gagal**

GLM dan SEA-LION mengembalikan **kosong**. Peringkat riset dokumentasi — yang
menempatkan keduanya di atas 8B — **dibalik oleh probe**. Kandidat "kontrol", yang
dimasukkan justru karena **tidak** diharapkan menang, adalah satu-satunya model
kecil yang bekerja.

⚠️ **Jangan buru-buru menyimpulkan keduanya tidak mendukung `json_schema`.**
Probe run-1 punya titik buta: `normalize()` meruntuhkan payload jadi `""`, jadi
**"model mengabaikan skema" tidak bisa dibedakan dari "binding mengembalikan bentuk
yang `normalize()` tidak kenal"** — ambiguitas yang persis sama dengan bekas luka
[`workers-ai-text-parser.ts:94-102`](../../../src/worker/parsing/workers-ai-text-parser.ts).
Probe **sudah diperbaiki** untuk menyimpan payload mentah; **jalankan ulang sebelum
mencoret keduanya**. Kalau ternyata bentuknya cuma beda, SEA-LION (1.635ms, dan
satu-satunya yang dokumentasinya menyebut Indonesian) kembali jadi kandidat kuat.

### 4. Pelanggaran slot yang probe run-1 **tidak tangkap**

70B menulis: *"Pengeluaran untuk kategori **warteg** sebesar `{amount}` …"* — ia
memakai kata **user sendiri** di tempat `{category}` seharusnya berdiri, sehingga
app **tidak punya apa pun untuk disubstitusi** dan nilai kategori yang sudah
diselesaikan app tidak pernah sampai ke layar.

Ini **bukan** halusinasi angka, jadi cek run-1 (`/\d/` + `{amount}`) meloloskannya.
Ini kelas kegagalan yang berbeda: **teks mentah user bocor ke slot yang seharusnya
diisi nilai terselesaikan**. Fog **"bentuk kontrak slot angka"** di `map.md` sekarang
punya kasus konkret — dan ia lebih luas dari namanya: bukan cuma slot *angka*.
8B memakai **ketiga** slot dengan benar. Probe sudah diperbaiki untuk memeriksa
semua slot.

### 5. Kualitas Bahasa Indonesia: dua-duanya **kaku**, bukan kasual

70B: *"Pengeluaran untuk kategori warteg sebesar … sudah tercatat"*.
8B: *"**Anda** telah merekam pengeluaran sebesar …"* — `Anda` itu formal, dan
bertabrakan langsung dengan persona Gita (Jaksel kasual). Prompt probe **sudah**
meminta *"casual, warm, short Indonesian"* dan tidak satu pun memberikannya.

Jadi pertanyaan 4 tiket ini **belum selesai**: kedua model yang bekerja menghasilkan
Bahasa Indonesia yang benar tapi **berjarak**. Itu persoalan nada — dan `map.md`
sudah punya fog **"Nada dan persona bot"** untuk itu. Menaikkan urgensinya.

## Hasil probe run-2 (2026-08-03) — **membalik dua kesimpulan run-1**

| Model | Waktu | `json_schema` | Catatan |
|---|---|---|---|
| `llama-3.3-70b-instruct-fp8-fast` | **3.240ms** (run-1: 10.370ms) | ✅ | **`{category}` dijatuhkan** |
| `glm-4.7-flash` | 7.428ms | ❌ | `content: null`, isi tumpah ke `reasoning` |
| `gemma-sea-lion-v4-27b-it` | 1.409ms | ⚠️ **sebenarnya BERHASIL** | probe-nya yang buta |
| `llama-3.1-8b-instruct-fast` | **699ms** | ✅ | `{category}` dijatuhkan **+ menulis `Rp` sendiri** |

### 🔴 Koreksi 1: SEA-LION **tidak gagal** — probe run-1 yang salah baca

Payload mentahnya:

```
content: "{\"reply\": \"Oke, sudah dicatat pengeluaranmu sebesar {amount} untuk {category} ya! Tot…
```

Ia **menjawab dengan benar**, memakai **`{amount}` dan `{category}` dua-duanya**, dan
Bahasa Indonesianya **kasual persis seperti yang diminta** — *"Oke, sudah dicatat
pengeluaranmu … ya!"*. Bandingkan 70B (*"Pengeluaran untuk kategori warteg sebesar…"*)
dan 8B (*"Warteg **Anda** hari ini…"*), dua-duanya kaku dan formal.

**Sejauh bukti yang ada, SEA-LION satu-satunya kandidat yang lolos ketiganya: bentuk
kontrak, disiplin slot, dan nada.** Ia juga **1.409ms** — 2,3× lebih cepat dari 70B
di run yang sama.

### 🔴 Koreksi 2: binding mengembalikan **dua bentuk berbeda tergantung model**

Ini temuan terbesar run-2, dan ia **jauh melampaui tiket 25**.

| Model | Bentuk respons |
|---|---|
| `llama-3.3-70b`, `llama-3.1-8b` | `{ response: … }` |
| `glm-4.7-flash`, `gemma-sea-lion` | **chat completion ala OpenAI** — `{ choices: [{ message: { content } }] }` |

`normalize()` di probe **dan di
[`workers-ai-text-parser.ts:92-110`](../../../src/worker/parsing/workers-ai-text-parser.ts)**
hanya mengenal `.response`. Bentuk kedua runtuh jadi `""`, yang terbaca sebagai
*"model mengabaikan skema"*.

⚠️ **Ini bekas luka yang sama, masih terbuka, dan sekarang terbukti bukan anomali
satu kali.** Komentar di baris 94-102 menceritakan `.response` pernah salah bentuk
dan menjatuhkan seluruh parse ke `UNKNOWN_REPHRASE_RESULT` *padahal model menjawab
benar* — persis yang barusan terjadi lagi, ke SEA-LION, di depan mata. **Kalau
Cloudflare mengubah 70B ke bentuk OpenAI, jalur pencatatan Struku mati diam-diam
tanpa satu error pun.** Masuk [28](28-parse-schema-5024.md), bukan hanya tiket ini.

Probe **sudah diperbaiki** untuk mengenal kedua bentuk. **Jalankan ulang** —
angka SEA-LION dan GLM di atas belum final.

### GLM: bukan gagal skema, tapi **reasoning model**

`content: null`, `tool_calls: []`, dan isinya tumpah ke field **`reasoning`**
(*"1. **Analyze the …"*). Anggaran `max_tokens: 512` habis dipakai berpikir sebelum
menjawab. Jadi vonis yang benar bukan *"tidak mendukung `json_schema`"* melainkan
**"butuh `max_tokens` jauh lebih besar, dan membayar latency untuk penalaran yang
tidak dibutuhkan panggilan-2"** — menyusun dua kalimat dari slot yang sudah terisi
tidak perlu chain-of-thought. Probe sekarang menandainya terpisah.

### 🟡 Koreksi 3: latency **tidak stabil**, bukan "baseline kedaluwarsa"

70B: **10.370ms** (run-1) → **3.240ms** (run-2). Karena itu kalimat di § Hasil probe
run-1 bahwa ADR-0005 §2 "kedaluwarsa" **terlalu keras dan dikoreksi di sini**: yang
benar adalah **variansinya besar** — 3,2s / 10,4s / 20s+ pada model dan panggilan
yang sama.

Untuk anggaran NFR-PERF-01 ini **lebih buruk** daripada angka tinggi yang stabil:
p95 tidak bisa direncanakan dari p50, dan dua panggilan berurutan mengalikan
variansinya. **Kebijakan timeout + kebijakan retry harus dirancang untuk ekor,
bukan untuk median** — masuk revisi ADR-0005.

### Disiplin slot: pelanggaran **sistematis**, bukan sekali

Cek slot yang diperbaiki menangkap **70B dan 8B dua-duanya menjatuhkan
`{category}`** dan menggantinya dengan kata user (*"warteg"*). 8B lebih jauh lagi:
menulis **`Rp {amount}`** — menyisipkan simbol mata uang sendiri, padahal mata uang
milik app (ADR-0005 §4 menaruh konversi unit di app justru supaya model tidak
menyentuh urusan mata uang).

**Hanya SEA-LION yang memakai `{category}` dengan benar.**

Fog **"bentuk kontrak slot angka"** di `map.md` sekarang punya tiga kasus konkret
dan namanya terbukti salah: bukan hanya slot *angka*. Ia butuh daftar slot yang sah
**plus verifikasi sebelum kirim** — model yang menjatuhkan slot menghasilkan kalimat
yang terlihat wajar tapi kehilangan nilai yang app sudah hitung.

### Catatan: run-2 **tidak** mereproduksi `5024`

`text-parser-contract.test.ts` run-2 gagal dengan **`Network connection lost`** —
sesi remote proxy putus, bukan penolakan skema. Jadi run-2 **inkonklusif** untuk
[28](28-parse-schema-5024.md), bukan bukti tandingan. Klaim "bukan transien" di
tiket 28 tetap berdiri di atas run sebelumnya, dan **butuh satu run bersih lagi**.

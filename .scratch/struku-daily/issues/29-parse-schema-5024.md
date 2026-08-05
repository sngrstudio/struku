# 29 — Skema parsing ADR-0005 §3 ditolak model: `5024 JSON Model couldn't be met`

Type: grilling
Status: resolved
Blocked by: —

## Question

**Jalur pencatatan transaksi — inti produk — gagal 7/7 terhadap model sungguhan.**

Ditemukan 2026-08-03 saat pemilik repo menjalankan `npm run test:live` untuk
memverifikasi [25](25-small-model-for-reply-composition.md). Dijalankan **dua kali**,
di dua branch, terpisah ~10 menit: **7/7 gagal kedua kali.** Bukan transien.

```
AiError: 5024: JSON Model couldn't be met
 ❯ WorkersAiTextParser.callModel src/worker/parsing/workers-ai-text-parser.ts:83
```

Sisanya timeout pada 20s. Tidak satu pun test di
[`test/live/text-parser-contract.test.ts`](../../../test/live/text-parser-contract.test.ts)
lolos.

## Kenapa ini bukan "Workers AI sedang ngadat"

Probe tiket 25 berjalan **di sesi yang sama, terhadap model yang sama**
(`@cf/meta/llama-3.3-70b-instruct-fp8-fast`), lewat mekanisme yang sama
(`response_format: json_schema`) — dan **berhasil**.

Satu-satunya yang berbeda: **bentuk skemanya.**

| | Skema | Hasil |
|---|---|---|
| Probe tiket 25 | 2 field, dua-duanya `string` polos | ✅ lolos |
| `PARSE_RESULT_JSON_SCHEMA` (ADR-0005 §3) | 7 field, union `type: ["string","null"]`, `enum` yang memuat `null` | ❌ `5024` |

Jadi vonisnya: **skema parsing itu sendiri yang ditolak**, bukan model, bukan
platform, bukan kredensial. Halaman JSON Mode Cloudflare memang memperingatkan
model bisa gagal memenuhi skema *"depending on the complexity of the task and
adequacy of the JSON Schema"* — dan ADR-0005 §7 sudah menuliskannya sebagai
prior, bukan jaminan. Yang baru: **prior itu sekarang gagal 100%, bukan sesekali.**

Tersangka utama yang perlu diuji lebih dulu (belum dipersempit — itu pekerjaan
tiket ini): `enum` yang memuat `null` bersama `type` union, di
[`schema.ts:39-47`](../../../src/worker/parsing/schema.ts) —
`txn_type` dan `category`. Bentuk itu sah di JSON Schema tapi tidak umum, dan ia
satu-satunya yang tidak ada di skema probe yang lolos.

## Kenapa ini mendesak, bukan sekadar menarik

**1. Produksi kemungkinan besar sudah rusak sekarang.**
`ai.run` **melempar** `AiError`. `callModel` tidak menangkapnya, `parse()` tidak
menangkapnya, dan `coordinator.ts` **tidak punya satu pun `try`/`catch`**. Jadi
5024 menembus seluruh jalur penanganan pesan.

⚠️ **Ini mengoreksi [15](15-conversational-surface.md) butir 3**, yang menulis
parser *"tidak pernah throw"* dan membangun sebagian alasannya di atas itu. Benar
untuk kegagalan **parse**; **salah** untuk kegagalan **panggilan**. Ada dua mode
gagal, dan yang kedua tidak pernah dipertimbangkan.

**2. Bukti ADR-0005 §2 kedaluwarsa.** Probe mengukur 70B **10.370ms untuk satu
panggilan**; ADR mencatat p50 ~1,7s / p95 ~2,4s. **4–6× lebih lambat.** Seluruh
aritmetika anggaran NFR-PERF-01 di [15](15-conversational-surface.md) butir 2 dan
[25](25-small-model-for-reply-composition.md) berdiri di atas angka yang sudah
tidak berlaku.

**3. Arah [15](15-conversational-surface.md) memperparah taruhannya.** Butir 3
melepas gerbang deterministik dan butir 4 menolak parser cadangan, dengan
konsekuensi *"kalau `env.AI` mati, Struku tidak bisa mencatat apa pun"* yang
diterima sadar. Keputusan itu diambil ketika seam ini dianggap sehat. **Sekarang
ia tidak sehat**, dan pertanyaannya bukan lagi hipotetis.

## Yang harus ditanyakan

1. **Perbaiki skemanya, atau ubah kontraknya?** Menyederhanakan `enum`+`null` itu
   tambalan kecil dan mungkin cukup. Tapi kalau `json_schema` ternyata rapuh
   terhadap bentuk skema yang tidak bisa diprediksi, `json_object` + Zod (yang
   **sudah** jadi gerbang sebenarnya menurut ADR-0005 §7) mungkin lebih jujur.
   Riset [25](25-small-model-for-reply-composition.md) §2d sudah memetakan
   alternatifnya.
2. **Apakah `AiError` ditangkap, dan dibalas apa?** [15](15-conversational-surface.md)
   butir 4 sudah memutuskan *"sistem sedang bermasalah"* dibedakan dari *"aku belum
   ngerti"* — ini kejadian nyata pertama yang membutuhkannya. Apakah tambalan ini
   didahulukan dari arsitektur baru, atau menunggu?
3. **Apakah freeze ditimbang ulang?** Freeze menahan rilis sampai map selesai. Kalau
   produksi memang rusak, menahan perbaikan sampai map selesai berarti bot tidak
   bisa dipakai sama sekali sampai saat itu — dan destination map ini justru
   *"dipakai harian"*. **Ini keputusan pemilik repo, bukan agent.**
4. **Bagaimana ini tidak lolos lagi?** Suite lokal 77/77 tetap hijau selama ini,
   karena `TextParser` palsu disuntikkan di atas `env.AI` (sesuai Testing Decisions).
   `test:live` menangkapnya, tapi ia **non-gating dan jarang dijalankan** — jeda
   antara kerusakan dan penemuan tidak diketahui.

## Catatan

- **Prasyarat sebelum menggrilling:** jalankan ulang `npm run test:live`. Probe
  sudah diperbaiki untuk menyimpan payload mentah, dan itu akan menunjukkan apakah
  kegagalan GLM/SEA-LION sekelas dengan ini atau soal lain.
- **Jangan diperbaiki diam-diam.** Skema parsing adalah ADR-0005 §3; mengubahnya
  adalah **revisi ADR**, bukan tweak — dan revisi §1/§2 sudah tertunda dari
  [15](15-conversational-surface.md).
- Bukti mentah kedua run ada di transkrip sesi 2026-08-03; ringkasannya di
  [25 § Hasil probe](25-small-model-for-reply-composition.md).

## Tambahan run-3 (2026-08-03): satu bahaya baru, satu klaim melemah

### 🚨 Bahaya baru: binding punya **dua bentuk respons**, parser hanya tahu satu

Probe [25](25-small-model-for-reply-composition.md) run-2 membuktikan `env.AI.run`
mengembalikan bentuk berbeda **tergantung model**:

| Model | Bentuk |
|---|---|
| `llama-3.3-70b`, `llama-3.1-8b` | `{ response: … }` |
| `glm-4.7-flash`, `gemma-sea-lion` | chat completion ala OpenAI — `{ choices: [{ message: { content } }] }` |

[`workers-ai-text-parser.ts:92-110`](../../../src/worker/parsing/workers-ai-text-parser.ts)
**hanya mengenal `.response`.** Bentuk kedua runtuh jadi `""` → `tryParseResult`
gagal → retry → gagal lagi → `UNKNOWN_REPHRASE_RESULT`. **Tanpa satu error pun.**

Ini **bukan hipotesis**: probe run-2 melakukannya persis itu ke
`gemma-sea-lion`, yang sebenarnya menjawab dengan sempurna, dan menskornya sebagai
gagal. Komentar di baris 94-102 menceritakan kejadian yang sama pernah menimpa
produksi. **Jadi bentuk `.response` untuk 70B adalah asumsi tak tertulis yang
menopang seluruh jalur pencatatan, dan tidak ada satu pun test yang menjaganya** —
suite lokal menyuntik `TextParser` palsu di atas `env.AI`, jadi ia tidak pernah
menyentuh bentuk ini.

**Kalau Cloudflare memindahkan 70B ke bentuk OpenAI, Struku berhenti mencatat
diam-diam.** Ini pertanyaan kelima untuk tiket ini: **apakah normalisasi respons
dikeraskan sekarang, terpisah dari perdebatan skema?** Ia murah, tidak menyentuh
ADR-0005 §3, dan menutup mode gagal senyap yang sudah terbukti dua kali.

### 🟡 Klaim "bukan transien" melemah — butuh satu run bersih

Run-3 **tidak** mereproduksi `5024`. Ia gagal dengan **`Network connection lost`**
(sesi remote proxy putus, tujuh `uncaught exception` dari
`remote-proxy-client.worker.js`, enam test gagal dalam <10ms setelah yang pertama
mati di 12,9s). Jadi run-3 **inkonklusif**, bukan bukti tandingan.

Status bukti `5024` sekarang: **dua run reproduksi (run-1 dan run-2), satu run
inkonklusif.** Masih cukup untuk membuka tiket ini, **belum** cukup untuk mengunci
diagnosis skema sebelum satu run bersih lagi. **Jalankan `npm run test:live` sekali
lagi sebelum menggrilling.**

### 🟡 Klaim "latency 4–6× lebih lambat" dikoreksi

Tulisan di § "Kenapa ini mendesak" butir 2 bahwa bukti ADR-0005 §2 "kedaluwarsa"
**terlalu keras.** 70B diukur **10.370ms** (run-1) lalu **3.240ms** (run-2) pada
panggilan yang sama. Yang benar: **variansinya besar dan tidak bisa direncanakan**,
bukan "baseline bergeser ke atas".

Untuk NFR-PERF-01 ini justru **lebih menyulitkan** — p95 tidak bisa diturunkan dari
p50, dan dua panggilan berurutan mengalikan variansi. Konsekuensinya untuk tiket
ini tidak berubah: kebijakan timeout dan retry harus dirancang untuk **ekor**, bukan
median.

## Run-4 (2026-08-03): `5024` **direproduksi bersih** — status bukti final

Run bersih (tidak ada `Network connection lost`): **4× `5024` + 3× timeout 20s**,
7/7 gagal.

**Status bukti sekarang: tiga run konklusif mereproduksi, satu inkonklusif.**
Koreksi "klaim melemah" di bagian run-3 di atas **dibatalkan** — klaim "bukan
transien" berdiri lebih kuat dari semula.

Kontrolnya juga makin kuat: di run yang sama, probe [25](25-small-model-for-reply-composition.md)
memanggil **model yang sama** lewat **mekanisme yang sama** dan **lolos** (70B,
3.396ms). Empat run berturut-turut menunjukkan pola yang sama: skema dua-string
lolos, `PARSE_RESULT_JSON_SCHEMA` ditolak.

### Yang **belum** diketahui, dan kenapa itu penting

*"Skemanya yang ditolak"* sudah kuat. **Konstruk mana** yang ditolak — belum.
Kedua skema berbeda di **empat hal sekaligus**:

| | Probe (lolos) | `PARSE_RESULT_JSON_SCHEMA` (ditolak) |
|---|---|---|
| Jumlah field | 2 | 7 |
| Tipe | `string` polos | union `type: ["string","null"]` (5 field) |
| `enum` | tidak ada | ada di 2 field |
| `null` di dalam `enum` | tidak ada | ada di 2 field |

Sudah bisa **dicoret**: `additionalProperties: false` yang tidak ada — skema probe
juga tidak punya, dan ia lolos.

Menambal tanpa mengisolasi berarti menebak: kalau `enum` disederhanakan lalu
kebetulan jalan, aturannya tetap tidak diketahui dan skema berikutnya akan kena
lagi.

→ **Probe isolasi ditulis: `test/live/schema-isolation-probe.test.ts`** (sudah
dihapus setelah menjawab — lihat § Run-5). Delapan langkah, masing-masing menambahkan **satu** konstruk di atas bentuk yang
diketahui baik, dijepit dua kontrol (S1 = bentuk probe 25, S8 = skema asli).
Langkah pertama yang `REJECTED` menyebut tersangkanya. Prompt, model, dan
`max_tokens` sengaja dibuat identik sehingga skema satu-satunya variabel.
**Jalankan `npm run test:live`, lalu catat hasilnya di sini.**

### Gejala kedua yang belum punya penjelasan

**3 dari 7 gagal karena timeout 20s, bukan `5024`** (run-1: 5:2, run-4: 4:3).
Ini **bukan** jalur retry ADR-0005 §7 — `5024` dilempar, jadi `tryParseResult`
tidak pernah dipanggil dan retry tidak berjalan. Artinya ada panggilan yang
**menggantung >20 detik**, bukan ditolak.

Belum ada penjelasan, dan **sengaja tidak ditebak**. Probe isolasi memakai timeout
45s justru supaya panggilan yang menggantung terlihat sebagai `HUNG/OTHER` dengan
durasinya, bukan tertutup dinding 20s.

## Run-5 (2026-08-05, sesi lokal): probe isolasi dijalankan — **tersangkanya `type` union**

`npm run test:live`, run bersih, 140s. Transkrip lengkap S1–S8:

| Langkah | Vonis | Durasi | Konstruk |
|---|---|---|---|
| S1 | ✅ OK | 3.074ms | KONTROL: 2 string polos (bentuk probe 25) |
| S2 | ✅ OK | 3.689ms | 7 field string polos — jumlah field saja |
| S3 | ✅ OK | 1.585ms | `enum` polos (5 nilai, tanpa null, tanpa union) |
| S4 | ❌ REJECTED | **28.004ms** | `type: ["string","null"]` — **tanpa `enum` sama sekali** |
| S5 | ❌ REJECTED | 5.857ms | `type: ["number","null"]` |
| S6 | ❌ REJECTED | 7.452ms | union + `enum` memuat `null` |
| S7 | ❌ REJECTED | 7.624ms | union + `enum` **tanpa** `null` |
| S8 | ❌ REJECTED | 15.759ms | KONTROL: `PARSE_RESULT_JSON_SCHEMA` |

### Vonis: `type` sebagai **array** yang ditolak, bukan `enum`

Langkah pertama yang gagal adalah **S4**, dan S4 tidak memuat `enum` sama sekali.
Satu-satunya yang ia tambahkan di atas S1 adalah `type: ["string","null"]`.

Yang sekarang **dicoret sebagai penyebab**:

- **Jumlah field** — S2 lolos dengan 7 field.
- **`enum`** — S3 lolos dengan enum 5 nilai.
- **`null` di dalam `enum`** — S7 membuangnya dan **tetap** ditolak.
- **Tipe spesifik** — S5 menunjukkan union numerik ditolak sama saja, jadi ini
  bukan soal `string`.

⚠️ **Tersangka utama yang ditulis di § Question badan tiket ini — `enum` yang memuat
`null` — SALAH.** S6 memang ditolak, tapi S4 sudah ditolak lebih dulu tanpa `enum`,
dan S7 ditolak tanpa `null` di enum. Menambal `enum`-nya saja tidak akan
memperbaiki apa pun. Ini persis alasan probe isolasi ditulis, dan ia membayar.

**Yang belum terisolasi tapi jadi tidak relevan:** ukuran `enum` (S3 memakai 5 nilai;
`category` di skema asli punya 10). Tidak perlu dikejar — union `type` sendirian
sudah cukup untuk menolak, dan 5 dari 7 field skema asli memakainya.

**Yang belum diuji dan mungkin jadi jalan keluar:** `type: "string"` polos +
`nullable: true`, atau `anyOf: [{type:"string"},{type:"null"}]`. Keduanya cara lain
menyatakan nullable. Belum ada bukti keduanya diterima — **jangan diasumsikan**.

### Dokumentasi tidak menyebut batasan ini

Kanal `WebFetch` ke `developers.cloudflare.com` **terbuka** di sesi lokal ini
(berbeda dari sesi remote 2026-08-03/04 yang kena 403), jadi halaman JSON Mode
dibaca langsung, bukan lewat ringkasan pencarian. Halaman itu **tidak** memuat
daftar keyword JSON Schema yang didukung; ia hanya mencontohkan `type`, `properties`,
`items`, `required`, `enum` — semuanya dengan `type` berupa **string tunggal** — dan
memperingatkan model bisa gagal *"depending on the complexity of the task and
adequacy of the JSON Schema"*.

Jadi: **batasan ini tidak terdokumentasi.** Ia hanya bisa ditemukan lewat probe,
dan konsekuensinya untuk pertanyaan 1 di bawah — apakah `json_schema` cukup bisa
diprediksi untuk dipercaya — **memburuk**, bukan membaik.

### Gejala kedua (timeout 20s) sekarang punya mekanisme

**S4 ditolak `5024` setelah 28.004ms** — di atas dinding 20s yang dipakai
`text-parser-contract.test.ts`. Artinya penolakan `5024` **bisa datang lebih lambat
dari test timeout**, dan test yang "timeout" kemungkinan besar adalah `5024` yang
telat, bukan panggilan yang menggantung selamanya.

Ini **mekanisme yang terbukti ada**, bukan bukti langsung untuk ketiga test itu.
Cara memastikan, kalau dianggap perlu: naikkan `testTimeout` kontrak ke 45s dan
lihat apakah 7/7 berubah jadi `5024`. Murah.

Latensi penolakan sendiri berayun **5.857ms → 28.004ms** pada mekanisme yang sama.
Menguatkan catatan run-3: kebijakan timeout/retry harus dirancang untuk **ekor**.

### Koreksi klaim "parser hanya mengenal satu bentuk respons"

Bagian run-3 di atas menulis
[`workers-ai-text-parser.ts:92-110`](../../../src/worker/parsing/workers-ai-text-parser.ts)
*"hanya mengenal `.response`"*. Dibaca ulang: ia menangani **dua** varian `.response`
(string, dan object yang sudah ke-parse — lihat komentar baris 94-102 yang mencatat
luka lama itu). Yang **tidak** ia tangani adalah bentuk chat-completion ala OpenAI
(`choices[0].message.content`).

Lubangnya tetap nyata dan pertanyaan kelima tetap berdiri — hanya deskripsinya yang
perlu tepat: **bukan** "buta terhadap bentuk kedua `.response`", tapi **"buta
terhadap `choices`"**.

### Yang berubah untuk pertanyaan 1

Pertanyaan 1 (*"perbaiki skemanya, atau ubah kontraknya?"*) sekarang punya bentuk
konkret: **hapus setiap `type: [...,"null"]` dari `PARSE_RESULT_JSON_SCHEMA`.** Lima
field memakainya (`txn_type`, `amount`, `category`, `date`, `clarification`).

Dua arah, keduanya **revisi ADR-0005 §3**, keduanya masih HITL:

1. **Buang nullability dari `json_schema`** — semua field jadi tipe tunggal dan
   wajib; ketiadaan nilai dinyatakan lewat sentinel yang dinormalkan Zod di
   boundary. Presedennya **sudah ada** di [`schema.ts:20-25`](../../../src/worker/parsing/schema.ts)
   (field `date` sudah persis melakukan ini). Perubahan paling kecil.
2. **Pindah ke `json_object` + Zod** — sesuai alternatif yang dipetakan riset
   [25](25-small-model-for-reply-composition.md) §2d. Lebih jujur kalau
   `json_schema` dianggap tidak bisa diprediksi; ADR-0005 §7 sudah menempatkan Zod
   sebagai gerbang sebenarnya.

**Belum diputuskan. Ini keputusan pemilik repo.** Butir 3 (apakah freeze ditimbang
ulang) juga belum tersentuh dan tidak berubah oleh run ini.

### Probe dihapus

`test/live/schema-isolation-probe.test.ts` sudah menjawab pertanyaannya dan menulis
sendiri bahwa ia sementara — dihapus di commit yang sama dengan catatan ini.

## Run-6 (2026-08-05): probe #2 — **`anyOf` diterima, `nullable: true` ditolak**

Probe #1 menamai konstruk yang ditolak tapi meninggalkan ruang opsi yang belum
lengkap: dua opsi yang tertulis di pertanyaan 1 sama-sama mahal, dan **tidak
satu pun terbukti perlu**. Probe #2 menutup ruang itu sebelum ADR ditulis.

| Langkah | Vonis | Durasi | Konstruk |
|---|---|---|---|
| N1 | ✅ OK | 3.144ms | KONTROL: 2 string polos |
| N2 | ❌ REJECTED | 10.164ms | satu field: `nullable: true` (ejaan OpenAPI) |
| N3 | ✅ OK | 1.253ms | satu field: `anyOf: [{string},{null}]` |
| N4 | ✅ OK | 6.339ms | satu field: `anyOf` membungkus `enum` (kasus `txn_type`) |
| N5 | ❌ REJECTED | 20.472ms | **skema asli** via `nullable: true` |
| N6 | ✅ OK | **2.380ms** | **skema asli via `anyOf`** |
| N7 | ✅ OK | 3.283ms | skema asli opsi A (nullability dibuang) |
| N8 | ❌ REJECTED | 26.796ms | KONTROL: `PARSE_RESULT_JSON_SCHEMA` verbatim |

Kedua kontrol berperilaku identik dengan probe #1 (N1 lolos, N8 ditolak), jadi
kedua run sebanding dan hasilnya bukan pergeseran platform.

### Temuan utama: ada opsi ketiga, dan ia jauh lebih murah dari keduanya

**N6** — skema asli, tujuh field, dua `enum`, lima field nullable, **hanya** cara
menulis nullable-nya diganti jadi `anyOf` — diterima dalam 2.380ms dan menjawab:

```json
{"intent":"transaction","txn_type":"expense","amount":25,
 "currency":"VND","category":"food","date":null,"clarification":null}
```

`null` **sungguhan**, bukan sentinel. Nullability utuh, prior struktural utuh,
`parseResultSchema` tidak perlu disentuh, tidak ada sentinel yang harus
dinormalkan Zod.

Konsekuensinya untuk pertanyaan 1: **opsi A dan opsi B dua-duanya tidak perlu.**
Revisi ADR-0005 §3 turun dari "mengganti kontrak parsing" jadi satu paragraf, dan
diff-nya terbatas pada [`schema.ts:32-50`](../../../src/worker/parsing/schema.ts).

### `nullable: true` juga ditolak — jadi ini bukan soal "array"

N2 dan N5 menolak ejaan OpenAPI. Digabung dengan probe #1, polanya: validator
`json_schema` Cloudflare menuntut **JSON Schema ketat** — `type` bernilai tunggal,
union dinyatakan lewat `anyOf`. Ini lebih sempit dari kesimpulan run-5 ("`type`
array ditolak") dan lebih berguna: ia memberi aturan, bukan daftar larangan.

### Opsi A memang lolos, tapi biayanya terlihat — sebagian

N7 diterima, jadi opsi A **bisa** dijalankan. Payload-nya memperlihatkan kerusakan
yang diperkirakan: `date: ""` muncul sebagai sentinel string kosong karena tidak
ada `null` untuk dipakai.

⚠️ Yang **belum terbukti**: dugaan bahwa `txn_type` akan dikarang saat pesannya
bukan transaksi. Pesan uji probe ini transaksi sungguhan, jadi jalur itu tidak
pernah tersentuh. Biaya opsi A nyata tetapi **belum terukur penuh** — jangan
dikutip sebagai sudah terbukti.

### Keberatan yang tetap berdiri terhadap `anyOf`

`anyOf` **sama tidak terdokumentasinya** dengan `type` array yang barusan merusak
jalur transaksi — halaman JSON Mode tidak menyebut keduanya. Memilihnya berarti
Struku sadar berdiri di atas perilaku platform yang tidak dijanjikan, dan kelas
kerusakan yang sama bisa kembali kalau validatornya digeser.

Itu **tidak** ditutup oleh memilih opsi B; itu ditutup oleh **pertanyaan 4**
(bagaimana ini tidak lolos lagi). `test:live` terbukti menangkap kelas ini, tapi
ia non-gating dan jarang dijalankan. Tanpa jawaban untuk pertanyaan 4, keberatan
ini tetap terbuka apa pun yang dipilih.

### Status pertanyaan 1

**Belum ditutup — menunggu pemilik repo.** Rekomendasi agent: `anyOf`. Bukti dan
biayanya ada di atas; keputusannya bukan milik agent.

Probe #2 (`test/live/schema-null-form-probe.test.ts`) dihapus setelah catatan ini,
sama seperti probe #1.

## Keputusan pertanyaan 1 (2026-08-05) — pemilik repo

⚠️ **Tiket ini belum resolved.** Ini keputusan untuk **satu** dari lima pertanyaan;
2–5 masih terbuka dan `Status:` sengaja tetap `claimed`.

**Nullability dinyatakan lewat `anyOf`.** Opsi A (membuang nullability) dan opsi B
(`json_object` + Zod) dua-duanya **ditolak** — bukan karena tidak jalan, tapi karena
probe #2 menunjukkan keduanya tidak perlu.

Aturan kanoniknya, untuk ditulis di revisi ADR-0005 §3:

> Skema yang dikirim ke `response_format: json_schema` harus JSON Schema ketat:
> `type` selalu bernilai tunggal, dan union — termasuk nullable — dinyatakan lewat
> `anyOf`. `type` sebagai array dan ejaan OpenAPI `nullable: true` dua-duanya
> ditolak platform dengan `5024`.

Diff-nya terbatas pada [`schema.ts:32-50`](../../../src/worker/parsing/schema.ts);
`parseResultSchema` dan gerbang Zod §7 tidak berubah.

### Yang **tidak** ditutup keputusan ini

Penting dicatat supaya tidak ada yang mengira tiket ini selesai:

1. **Jalur `throw` tetap terbuka.** `5024` berhenti, tapi `ai.run` masih bisa
   melempar karena sebab lain (jaringan, 5xx, model ditarik). `coordinator.ts`
   masih **tidak punya satu pun `try`/`catch`** → pertanyaan 2.
2. **Panggilan yang menggantung >20s tidak dijelaskan.** N6 memang 2.380ms, tapi
   variansi ekor yang tercatat di run-3/run-5 tidak hilang karena skemanya berubah.
   Kebijakan timeout/retry tetap harus dirancang untuk ekor.
3. **`json_schema` tetap prior, bukan jaminan.** Skema diterima ≠ model patuh.
   Gerbang Zod ADR-0005 §7 tetap wajib untuk **kedua** panggilan.
4. **Ketergantungan pada perilaku tak terdokumentasi diterima sadar.** `anyOf`
   tidak dijanjikan dokumentasi mana pun. Keberatan ini hanya ditutup oleh
   pertanyaan 4 — belum dijawab.
5. **Panggilan-2 belum diaudit terhadap aturan ini.** Skema penyusun balasan hari
   ini dua string polos, jadi ia aman sekarang; aturannya harus ditulis mengikat
   **kedua** panggilan agar tidak terulang saat skema itu tumbuh.
6. **Tidak ada yang dirilis.** Freeze tidak tersentuh → pertanyaan 3.
7. **Konstruk lain belum diuji** — `additionalProperties`, objek bersarang, `array`.
   Aturan di atas berlaku untuk apa yang diuji, bukan janji menyeluruh.

## Keputusan pertanyaan 4 (2026-08-05) — pemilik repo

**Dua lapis, dan `test:live` TIDAK dijadikan gate CI.**

**Lapis 1 — aturan skema dipaksa mesin, lokal dan deterministik.** Sebuah unit test
membaca skema yang dikirim ke `response_format` dan menolak kalau menemukan `type`
berupa array atau key `nullable`. Nol neuron, jalan di setiap `npm test`, menangkap
kelas kesalahan ini saat ditulis. Ini yang mengubah keputusan `anyOf` dari niat baik
jadi invarian yang tidak bisa dilanggar diam-diam. Berlaku untuk **kedua** panggilan.

**Lapis 2 — `test:live` jadi langkah wajib pra-deploy**, tertulis di checklist rilis,
bukan gate CI.

### Kenapa gate CI ditolak

`test:live` memanggil model pihak ketiga yang latensinya terukur **1.253ms–28.004ms**
dalam satu sesi. Gate yang merah karena platform lambat — bukan karena diff-nya —
akan dipelajari untuk diabaikan, dan **gate yang diabaikan lebih berbahaya daripada
tidak ada gate** karena ia memberi rasa aman palsu. Tambahannya ia butuh kredensial
di CI dan membakar neuron tiap push.

### Biaya yang diterima sadar

Lapis 1 **tidak bisa** menangkap Cloudflare menggeser validatornya — ia hanya
menegakkan aturan yang sudah diketahui. Hanya lapis 2 yang bisa, dan lapis 2 hanya
berjalan menjelang deploy.

**Jeda antara "platform berubah" dan "kita tahu" = jarak antar-deploy.** Dengan
freeze yang sedang berlaku, jeda itu berbulan-bulan. **Diterima sadar.**

### Yang **tidak** ditutup keputusan ini

1. **Lapis ketiga ditolak.** Alert produksi saat `AiError` terjadi tidak diambil,
   jadi pertanyaan 2 **tidak boleh** bersandar pada "toh nanti ke-alert".
2. **Kebutaan struktural suite lokal tetap ada.** `TextParser` palsu disuntik di
   atas `env.AI` (Testing Decisions) — itu tidak berubah, dan lapis 1 tidak
   menyentuhnya. Yang berubah hanya: satu kelas kesalahan spesifik kini terjaga.
3. **Konstruk di luar aturan tidak terjaga.** Lapis 1 menegakkan dua larangan yang
   sudah diuji; skema yang gagal karena sebab lain tetap lolos sampai lapis 2.

## Keputusan pertanyaan 2 (2026-08-05) — pemilik repo

⚠️ **Premis pertanyaannya dikoreksi lebih dulu.** Badan tiket menulis *"apakah
tambalan ini didahulukan dari arsitektur baru, atau menunggu?"* — pertanyaan itu
tidak sah di map ini: mode-nya planning-by-default tanpa override eksekusi, jadi
**tidak ada yang ditambal**. Yang diputuskan adalah **apa yang diwajibkan revisi
ADR-0005**; kodenya mendarat lewat `/to-spec`.

**Kegagalan panggilan wajib punya hasil yang terpisah dari kegagalan parse.**

- `TextParser` menangkap kegagalan panggilan **di boundary-nya sendiri** dan
  mengembalikan hasil gagal yang **berbeda** dari `UNKNOWN_REPHRASE_RESULT`.
- Coordinator memetakan keduanya ke balasan yang berbeda: *panggilan gagal* →
  *"sistem sedang bermasalah, coba lagi sebentar"*; *parse gagal* → *"aku belum
  ngerti"*.
- Penangkapannya **tidak** disebar sebagai `try`/`catch` di `coordinator.ts`.
  Coordinator tidak perlu tahu `env.AI` ada; seam-nya tetap sempit.

### Kenapa menyatukan keduanya ditolak

Mengembalikan `UNKNOWN_REPHRASE_RESULT` saat `ai.run` melempar adalah jalan
termudah — jalurnya sudah ada. Tapi ia membuat *"AI-nya mati"* menyamar jadi *"aku
belum ngerti maksud kamu"*, sehingga user **menulis ulang pesannya**, gagal lagi,
menulis ulang lagi. Ia menyalahkan dirinya sendiri untuk kerusakan sistem, dan tiap
percobaan membakar neuron. [15](15-conversational-surface.md) butir 4 sudah
melarangnya — larangan itu diambil saat seam ini dianggap sehat, jadi baru sekarang
ia punya gigi.

Kondisi hari ini lebih buruk dari salah balas: `ai.run` melempar, tidak ada yang
menangkap sepanjang jalur, jadi `AiError` keluar sebagai unhandled exception di
Durable Object dan **user tidak melihat apa pun** — pesannya hilang tanpa suara.
Keputusan pertanyaan 4 menolak alert produksi, jadi tidak ada yang memberi tahu.

### Pesan yang gagal dianggap **hilang**

User diminta mengirim ulang; Struku **tidak** mengantre dan **tidak** mencoba lagi
di belakang layar. Konsekuensinya diterima sadar: balasan yang sopan tetap berarti
transaksinya tidak tercatat, dan user harus ingat sendiri.

Antrian/retry ditolak **sekarang** karena ia menambah state baru ke jalur yang
sedang dirombak [15](15-conversational-surface.md) — bukan karena idenya buruk.
Boleh dipertimbangkan lagi setelah arsitektur dua-panggilan mendarat.

### Yang **tidak** ditutup keputusan ini

1. **Berapa lama "coba lagi sebentar"** — tidak ditentukan. Butuh angka dari
   kebijakan timeout/retry, yang masih harus dirancang untuk **ekor**, bukan median.
2. **Apakah `5024` dibedakan dari kegagalan lain** dalam balasan — tidak. Semua
   kegagalan panggilan dianggap satu kelas dari sudut pandang user.
3. **Retry internal ADR-0005 §7** (retry parse) tidak berubah dan tidak dicampur
   dengan ini.

## Keputusan pertanyaan 5 (2026-08-05) — pemilik repo

**Satu boundary normalisasi respons, dipakai kedua panggilan, dan bentuk yang tidak
dikenal = kegagalan panggilan.**

1. Normalisasi mengerti **dua** bentuk: `{ response }` dan chat completion ala
   OpenAI (`choices[0].message.content`).
2. **Satu** implementasi dipakai panggilan-1 dan panggilan-2 — bukan dua salinan
   yang bisa menyimpang.
3. Bentuk yang **tidak dikenal** memakai hasil gagal terpisah dari keputusan
   pertanyaan 2. **Tidak boleh runtuh jadi `""`.**

### Bobot pertanyaan ini dinaikkan: bukan asuransi, tapi prasyarat

Badan tiket menempatkan ini sebagai jaga-jaga kalau Cloudflare memindahkan 70B ke
bentuk OpenAI — hipotetis dan prioritas rendah. **Itu terlalu ringan.**

Model yang [25](25-small-model-for-reply-composition.md) pilih untuk panggilan-2 —
`@cf/aisingapore/gemma-sea-lion-v4-27b-it` — **sudah mengembalikan bentuk `choices`
sekarang**, terbukti di probe run-2 dan run-5. Sementara
[`workers-ai-text-parser.ts:103-110`](../../../src/worker/parsing/workers-ai-text-parser.ts)
hanya membaca `.response`.

Jadi begitu arsitektur dua-panggilan [15](15-conversational-surface.md) mendarat,
panggilan-2 **pasti** menabrak bentuk yang produksi tidak bisa baca. Bukan "kalau",
tapi "saat". Ini menjadikan pertanyaan 5 **prasyarat arsitektur yang sudah
diputuskan**, bukan pengerasan opsional.

Ironinya: logika yang benar **sudah ditulis** — `normalize()` di
[`test/live/reply-composer-probe.test.ts:78-105`](../../../test/live/reply-composer-probe.test.ts)
menangani kedua bentuk — tapi ia hidup di file probe yang berstatus sementara dan
sudah dijadwalkan dihapus. Yang dipakai produksi tidak punya.

Mode gagalnya menyambung persis ke larangan pertanyaan 2: bentuk tak dikenal →
runtuh jadi `""` → terlihat seperti parse gagal → *"aku belum ngerti"*. Penyamaran
yang sama, lewat pintu yang berbeda.

### Yang **tidak** ditutup keputusan ini

1. **Bentuk ketiga tetap bisa muncul.** Aturan ini tidak mencegahnya — ia hanya
   memastikan kegagalannya **berisik**, bukan senyap. Itu yang bisa dibeli.
2. **Tidak ada test yang menjaga bentuk respons** selama `TextParser` palsu
   disuntik di atas `env.AI`. Lapis 1 keputusan pertanyaan 4 menegakkan aturan
   *skema*, bukan aturan *bentuk respons* — celah ini tetap hanya terjaga lapis 2.
3. **Penghapusan `reply-composer-probe.test.ts` sekarang punya prasyarat:**
   `normalize()`-nya harus sudah dipindah ke produksi lebih dulu, kalau tidak
   satu-satunya salinan logika yang benar ikut terhapus.

## Keputusan pertanyaan 3 (2026-08-05) — pemilik repo

**Freeze dikecualikan, sempit.** Satu deploy, isinya **hanya** tiga perubahan yang
diputuskan tiket ini. Freeze tetap berdiri untuk segala hal lain.

Menempel padanya, dan diputuskan sadar: **map diberi override eksekusi untuk slice
itu saja** — ditulis di `map.md` § Notes. Map ini berhenti planning-only **untuk
satu slice**, bukan seluruhnya.

Deploy-nya wajib `npm run test:live` + `wrangler tail`. Guardrail miniflare ≠
workerd tidak bisa ditawar — dua bug produksi sudah pernah lolos lewat celah itu.

**[24](24-edit-mode-escape.md) tidak ikut.** Bentuknya masih digantung keputusan
[15](15-conversational-surface.md) dan tambalan cepatnya sudah ditolak dua kali;
memasukkannya sekarang mengulang penolakan yang sama.

### Temuan yang memicu keputusan ini: freeze-nya **melingkar**

Freeze lepas *saat map selesai*. Tapi `map.md` § Notes menulis sendiri bahwa fog
yang menunggu **bukti pemakaian** — beban konfirmasi, akurasi kategori, kategori
kustom, budget — **tidak akan bergerak sampai freeze dicabut**.

> map selesai → butuh bukti pemakaian → butuh bot yang jalan → butuh deploy →
> butuh map selesai.

Sebagian sisa map **secara struktural tidak bisa** diselesaikan selama freeze
berdiri. Freeze diputuskan 1 Agustus dengan alasan yang benar (mencegah deploy
separuh jadi); yang belum terlihat saat itu: destination-nya sendiri memakai
pemakaian nyata sebagai bahan bakar.

Tolok ukur destination — *tujuh hari berturut-turut tanpa menemukan hal yang bikin
berhenti* — jamnya bahkan **belum bisa mulai**: produksi `7436f2b5` jalur
transaksinya rusak, dan 24 masih menjebak di mode edit.

### Kenapa slice ini bukan kerja terbuang

Ketiga perubahan **selamat dari rombakan [15](15-conversational-surface.md)**:

- `anyOf` di `schema.ts` — panggilan-1 tetap parsing, skemanya tetap dipakai.
- Hasil gagal terpisah — arsitektur baru justru **membutuhkannya**.
- Boundary normalisasi — panggilan-2 **tidak bisa jalan tanpanya**.

Jadi keberatan *"untuk apa deploy ke arsitektur yang mau diganti"* tidak berlaku
untuk ketiganya.

### Yang **tidak** ditutup keputusan ini

1. **Freeze tidak dicabut.** Ini pengecualian bernomor satu, bukan pembukaan.
   Deploy berikutnya kembali butuh keputusan baru.
2. **24 tetap menjebak di produksi**, jadi pemakaian harian **masih terhalang**
   walau pencatatan pulih. Bukti pemakaian belum tentu langsung mengalir.
3. **Utang verifikasi 22 dan 23B tidak otomatis lunas** — slice ini tidak
   menyentuhnya, dan 24 masih menghalangi cara membuktikannya.

---

## Answer

**Resolved 2026-08-05.** Lima pertanyaan dijawab pemilik repo; detail dan biaya
tiap keputusan ada di lima bagian § Keputusan di atas.

1. **Skema** — nullability dinyatakan lewat `anyOf`. `type` sebagai array dan
   `nullable: true` dua-duanya ditolak platform (`5024`); aturannya: JSON Schema
   ketat, `type` bernilai tunggal, union lewat `anyOf`. Opsi "buang nullability"
   dan "pindah ke `json_object`" dua-duanya ditolak — probe #2 membuktikan
   keduanya tidak perlu.
2. **Kegagalan panggilan** — wajib punya hasil terpisah dari kegagalan parse,
   ditangkap di boundary `TextParser`, dipetakan ke balasan yang berbeda
   (*"sistem bermasalah"* vs *"aku belum ngerti"*). Pesan yang gagal dianggap
   **hilang**; tidak diantre.
3. **Freeze** — dikecualikan sempit untuk satu deploy berisi ketiga perubahan di
   atas, plus override eksekusi untuk slice itu saja. 24 tidak ikut.
4. **Pencegahan** — dua lapis: aturan skema ditegakkan unit test lokal
   deterministik (nol neuron, tiap `npm test`), dan `test:live` jadi langkah wajib
   pra-deploy — **bukan** gate CI. Alert produksi ditolak. Jeda deteksi selebar
   jarak antar-deploy diterima sadar.
5. **Normalisasi respons** — satu boundary bersama untuk kedua panggilan,
   mengerti `{ response }` dan `choices[0].message.content`; bentuk tak dikenal =
   kegagalan panggilan, **tidak boleh** runtuh jadi `""`. Bobotnya naik dari
   "pengerasan" jadi **prasyarat** arsitektur 15, karena SEA-LION sudah memakai
   bentuk kedua hari ini.

**Yang diserahkan ke tiket lain:**

- Revisi ADR-0005 **§3** (aturan `anyOf`), **§6/§7** (dua kelas kegagalan +
  normalisasi). Ini butir **kelima** yang menunggu revisi ADR-0005 — bersama §1+§2
  dari [15](15-conversational-surface.md) dan §6 dari
  [28](28-transaction-gate-arity.md).
- Pelaksanaan slice-nya → [30](30-recovery-slice.md).

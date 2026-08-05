# 29 — Skema parsing ADR-0005 §3 ditolak model: `5024 JSON Model couldn't be met`

Type: grilling
Status: open
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

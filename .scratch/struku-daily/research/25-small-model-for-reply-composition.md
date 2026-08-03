# 25 — Model kecil untuk panggilan-2 (menyusun balasan) — temuan riset

Status: resolved
Ticket: [25](../issues/25-small-model-for-reply-composition.md)
Feeds: [15 · Permukaan percakapan](../issues/15-conversational-surface.md)
Tanggal: 2026-08-03

---

## Keterbatasan kanal — BACA INI SEBELUM MEMAKAI ANGKA DI BAWAH

Riset ini **tidak bisa** membaca halaman dokumentasi Cloudflare secara verbatim.

- `WebFetch` ke `developers.cloudflare.com` **diblokir egress policy (HTTP 403)**.
  Begitu pula `docs.mcp.cloudflare.com` (endpoint MCP yang disebut AGENTS.md),
  `www.cloudflare.com`, dan `huggingface.co`. `/root/.ccr/README.md` menyatakan 403
  adalah penolakan kebijakan organisasi yang **tidak boleh diakali atau di-retry** —
  jadi tidak ada upaya curl, proxy alternatif, atau pengulangan.
- Satu-satunya kanal yang bekerja: **`WebSearch` dengan
  `allowed_domains: ["developers.cloudflare.com"]`**. Ia benar-benar membaca halaman
  resmi hari ini, tapi mengembalikan **ringkasan, bukan tabel verbatim**. Tabel harga
  dan daftar panjang **konsisten terpotong**.

### Batas kepercayaan yang berlaku untuk seluruh dokumen ini

| Bentuk vonis | Kepercayaan | Alasan |
|---|---|---|
| "angkanya ada dan segini" | **kuat** | konfirmasi positif dari halaman resmi |
| "tidak ada di dokumentasi" | **lemah** | bisa berarti "tidak terekstrak ringkasan" |

Vonis negatif hanya dijatuhkan setelah **≥2 query berbeda** gagal memunculkannya
sementara angka tetangganya di halaman yang sama muncul mudah. Setiap vonis negatif
di bawah menyebutkan berapa query yang dicoba. **Yang tidak lolos syarat itu ditandai
`[TIDAK TERKONFIRMASI]`, bukan ditulis sebagai ketiadaan.**

### Kelas bukti

- **[DOC]** — dokumentasi Cloudflare terkini lewat `WebSearch`, satu URL per klaim.
- **[ADR-0005]** — angka **terukur repo ini sendiri** (spike
  `.scratch/struku-v1/research/05-parsing-spike/`). Bukan dokumentasi vendor; untuk
  perbandingan latency bobotnya justru **lebih tinggi** daripada [DOC], karena
  Cloudflare tidak menerbitkan angka latency sama sekali (§3b).
- **[TIDAK TERKONFIRMASI]** — tidak bisa dipastikan lewat kanal yang tersedia.
  **Tidak pernah diisi dari ingatan** — aturan STOP di AGENTS.md melarang pengetahuan
  pre-trained soal Workers AI jadi sumber.

### Sumber yang sengaja TIDAK dipakai

`.agents/skills/cloudflare/references/workers-ai/README.md` **tidak dipakai sebagai
sumber angka**. Riset tiket 21 menemukan file skill ter-vendor itu mengarang angka —
47% klaim numerik yang diadili tidak bisa dipertanggungjawabkan, dan yang paling licin
justru soal biaya neuron per model: baris 45–47 mengklaim *"llama-3.1-70b ~2000
neurons"*, padahal ADR-0005 §2 mengukur **~11 neuron/call** untuk 70B nyata — selisih
dua orde. §3a di bawah menunjukkan angka halaman pricing resmi **mendukung ADR-0005 dan
membantah file skill itu**.

### Verifikasi sesi induk (2026-08-03)

Temuan di bawah ditulis subagent riset dan **diperiksa ulang** sesi induk sebelum
tiket 25 di-resolve. Sesi induk kena blokir egress yang sama, jadi verifikasinya
lewat kanal yang sama — bukan kanal yang lebih baik.

**Berdiri setelah diperiksa ulang** (query independen):

- **Blokir egress** — dikonfirmasi langsung: `WebFetch` ke
  `developers.cloudflare.com/d1/platform/limits/` balas **403**, dan
  `$HTTPS_PROXY/__agentproxy/status` mencatat `developers.cloudflare.com:443`,
  `docs.mcp.cloudflare.com:443`, `www.cloudflare.com:443`, dan `huggingface.co:443`
  sebagai `connect_rejected` (*"policy denial"*).
- **`@cf/zai-org/glm-4.7-flash` ada di katalog**, 131.072 ctx, *"optimized for
  dialogue, instruction-following, and multi-turn tool calling across 100+
  languages"*, positioning *"fast inference optimized for low-latency responses"*.
- **`@cf/aisingapore/gemma-sea-lion-v4-27b-it` menyebut Indonesian dengan nama** —
  terkonfirmasi ulang: *"supports multiple South East Asian languages, including
  Burmese, English, **Indonesian**, Khmer, Lao, Malay, Mandarin, Tagalog, Tamil,
  Thai, and Vietnamese"*. Ini klaim paling penting di seluruh riset dan ia **kuat**.
- **Peringatan resmi JSON Mode** — terkonfirmasi verbatim: *"Workers AI can't
  guarantee that the model responds according to the requested JSON Schema."*
- **Daftar model JSON Mode memang tidak terekstrak lewat kanal ini** — pencarian
  independen sesi induk juga hanya mendapat *"there is a list of models that support
  JSON Mode"* tanpa isinya. Argumen §2b (daftar itu tidak boleh dipakai sebagai
  otoritas negatif) **berdiri**.

**Satu koreksi — dan ia mengenai kandidat utama, jadi baca.**

§2c dan § Rekomendasi menulis bahwa **halaman model GLM menyebut *"structured
outputs"***. Dua pencarian independen sesi induk **tidak bisa mengkonfirmasi frasa
itu ada di halaman model**. Yang muncul di halaman model: *"multi-turn tool
calling"* (kapabilitas nyata) dan *"excellent instruction following for code
generation and **structured tasks**"* — prosa pemasaran, bukan klaim fitur. Frasa
*"structured output"* muncul di tingkat **platform/adapter** (changelog:
*"Workers AI adapters support streaming chat completions with tool calling and
structured output"*), yang berlaku umum, bukan pernyataan per-model.

Ini **persis pola ketiga yang riset tiket 21 baru saja beri nama**: klaim resmi yang
benar, dipasang di kamar yang salah — dan pola itu disebut yang **paling sulit
dideteksi** justru karena frasanya memang ada di dokumentasi. Layak dicatat bahwa ia
muncul lagi di sini, dalam riset yang sudah diperingatkan soal itu.

**Akibatnya untuk keputusan:** sinyal `json_schema` GLM **turun dari "kuat" ke
"sedang"** — yang tersisa adalah tool calling (sinyal tidak langsung) plus dukungan
tingkat platform. **Kesimpulan §2b tidak berubah dan justru menguat**: pertanyaan 2
tiket 25 tidak bisa dijawab dokumentasi, hanya probe. Urutan probe pun tidak berubah
— GLM tetap dicoba lebih dulu karena unggul di sumbu lain (dialog, latency-positioning,
biaya) — tapi **`json_schema` harus jadi hal pertama yang diuji pada GLM**, bukan
diasumsikan lolos.

---

## 0. Ringkasan eksekutif — tiga hal yang membalik bentuk tiket

Tiket 25 mengasumsikan pilihannya adalah "70B vs sesuatu yang lebih kecil dari keluarga
Llama". Katalog Workers AI hari ini berbeda dari asumsi itu, dan tiga temuan membalik
prioritasnya:

1. **Ada model yang di-instruct-tune untuk Bahasa Indonesia.**
   `@cf/aisingapore/gemma-sea-lion-v4-27b-it` — dokumentasi Cloudflare menyebut
   **Indonesian dengan nama** [DOC]. Ini satu-satunya kandidat di mana risiko Bahasa
   Indonesia dari ADR-0005 ditangani *by design*, bukan diharapkan kebetulan.
2. **Model termurah bukan yang terkecil.** `@cf/meta/llama-3.2-3b-instruct` (3B) justru
   **lebih mahal per input token** daripada varian 8B fp8-fast [DOC]. Mengejar parameter
   count terkecil demi hemat adalah optimasi salah sasaran.
3. **Premis latency 15 butir 2 tidak terbukti.** Cloudflare **tidak mendokumentasikan
   latency** untuk model mana pun (§3b, lolos syarat ≥2 query). Jadi keyakinan "model
   lebih kecil = lebih cepat" — satu-satunya alasan 15 butir 2 memilih model kecil —
   **tidak punya dasar dokumentasi maupun pengukuran**. Ini bukan detail; ini menyentuh
   alasan tiket 25 ada.

**Konsekuensinya:** riset ini **tidak bisa memilih satu pemenang dari dokumentasi saja**.
Ia mempersempit dari 81 model ke 2 kandidat + 1 baseline, dan menyerahkan pilihan
finalnya ke probe yang sudah ditulis. Itu bukan kegagalan riset — pertanyaan tiket
nomor 3 dan 4 (latency, kualitas Bahasa Indonesia) memang **tidak dijawab dokumentasi
untuk model mana pun**, termasuk 70B; ADR-0005 sendiri baru bisa menjawabnya lewat spike.

---

## 1. Katalog hari ini (2026-08-03)

Katalog Workers AI menyebut **81 model** total [DOC],
https://developers.cloudflare.com/workers-ai/models/.

Kandidat yang relevan untuk "menyusun kalimat pendek dwibahasa id/en", **model id
persis apa adanya dari katalog**:

| Model id | Kelas | Catatan |
|---|---|---|
| `@cf/aisingapore/gemma-sea-lion-v4-27b-it` | 27B | **Indonesian disebut eksplisit** [DOC] |
| `@cf/zai-org/glm-4.7-flash` | lightweight/"flash" | multilingual 100+ bahasa, 131.072 ctx [DOC] |
| `@cf/meta/llama-3.1-8b-instruct-fast` | 8B | varian `-fast` **tetap aktif** saat varian polos dideprekasi [DOC] |
| `@cf/meta/llama-3.1-8b-instruct-fp8` | 8B | varian fp8 [DOC] |
| `@cf/meta/llama-3.2-3b-instruct` | 3B | "multilingual dialogue use cases" [DOC] |
| `@cf/meta/llama-3.2-1b-instruct` | 1B | ada di katalog [DOC] |
| `@cf/google/gemma-3-12b-it` | 12B | 128K ctx, 140+ bahasa [DOC] — ⚠️ status deprekasi bertentangan |
| `@cf/mistralai/mistral-small-3.1-24b-instruct` | 24B | 128k ctx, tool calling, `guided_json` [DOC] |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 70B | **baseline panggilan-1 hari ini** [ADR-0005] |

Model yang **ada di katalog tapi tidak relevan** untuk panggilan-2 (terlalu besar/mahal
untuk menyusun dua kalimat, atau bentuk output-nya lawan dari yang dibutuhkan):
`@cf/moonshotai/kimi-k2.6`, `@cf/moonshotai/kimi-k2.7`, `@cf/zai-org/glm-5.2`,
`@cf/google/gemma-4-26b-a4b-it`, `@cf/openai/gpt-oss-20b`,
`@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` (reasoning model — output panjang).

### ⚠️ Jebakan nama model — verifikasi id sebelum menempelkannya ke kode

Halaman **pricing** memuat baris untuk **`@cf/meta/llama-3.1-8b-instruct-fp8-fast`**
[DOC], tapi pencarian halaman **model** untuk id itu tidak menemukannya; yang punya
halaman sendiri adalah **`@cf/meta/llama-3.1-8b-instruct-fast`** dan
**`@cf/meta/llama-3.1-8b-instruct-fp8`** [DOC].

Dua kemungkinan: (a) id di halaman pricing memakai penamaan berbeda dari halaman model,
atau (b) ringkasan `WebSearch` mencampur dua baris. **Tidak bisa dibedakan lewat kanal
ini.** Yang penting: id yang salah **tidak akan gagal saat build** — ia gagal saat
runtime, persis kelas bug yang meninggalkan bekas luka di
[`workers-ai-text-parser.ts:94-102`](../../../src/worker/parsing/workers-ai-text-parser.ts)
(seluruh jalur parse jatuh ke `UNKNOWN_REPHRASE_RESULT` sementara model menjawab benar).
**Salin id dari katalog, jangan dari dokumen ini, dan buktikan lewat probe.**

### ⚠️ Deprekasi — jangan pilih model yang sedang disunset

Changelog **2026-05-08 "Planned model deprecations on Workers AI"** menyatakan
**18 model lama dideprekasi 30 Mei 2026** [DOC],
https://developers.cloudflare.com/changelog/post/2026-05-08-planned-model-deprecations/.

**Daftar lengkap 18 model itu tidak berhasil diekstrak** (4 query berbeda; ringkasan
selalu terpotong). Yang berhasil dikonfirmasi:

- `@cf/moonshotai/kimi-k2.5` → di-alias otomatis ke `@cf/moonshotai/kimi-k2.6`, dengan
  peringatan bahwa penggantinya **lebih mahal** [DOC].
- `@cf/meta/llama-3.1-8b-instruct` (varian **polos**, tanpa suffix) sedang dideprekasi;
  varian `-fast` tetap aktif [DOC],
  https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct/.
- `@cf/google/gemma-3-12b-it` — **status bertentangan antar-ringkasan**: satu query
  menempatkannya di daftar deprekasi, query lain menyatakannya masih aktif.
  **[TIDAK TERKONFIRMASI]** → perlakukan sebagai berisiko, jangan jadikan kandidat.

> **Item verifikasi wajib sebelum tiket 25 dikunci.** Pemilik repo harus membuka
> halaman deprekasi itu langsung (kanal ini tidak bisa) dan mencocokkan kandidat
> terpilih terhadap daftar 18 model. Memilih model yang sedang disunset berarti
> menanam tanggal kedaluwarsa ke dalam jalur yang, setelah 15 butir 3 + 4,
> **satu-satunya** yang membuat Struku bisa mencatat apa pun.

---

## 2. Dukungan `response_format: { type: "json_schema" }`

**Ini bagian paling rapuh dari riset ini.** Hasilnya bukan "ya/tidak" per kandidat,
melainkan sebuah temuan metodologis yang mengubah cara pertanyaan 2 harus dijawab.

### 2a. Apa yang dikatakan halaman fitur

[DOC], https://developers.cloudflare.com/workers-ai/features/json-mode/:

- JSON Mode **kompatibel dengan implementasi OpenAI**; diaktifkan lewat properti
  `response_format` dengan tipe `json_object` **atau** `json_schema`.
- Halaman memuat daftar model yang didukung, dengan kalimat *"We will continue extending
  this list to keep up with new, and requested models."*
- Model yang berhasil diekstrak dari daftar itu: `@cf/meta/llama-3.2-11b-vision-instruct`,
  `@hf/nousresearch/hermes-2-pro-mistral-7b`,
  `@hf/thebloke/deepseek-coder-6.7b-instruct-awq`,
  `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b`.
- **Peringatan resmi yang wajib masuk ADR:** *"Workers AI can't guarantee that the model
  responds according to the requested JSON Schema"*, dan model bisa gagal memenuhinya
  tergantung kompleksitas tugas serta kecukupan skema [DOC]. Ini **persis** vonis
  ADR-0005 (JSON mode = prior kuat, bukan jaminan skema) dan **masih berlaku hari ini** —
  jadi kontrak defensif ADR-0005 §7 (parse → Zod → satu retry → minta ulang) **tetap
  wajib** untuk panggilan-2, bukan hanya panggilan-1.
- **JSON Mode tidak mendukung streaming** [DOC]. Latency panggilan-2 = latency seluruh
  respons, sama seperti panggilan-1 [ADR-0005] §2. Ini menutup satu jalan keluar yang
  mungkin terpikir untuk cadangan 15 butir 2 ("kirim balasan dua tahap") — streaming
  parsial tidak tersedia selama JSON mode dipakai.

### 2b. Kenapa daftar itu TIDAK boleh dipakai sebagai daftar-larangan

`@cf/meta/llama-3.3-70b-instruct-fp8-fast` — model yang **repo ini pakai hari ini dengan
`response_format: json_schema` dan terbukti bekerja**
([`workers-ai-text-parser.ts:83-90`](../../../src/worker/parsing/workers-ai-text-parser.ts),
[ADR-0005] §2) — **tidak muncul** di daftar yang berhasil diekstrak.

Salah satu dari dua hal benar, dan **keduanya melarang** memakai daftar itu sebagai
otoritas negatif:

1. daftar di halaman fitur tertinggal dari katalog, atau
2. ringkasan `WebSearch` hanya mengekstrak sebagiannya.

**Konsekuensi:** untuk kandidat mana pun, *"tidak ada di daftar JSON Mode"* **bukan
bukti** bahwa ia tidak mendukung `json_schema`. Ini vonis negatif kelas lemah persis
seperti yang diperingatkan di § Keterbatasan kanal. **Pertanyaan 2 tiket 25 tidak bisa
dijawab dari dokumentasi — hanya dari probe.**

### 2c. Per kandidat

| Kandidat | Sinyal dari dokumentasi | Vonis |
|---|---|---|
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | terbukti empiris di repo ini | **didukung** [ADR-0005] |
| `@cf/zai-org/glm-4.7-flash` | halaman model menyebut *"multi-turn tool calling"* [DOC]; frasa *"structured output"* **hanya terverifikasi di tingkat platform/adapter, bukan halaman model** (koreksi sesi induk) | **sinyal sedang, belum diuji** |
| `@cf/mistralai/mistral-small-3.1-24b-instruct` | mengekspos `guided_json` — "a JSON schema that should be fulfilled for the response" [DOC] | **didukung, tapi lewat jalur berbeda** |
| `@cf/aisingapore/gemma-sea-lion-v4-27b-it` | tidak ada penyebutan JSON mode / structured output / function calling (2 query) | **[TIDAK TERKONFIRMASI]** ⚠️ |
| `@cf/meta/llama-3.1-8b-instruct-fast` | tidak terekstrak | **[TIDAK TERKONFIRMASI]** |
| `@cf/meta/llama-3.2-3b-instruct` | tidak terekstrak | **[TIDAK TERKONFIRMASI]** |

**Catatan `guided_json` — ongkos tersembunyi.** Mistral Small mengekspos JSON-schema
lewat parameter **`guided_json`**, bukan lewat `response_format` [DOC],
https://developers.cloudflare.com/workers-ai/models/mistral-small-3.1-24b-instruct/.
Kalau kandidat ini dipilih, **bentuk panggilannya berbeda** dari
`workers-ai-text-parser.ts` hari ini — bukan sekadar mengganti konstanta `MODEL`.
Panggilan-1 dan panggilan-2 akan memakai dua bentuk API yang berbeda, dan normalisasi
`.response` di baris 92–110 belum tentu berlaku untuk keduanya. Itu ongkos integrasi
nyata yang tidak terlihat dari tiket.

### 2d. Kalau kandidat terbaik ternyata TIDAK mendukung `json_schema`

Tiket 25 menyebut ini akan membatalkan kontrak `reply`+`summary` di 15 butir 5.
**Sebagian benar — tapi ada alternatif terdokumentasi, berurut preferensi:**

1. **`response_format: { type: "json_object" }`** — bagian resmi JSON Mode yang sama,
   hanya tanpa skema [DOC]. Untuk kontrak dua field flat ini nyaris cukup: yang mau
   ditegakkan cuma "dua string bernama `reply` dan `summary`", dan itu bisa dinyatakan
   di prompt. **Zod di sisi app tetap gerbang sebenarnya** — persis pola ADR-0005 §7,
   yang memang sudah tidak mempercayai model. Kehilangan `json_schema` di sini jauh
   lebih murah daripada di panggilan-1, karena panggilan-2 tidak punya enum kategori
   maupun tipe numerik yang harus ditegakkan.
2. **`guided_json`** untuk model yang mengekspornya (Mistral Small) [DOC].
3. **Function calling** — fitur terpisah dari JSON Mode [DOC],
   https://developers.cloudflare.com/workers-ai/features/function-calling/. Skema
   argumen tool dipakai sebagai pengganti response schema.
4. **Buang JSON sama sekali untuk panggilan-2.** Tidak ada di tiket, tapi layak
   ditimbang: `reply` + `summary` bisa dikembalikan sebagai teks polos dengan pemisah
   yang disepakati. Ini menghapus **seluruh** permukaan kegagalan JSON — dan panggilan-2
   **tidak menentukan uang tercatat** (itu panggilan-1), jadi toleransi kegagalannya
   jauh lebih tinggi. Dicatat supaya 15 butir 5 tidak dianggap satu-satunya bentuk yang
   mungkin. **Tidak direkomendasikan tanpa probe.**

**Vonis untuk 15 butir 5:** kontraknya **tidak batal**, tapi ia **belum terbukti untuk
model mana pun selain 70B**. Yang harus berubah di ADR bukan bentuk kontraknya,
melainkan pengakuan bahwa `json_schema` adalah *syarat seleksi kandidat*, bukan
properti yang bisa diasumsikan.

---

## 3. Biaya dan latency

### 3a. Biaya — angka resmi dari halaman pricing

Dasar: **$0,011 per 1.000 Neuron**, dengan **alokasi gratis 10.000 Neuron/hari** dan
reset harian pukul **00:00 UTC** [DOC],
https://developers.cloudflare.com/workers-ai/platform/pricing/.

| Model id | $/M input | $/M output | neuron/M input | neuron/M output |
|---|---|---|---|---|
| `@cf/meta/llama-3.1-8b-instruct-fp8-fast` ⚠️(id, §1) | $0,045 | $0,384 | **4.119** | **34.868** |
| `@cf/meta/llama-3.2-3b-instruct` | $0,051 | $0,335 | **4.625** | ~30.400 ⚠️ |
| `@cf/zai-org/glm-4.7-flash` | $0,060 | $0,400 | **5.500** | **36.400** |
| `@cf/aisingapore/gemma-sea-lion-v4-27b-it` | $0,351 | $0,555 | [TIDAK TERKONFIRMASI] | [TIDAK TERKONFIRMASI] |
| `@cf/meta/llama-3.1-70b-instruct-fp8-fast` *(proksi)* | $0,293 | $2,253 | **26.668** | **204.805** |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` *(dipakai repo)* | [TIDAK TERKONFIRMASI] | [TIDAK TERKONFIRMASI] | [TIDAK TERKONFIRMASI] | [TIDAK TERKONFIRMASI] |

⚠️ Angka neuron output 3B (`~30.400`) datang dari ringkasan yang **terpotong**;
perlakukan sebagai perkiraan, bukan fakta.

**Baris yang paling dibutuhkan justru yang hilang.** Harga persis
`@cf/meta/llama-3.3-70b-instruct-fp8-fast` — model yang **repo ini pakai hari ini** —
**tidak berhasil diekstrak dalam 5 query berbeda**, padahal baris tetangganya
(`llama-3.1-70b-instruct-fp8-fast`) muncul mudah dua kali. Ini lolos syarat ≥2 query
untuk mengatakan **ekstraksinya gagal**, tapi **bukan** untuk mengatakan angkanya tidak
ada. Baris 3.1-70B dipakai sebagai **proksi orde besaran** dan ditandai demikian di mana
pun ia muncul. **Jangan salin angka proksi itu ke ADR sebagai harga 3.3-70B.**

**Yang bisa disimpulkan dengan aman:**

- Turun dari kelas 70B ke kelas 8B/flash menghemat **~5–6× di input** (26.668 → 4.119
  neuron/M) dan **~5,6× di output** (204.805 → 34.868 neuron/M), memakai proksi 3.1-70B.
- **Perbedaan harga antar model kecil praktis tidak berarti.** 4.119 vs 4.625 vs 5.500
  neuron/M input adalah rentang ~33%. Pada volume satu bot personal, itu **nol rupiah**
  dalam praktik. **Karena itu biaya tidak boleh jadi tiebreaker antar kandidat kecil** —
  kualitas Bahasa Indonesia (§4) dan `json_schema` (§2) yang harus memutuskan.
- **3B lebih mahal per input token daripada 8B fp8-fast** (4.625 vs 4.119). Memilih model
  terkecil demi hemat tidak menghemat apa pun.
- **SEA-LION 27B bukan model murah.** $0,351/M input ≈ **7,8×** harga 8B fp8-fast, dan
  hanya ~1,2× lebih murah dari proksi 70B di sisi input — walau **~4× lebih murah di
  output** ($0,555 vs $2,253). Karena panggilan-2 punya **input relatif panjang**
  (system prompt persona + hasil business process + ringkasan sebelumnya) dan **output
  pendek** (dua kalimat + satu baris), profil biaya SEA-LION condong ke sisi yang salah.
  **Memilih SEA-LION berarti membeli kualitas Bahasa Indonesia, bukan menghemat** — dan
  itu harus ditulis jujur di ADR, karena 15 butir 2 memilih model kecil dengan alasan
  yang **bukan** kualitas bahasa.

**Anggaran alokasi gratis, sebagai konteks skala.** [ADR-0005] mengukur ~11 neuron/call
untuk 70B. Dengan 10.000 neuron/hari gratis [DOC], itu ≈ 900 panggilan/hari — atau
**≈450 pesan/hari** setelah 15 butir 2 menjadikannya dua panggilan per pesan. Untuk bot
satu orang, **biaya tidak akan pernah jadi kendala yang mengikat**. Ini memperkuat
kesimpulan di atas: seluruh §3a adalah informasi latar, bukan dasar keputusan.

**Sanity check terhadap [ADR-0005], dan terhadap file skill ter-vendor.** Dengan 26.668
neuron/M input (proksi 3.1-70B), **11 neuron ≈ ~400 token input** — orde yang persis
masuk akal untuk system prompt + satu pesan pendek. **Angka repo dan angka halaman
pricing resmi saling konsisten**, dan keduanya menunjukkan klaim *"~2000 neurons"* di
`.agents/skills/cloudflare/references/workers-ai/README.md:45-47` mustahil: 2.000 neuron
akan berarti ~75.000 token input untuk satu pesan `"warteg 25rb"`. **Temuan tiket 21
dikonfirmasi ulang dari arah yang berbeda.**

### 3b. Latency — apa yang benar-benar didokumentasikan

**Cloudflare tidak mendokumentasikan latency inference sebagai angka yang bisa
disandari, untuk model mana pun.**

Vonis negatif ini **lolos syarat ≥2 query**: dua query berbeda (satu soal
benchmark/TTFT/inference speed, satu soal SLA/response-time/guarantees) tidak
memunculkan satu pun angka latency untuk text generation, sementara angka tetangga di
halaman-halaman yang sama (harga, context window, limits, alokasi gratis) muncul mudah
di seluruh sesi ini [DOC].

Yang **ada**, dan kenapa keduanya tidak menolong:

- **Satu angka anekdotal di changelog, untuk model vision, bukan text-gen:** token
  pertama streaming kembali dalam ~20–30 ms untuk Moondream 3.1, dengan catatan eksplisit
  bahwa itu median client-observed termasuk network round trip dan *"actual latency
  depends heavily on the image and how much detail you ask for"* [DOC],
  https://developers.cloudflare.com/changelog/post/2026-07-08-moondream3.1-workers-ai/.
  **Tidak bisa dipindahkan ke kandidat mana pun di sini** — beda modalitas, beda metrik
  (TTFT streaming vs latency respons penuh), dan JSON mode tidak streaming (§2a).
- **Prompt caching** — fitur resmi yang secara eksplisit mengurangi TTFT (§3d).

Ini **mengonfirmasi ulang** premis ADR-0005 (*"Cloudflare publishes none"*) masih benar
pada 2026-08-03 — bukan sekadar diwarisi dari riset tiket 07.

### 3c. Anggaran dua panggilan berurutan vs NFR-PERF-01 (5–10s)

Yang **bisa** dihitung:

| Skenario | p50 | p95 | Sumber |
|---|---|---|---|
| Satu panggilan 70B (hari ini) | ~1,7s | ~2,4s | [ADR-0005] §2 |
| Dua panggilan 70B berurutan | ~3,4s | ~4,8s | turunan [ADR-0005] |
| Dua panggilan, **keduanya retry sekali** | — | **~9,6s** | turunan [ADR-0005] §7 |

Baris ketiga adalah **kasus terburuk yang tidak dihitung di 15 butir 2**, dan ia
mengubah penilaian "muat, tapi tipis" menjadi sesuatu yang lebih tajam: ADR-0005 §7
mengizinkan **satu retry per panggilan**, jadi worst case ≈ 4 × 2,4s ≈ **9,6s dari
anggaran 10s** — **tanpa margin sama sekali**, dan itu **sebelum** D1 + Telegram.
Dengan a-penuh (15 butir 3) tidak ada gerbang deterministik yang memotong jalur ini
lebih awal. **Ini harus masuk ADR sebagai konsekuensi yang diterima sadar, atau
kebijakan retry panggilan-2 harus dibedakan dari panggilan-1** (misalnya: panggilan-2
tidak retry sama sekali, langsung jatuh ke copy statis — jalur mundur yang 15 butir 4
memang sudah memutuskan tetap dipelihara).

Yang **TIDAK bisa disimpulkan** — ditandai tegas sesuai permintaan tiket:

- ❌ **Latency kandidat mana pun selain 70B.** Tidak ada angka terdokumentasi (§3b) dan
  tidak ada pengukuran repo. Asumsi "model lebih kecil = lebih cepat" **masuk akal tapi
  tidak terbukti**, dan pada platform serverless ia bisa salah: latency ditentukan juga
  oleh ketersediaan GPU dan antrian **per model**, bukan hanya ukuran parameter. Model
  kecil yang jarang dipakai bisa lebih lambat daripada model besar yang "panas".
- ❌ **Apakah pindah ke model kecil benar-benar menghemat waktu.** Penghematannya nyata
  di biaya (§3a, terdokumentasi) tapi **bisa nol atau negatif di latency**. Kalau probe
  menunjukkan begitu, **seluruh alasan 15 butir 2 memilih model kecil runtuh**, dan
  keputusan yang benar adalah **70B untuk kedua panggilan** — yang tiket 25 sendiri
  sudah tulis sebagai kemungkinan sah, dengan konsekuensi cadangan "kirim dua tahap"
  jadi lebih penting.
- ❌ **Latency di workerd asli.** 15 § Guardrail sudah menyatakan ini tidak akan terbukti
  sampai deploy terakhir. Probe `test:live` mengukur dari lingkungan test, bukan dari
  Worker yang men-deploy.
- ❌ **Apakah dua panggilan berurutan berperilaku sama dengan dua panggilan terpisah.**
  Tidak ada dokumentasi soal antrian/kontensi ketika satu invocation memanggil `env.AI`
  dua kali berturut-turut.

### 3d. Ungkitan latency yang terdokumentasi dan gratis: prompt caching

Temuan paling actionable di bagian latency, dan **tidak ada di tiket**.

Workers AI mengaktifkan **prefix caching secara default untuk model tertentu**; ia
*"reduces Time to First Token (TTFT) and increases Tokens Per Second (TPS) throughput by
reusing previously computed input tensors instead of reprocessing them from scratch"*
[DOC], https://developers.cloudflare.com/workers-ai/features/prompt-caching/.

Yang dinyatakan dokumentasi [DOC]:

- Kirim header **`x-session-affinity`** untuk mengarahkan request ke instance model yang
  sama dan memaksimalkan cache-hit lintas percakapan multi-turn.
- System prompt, definisi tool, dan instruksi bersama **di awal** prompt; konten
  dinamis (timestamp, query user) **di akhir**.
- ⚠️ *"Including a timestamp at the start of a system prompt changes the prefix on every
  request, defeating the cache entirely. If time context is required, add it to the user
  message instead."*
- **Cached input token ditagih dengan tarif diskon** dibanding input token biasa.

**Kenapa ini persis mengenai desain panggilan-2 Struku.** System prompt panggilan-2
**statis** (persona + aturan slot), sedangkan yang berubah tiap giliran adalah hasil
business process + ringkasan. Bentuk prompt di
[`test/live/reply-composer-probe.test.ts`](../../../test/live/reply-composer-probe.test.ts)
— system statis, user turn dinamis — **sudah benar** untuk prefix caching.

**Tapi ada jebakan yang mengancam 15 butir 6 secara langsung.** Butir 6 memutuskan nama,
locale, dan timezone user diumpankan ke prompt panggilan-2 **setiap giliran**, dan
memutuskan **reset ringkasan harian** (yang mengundang tanggal masuk prompt). Kalau
tanggal hari ini ditaruh di **system prompt**, prefix berubah setiap hari — dan kalau
timestamp yang lebih halus masuk, cache-nya rusak setiap request, persis contoh di
dokumentasi.

> **Aturan implementasi yang harus masuk ADR:** system prompt panggilan-2 memuat
> **hanya** persona + aturan slot + kontrak output. **Nama user, locale, tanggal, dan
> ringkasan berjalan masuk ke pesan user, tidak pernah ke system prompt.** Ini memberi
> penghematan TTFT **dan** neuron sekaligus, tanpa mengubah keputusan mana pun di 15.

⚠️ **Daftar model mana yang mendapat prefix caching default TIDAK berhasil diekstrak**
[TIDAK TERKONFIRMASI]. Jangan asumsikan kandidat terpilih termasuk; probe harus
memeriksanya (§ Butuh probe).

---

## 4. Kualitas Bahasa Indonesia — pembeda paling penting

Konteks: ADR-0005 mencatat `id` **tidak** ada di daftar bahasa resmi Meta untuk Llama,
dan risiko itu di-retire untuk 70B **hanya lewat spike empiris**, bukan lewat
dokumentasi. Panggilan-2 adalah **satu-satunya** teks yang dibaca user, jadi kegagalan
di sini tidak bisa disembunyikan app.

Catatan kanal: **`huggingface.co` diblokir**, jadi model card pembuat hanya terbaca
sejauh Cloudflare mengutipnya di halaman modelnya sendiri. Untuk kandidat yang model
card-nya hanya ada di HF, statusnya **[TIDAK TERKONFIRMASI]**, bukan "tidak mendukung".

| Kandidat | Indonesian eksplisit? | Bukti |
|---|---|---|
| `@cf/aisingapore/gemma-sea-lion-v4-27b-it` | ✅ **YA, dengan nama** | Daftar bahasa: Burmese, English, **Indonesian**, Khmer, Lao, Malay, Mandarin, Tagalog, Tamil, Thai, Vietnamese [DOC] |
| `@cf/zai-org/glm-4.7-flash` | ⚠️ tidak per-nama | "multilingual … across **100+ languages**" [DOC] |
| `@cf/google/gemma-3-12b-it` | ⚠️ tidak per-nama | "multilingual support in over **140 languages**" [DOC] |
| `@cf/meta/llama-3.2-3b-instruct` | ❌ tidak | "optimized for multilingual dialogue use cases", tanpa daftar [DOC] |
| `@cf/meta/llama-3.1-8b-instruct-fast` | ❌ tidak | "optimized for multilingual dialogue use cases", tanpa daftar [DOC] |
| `@cf/mistralai/mistral-small-3.1-24b-instruct` | ❌ tidak | halaman model **tidak memuat daftar bahasa** (2 query) [DOC] |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | ❌ tidak (**tapi terbukti empiris**) | [ADR-0005] §2: ekstraksi Indonesia akurat di spike |

### Tiga hal yang harus dibaca dari tabel ini

**1. SEA-LION adalah satu-satunya kandidat dengan jaminan dokumentasi, bukan inferensi.**
`@cf/aisingapore/gemma-sea-lion-v4-27b-it` di-*pretrain dan instruct-tune untuk kawasan
Asia Tenggara*; "SEA-LION" = *Southeast Asian Languages In One Network* [DOC],
https://developers.cloudflare.com/workers-ai/models/gemma-sea-lion-v4-27b-it/.
Untuk bot yang balasannya "mayoritas Bahasa Indonesia kasual", ini bukan detail kecil —
ini **satu-satunya tempat di seluruh riset ini di mana dokumentasi menjawab pertanyaan
tiket secara langsung**.

**2. "100+ / 140+ languages" bukan bukti Indonesian.** Klaim jumlah bahasa tanpa daftar
adalah klaim pemasaran vendor yang dikutip Cloudflare, bukan pernyataan dukungan `id`.
Diperlakukan sebagai **sinyal lemah** — lebih baik dari diam, jauh di bawah penyebutan
eksplisit. Persis jenis klaim yang membuat ADR-0005 tidak mempercayai daftar bahasa Meta
dan menuntut spike.

**3. Peringatan yang paling mudah terlewat, dan paling penting.** ADR-0005 me-retire
risiko Indonesian untuk **ekstraksi** (memahami `"warteg 25rb"`), **bukan** untuk
**generasi** (menulis kalimat kasual yang terasa ditulis manusia). Itu dua kemampuan
berbeda dengan mode gagal berbeda: ekstraksi yang buruk terlihat sebagai field salah dan
tertangkap Zod; generasi yang buruk terlihat sebagai **bahasa Indonesia kaku,
terjemahan-an, atau campur Inggris** — dan **tidak ada validator yang bisa
menangkapnya**. **Bukti ADR-0005 tidak bisa dipinjam ke panggilan-2**, bahkan kalau
model yang sama dipakai. Ini alasan tersendiri kenapa probe wajib, terpisah dari
pertanyaan latency.

---

## 5. `max_tokens` aman, dan batas terdokumentasi

### Default

**`max_tokens` default = 256**, tipe integer, konsisten lintas model text-generation
Workers AI (Gemma, Llama, GPT-OSS, dan lainnya); changelog menyatakan *"max_tokens now
correctly defaults to 256 as displayed on the model pages"* [DOC],
https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/.

Ini **mengonfirmasi independen** temuan [ADR-0005] §2 bahwa default 256 memotong output,
dan kode hari ini sudah mengaturnya ke 512
([`workers-ai-text-parser.ts:6`](../../../src/worker/parsing/workers-ai-text-parser.ts)).

### Aturan context window

*"The context window is defined as the tokens used in the prompt **plus** tokens used in
the response, and if your prompt plus response tokens exceed the context window, the
request will error"* [DOC],
https://developers.cloudflare.com/workers-ai/platform/limits/.

Context window adalah **anggaran gabungan**, bukan batas input saja — dan melampauinya
**error**, bukan terpotong diam-diam.

### Batas relevan lain dari halaman limits & pricing

| Batas | Nilai | Sumber |
|---|---|---|
| Alokasi gratis | **10.000 Neuron/hari** | [DOC] pricing |
| Reset | harian, **00:00 UTC** | [DOC] pricing |
| Harga di atas alokasi gratis | **$0,011 / 1.000 Neuron** (butuh Workers Paid) | [DOC] pricing |
| Rate limit per model/task type | terorganisasi per task type & model, **angkanya [TIDAK TERKONFIRMASI]** (2 query) | [DOC] limits |

### Context window per kandidat

| Kandidat | Context window |
|---|---|
| `@cf/zai-org/glm-4.7-flash` | **131.072** token [DOC] |
| `@cf/google/gemma-3-12b-it` | **128K** token [DOC] |
| `@cf/mistralai/mistral-small-3.1-24b-instruct` | **hingga 128k** token [DOC] |
| `@cf/aisingapore/gemma-sea-lion-v4-27b-it` | [TIDAK TERKONFIRMASI] (2 query) |
| `@cf/meta/llama-3.1-8b-instruct-fast` | [TIDAK TERKONFIRMASI] |
| `@cf/meta/llama-3.2-3b-instruct` | [TIDAK TERKONFIRMASI] |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | [TIDAK TERKONFIRMASI] |

**Batas max-output-token terpisah per model: [TIDAK TERKONFIRMASI].** Dokumentasi yang
terjangkau hanya menyatakan default `max_tokens` 256 dan aturan context window gabungan;
tidak ada batas output eksplisit per model yang berhasil diekstrak (2 query).

### Rekomendasi praktis untuk panggilan-2

**Context window bukan batas yang mengikat di sini.** Panggilan-2 memuat system prompt
pendek + hasil business process + satu baris ringkasan. Bahkan kandidat terkecil punya
ruang berlebih; 131k token adalah ~500× dari yang dibutuhkan.

Yang mengikat adalah `max_tokens`, dan **arahnya berlawanan dengan panggilan-1**:

- Panggilan-1 butuh `max_tokens` **besar** (512) karena skema ekstraksinya panjang.
- Panggilan-2 harus **sengaja kecil**: output yang diinginkan adalah dua kalimat + satu
  baris ringkasan. `max_tokens` kecil adalah **rem latency paling langsung** yang
  tersedia (tidak ada throughput SLA untuk disandari, §3b) dan sekaligus pagar terhadap
  model yang bertele-tele.

**Angka yang disarankan: `max_tokens` 256–384**, dengan **256 sebagai titik awal** justru
karena ia default terdokumentasi. ⚠️ **Ini rekomendasi teknik, bukan temuan dokumentasi.**

**Mode gagalnya spesifik dan lebih berbahaya daripada di panggilan-1.** Kalau `max_tokens`
terlalu kecil, `reply` selesai tapi **`summary` terpotong di tengah** → JSON tidak valid
→ ADR-0005 §7 memicu retry → latency dua kali lipat (§3c). Dan karena `summary` masuk ke
prompt giliran **berikutnya** (15 butir 5), truncation di sini **merusak giliran-giliran
sesudahnya**, bukan cuma satu balasan.

Dua mitigasi, keduanya murah:

1. **Taruh `summary` sebelum `reply` dalam urutan properti skema**, supaya truncation
   memakan bagian yang lebih mudah dideteksi — atau sebaliknya, taruh `reply` dulu kalau
   yang mau diselamatkan adalah balasan ke user. Pilih sadar; jangan biarkan urutannya
   kebetulan.
2. **Batasi panjang `summary` lewat instruksi eksplisit** ("satu kalimat, maksimal 20
   kata"). Prompt di
   [`test/live/reply-composer-probe.test.ts`](../../../test/live/reply-composer-probe.test.ts)
   sudah menulis *"a one-line running summary"* — pertahankan, dan pertimbangkan
   menambahkan batas kata numerik.

---

## Rekomendasi berperingkat

⚠️ **Peringkat ini menyusun urutan probe, bukan menutup keputusan.** Pertanyaan 3
(latency) dan 4 (kualitas generasi Bahasa Indonesia) **tidak dijawab dokumentasi untuk
model mana pun**, jadi tidak ada peringkat yang bisa dijatuhkan dari [DOC] saja.
Isi `CANDIDATES` di
[`test/live/reply-composer-probe.test.ts`](../../../test/live/reply-composer-probe.test.ts)
dengan urutan di bawah.

### Kandidat utama — `@cf/zai-org/glm-4.7-flash`

Satu-satunya kandidat yang **kuat di dua sumbu sekaligus**: dokumentasinya menyebut
*"multi-turn tool calling"* [DOC] (sinyal `json_schema` tidak langsung, **derajatnya
diturunkan sesi induk** — lihat § Verifikasi sesi induk; frasa *"structured outputs"*
tidak terverifikasi di halaman model), **dan** ia multilingual 100+ bahasa dengan positioning
eksplisit sebagai model **dialog cepat** — persis beban kerja panggilan-2. Biayanya
sekelas 8B (5.500 vs 4.119 neuron/M input — selisih yang tidak berarti pada volume ini,
§3a). Context window 131.072 token, jauh berlebih.

**Yang membatalkannya:**
- Probe menunjukkan ia **tidak menghormati `json_schema`** pada objek flat
  `{reply, summary}` → turun ke cadangan, atau pindah ke `json_object` (§2d).
- Bahasa Indonesia-nya terbaca **kaku/terjemahan-an** — "100+ languages" tanpa penyebutan
  `id` adalah sinyal lemah (§4), dan panggilan-2 adalah satu-satunya teks yang dibaca user.
- Ia **lebih lambat** daripada 70B dalam probe (mungkin — §3c menjelaskan kenapa ini bukan
  hipotesis konyol). Kalau begitu, alasan memilihnya hilang seluruhnya.
- Muncul di daftar 18 model yang dideprekasi 30 Mei 2026 (§1 — daftar itu belum terbaca).

### Cadangan — `@cf/aisingapore/gemma-sea-lion-v4-27b-it`

**Kandidat kualitas, bukan kandidat hemat.** Ini satu-satunya model di katalog yang
dokumentasi Cloudflare-nya **menyebut Indonesian dengan nama** [DOC], dan satu-satunya
tempat risiko bahasa dari ADR-0005 ditangani by design. Kalau probe menunjukkan Bahasa
Indonesia GLM terasa mesin sementara SEA-LION terasa manusia, **naikkan ini jadi utama
dan terima ongkosnya** — §3a menunjukkan biaya tidak akan pernah mengikat untuk bot satu
orang, jadi ongkos itu murah dibayar.

**Yang membatalkannya:**
- **Dukungan `json_schema`-nya [TIDAK TERKONFIRMASI]** (2 query) — ini risiko terbesarnya,
  dan probe harus mengujinya lebih dulu daripada kualitas bahasanya.
- 27B pada beban dua-kalimat kemungkinan **tidak lebih cepat** dari 70B, membatalkan
  alasan 15 butir 2 memilih model kecil. Kalau ia lolos kualitas tapi gagal latency,
  keputusan yang jujur adalah **70B untuk keduanya** (di bawah), bukan SEA-LION.
- Harga input **7,8× 8B** (§3a) — tidak mengikat hari ini, tapi harus tertulis di ADR
  supaya tidak jadi kejutan.

### Kandidat ketiga, hanya untuk kontrol — `@cf/meta/llama-3.1-8b-instruct-fast`

Masuk probe **bukan** karena diharapkan menang, melainkan sebagai **titik referensi
kelas 8B**: ia mengukur apakah "lebih kecil = lebih cepat" benar sama sekali di Workers
AI. Kalau 8B pun tidak lebih cepat dari 70B, temuan itu membunuh premis 15 butir 2 secara
langsung dan menghemat semua diskusi berikutnya.

⚠️ **Verifikasi id-nya lebih dulu** (§1 — halaman pricing dan halaman model memakai
penamaan yang tidak cocok: `-fp8-fast` vs `-fast`). Bahasa Indonesia-nya **tidak disebut
sama sekali** di dokumentasi [DOC]; jangan berharap banyak.

### Jawaban sah keempat — **tidak ada model kecil yang layak → 70B untuk kedua panggilan**

Tiket 25 sudah menuliskan ini sebagai kemungkinan, dan riset ini **memperkuat**
kemungkinannya alih-alih melemahkannya:

- Tidak ada dasar terdokumentasi bahwa model kecil lebih cepat (§3b) — dan itulah
  **satu-satunya** alasan 15 butir 2 memilihnya.
- Penghematan biaya nyata (§3a) tapi **tidak mengikat** — 10.000 neuron/hari gratis ≈ 450
  pesan/hari pada dua panggilan.
- 70B adalah satu-satunya model yang `json_schema`-nya **terbukti** di repo ini
  [ADR-0005], dan satu-satunya yang Bahasa Indonesia-nya sudah pernah dilihat bekerja.
- Anggaran p95 ~4,8s untuk dua panggilan 70B **muat** di NFR-PERF-01 [ADR-0005].

**Kalau ini yang dipilih**, konsekuensinya (sesuai tiket 25): 15 butir 2 kembali ke 70B
untuk keduanya, cadangan "kirim dua tahap" jadi lebih penting, dan kebijakan retry
panggilan-2 harus diperketat karena worst case ~9,6s (§3c). Keuntungan tambahan yang
tidak disebut tiket: **satu model untuk dua panggilan berarti satu bentuk API, satu
normalisasi `.response`, satu permukaan deprekasi** — dan mengingat bekas luka di
`workers-ai-text-parser.ts:94-102`, menyederhanakan seam itu punya nilai tersendiri.

---

## Yang HANYA bisa dibuktikan dengan memanggil model sungguhan

**Tidak ada kredensial Cloudflare di environment riset ini** — `wrangler whoami` =
not authenticated — jadi `npm run test:live` **mustahil dijalankan dari sini**.
[`test/live/reply-composer-probe.test.ts`](../../../test/live/reply-composer-probe.test.ts)
menunggu pemilik repo. Daftar berikut adalah **seluruh** pertanyaan yang riset
dokumentasi tidak bisa tutup:

1. **Apakah kandidat menghormati `response_format: json_schema`** pada objek flat
   `{reply, summary}`. Daftar model di halaman JSON Mode **terbukti tidak lengkap**
   (§2b) — 70B yang bekerja hari ini pun tidak ada di sana. **Tidak ada jalan lain
   selain memanggil.** ← *pertanyaan 2 tiket 25, tidak terjawab dokumentasi.*
2. **Apakah dua string sejajar memicu spiral whitespace** seperti skema bersarang di
   spike ADR-0005 §1. 15 butir 5 menulis *"kemungkinan besar aman"* dan menandainya
   belum diuji. Probe sudah punya pengecekan padding (baris 135–138).
3. **Latency tiap kandidat**, dan pertanyaan yang mendahuluinya: **apakah model lebih
   kecil benar-benar lebih cepat di Workers AI sama sekali.** ← *pertanyaan 3 tiket 25;
   §3b menunjukkan dokumentasi tidak menjawabnya untuk model mana pun.*
4. **Kualitas generasi Bahasa Indonesia** — bukan ekstraksi. Tidak ada validator yang
   bisa menangkap "Indonesia yang kaku" (§4); ini butuh **mata pemilik repo membaca
   transkripnya**, bukan assertion. ← *pertanyaan 4 tiket 25.*
5. **Disiplin slot** — apakah model membiarkan `{amount}` / `{category}` /
   `{total_harian}` apa adanya alih-alih menulis angka sendiri (15 butir 1). Probe sudah
   mengeceknya (baris 140–146). **Ini pemeriksaan keselamatan, bukan estetika**: bot
   keuangan yang mengarang angka adalah risiko yang melahirkan batasan itu.
6. **`max_tokens` aman yang sebenarnya** — pada nilai berapa `summary` mulai terpotong
   untuk tiap kandidat (§5). Angka 256–384 adalah rekomendasi teknik, bukan temuan.
7. **Bentuk `.response` yang dikembalikan binding per model.** Bekas luka
   `workers-ai-text-parser.ts:94-102` adalah kegagalan diam-diam di produksi yang lolos
   suite lokal hijau; **tidak ada jaminan normalisasi yang sama berlaku untuk model
   baru**, apalagi vendor baru (`@cf/zai-org/…`, `@cf/aisingapore/…`). Probe sudah
   menyalin normalisasi itu (baris 68–82) — kalau ia mengembalikan `""`, itu temuan,
   bukan bug probe.
8. **Model id-nya benar dan tidak dideprekasi.** §1 mencatat dua ketidakpastian nyata:
   penamaan `-fast` vs `-fp8-fast`, dan daftar 18 model deprekasi yang tidak terbaca.
   Panggilan sungguhan menyelesaikan yang pertama seketika.
9. **Apakah kandidat mendapat prefix caching default**, dan apakah `x-session-affinity`
   memberi perbedaan terukur (§3d). Daftar model-nya [TIDAK TERKONFIRMASI].

**Yang bahkan probe tidak bisa buktikan:** latency dua panggilan berurutan **di workerd
asli di bawah beban produksi**. 15 § Guardrail sudah menyatakan ini menumpuk sampai
deploy terakhir. Probe mempersempit risikonya; ia tidak menghapusnya.

---

## Sumber

Seluruhnya diakses **2026-08-03** lewat `WebSearch` dengan
`allowed_domains: ["developers.cloudflare.com"]` — lihat § Keterbatasan kanal untuk
bobot yang berlaku.

- https://developers.cloudflare.com/workers-ai/models/
- https://developers.cloudflare.com/workers-ai/features/json-mode/
- https://developers.cloudflare.com/workers-ai/features/function-calling/
- https://developers.cloudflare.com/workers-ai/features/prompt-caching/
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/workers-ai/platform/limits/
- https://developers.cloudflare.com/workers-ai/models/gemma-sea-lion-v4-27b-it/
- https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/
- https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/
- https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fast/
- https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct/
- https://developers.cloudflare.com/workers-ai/models/llama-3.2-3b-instruct/
- https://developers.cloudflare.com/workers-ai/models/gemma-3-12b-it/
- https://developers.cloudflare.com/workers-ai/models/mistral-small-3.1-24b-instruct/
- https://developers.cloudflare.com/changelog/post/2026-05-08-planned-model-deprecations/
- https://developers.cloudflare.com/changelog/post/2026-02-13-glm-47-flash-workers-ai/
- https://developers.cloudflare.com/changelog/post/2026-07-08-moondream3.1-workers-ai/

Sumber internal repo:

- [`docs/adr/0005-ai-text-parsing-contract.md`](../../../docs/adr/0005-ai-text-parsing-contract.md) — [ADR-0005]
- [`src/worker/parsing/workers-ai-text-parser.ts`](../../../src/worker/parsing/workers-ai-text-parser.ts)
- [`test/live/reply-composer-probe.test.ts`](../../../test/live/reply-composer-probe.test.ts)

**Tidak dipakai sebagai sumber angka:**
`.agents/skills/cloudflare/references/workers-ai/README.md` (lihat § Sumber yang sengaja
tidak dipakai, dan §3a untuk konfirmasi ulang temuan tiket 21).

# 21 — Seberapa luas dokumen skill yang divendor salah angka (temuan riset)

Status: resolved
Ticket: [21](../issues/21-vendored-skill-doc-reliability.md)
Feeds: keputusan mitigasi (kandidat tiket `grilling` — lihat bagian 6)
Tanggal: 2026-08-03

## Cara temuan ini diverifikasi

Satu kelas bukti saja di riset ini — tidak ada probe, karena yang diadili adalah
teks, bukan runtime.

- **[DOC]** — diambil hari ini dari `developers.cloudflare.com`, satu URL sumber
  per klaim, sesuai aturan STOP di AGENTS.md.
- **[DOC-14]** — angka yang sudah diambil langsung dari halaman resmi oleh
  [riset 14](14-d1-aggregate-query-capability.md) pada 2026-08-01 dan diwarisi
  ke sini tanpa pengambilan ulang.

> **Peringatan kanal yang harus dibaca sebelum memakai [DOC] di bawah.**
> `WebFetch` ke `developers.cloudflare.com` **diblokir kebijakan egress** di
> sesi ini — setiap URL (`/d1/platform/limits/`, `.../index.md`,
> `/durable-objects/platform/limits/`, dst.) balas **HTTP 403 dari proxy**, dan
> `curl` langsung gagal dengan `CONNECT tunnel failed, response 403`. Sesuai
> `/root/.ccr/README.md` blokir kebijakan **tidak diakali**. Kanal yang tersisa
> adalah `WebSearch` dengan `allowed_domains: ["developers.cloudflare.com"]`,
> yang **membaca halaman resminya hari ini** tapi mengembalikan ringkasan, bukan
> tabel verbatim.
>
> Konsekuensinya nyata dan harus dibawa ke setiap vonis di bawah: **vonis
> "TIDAK ADA DI DOKUMENTASI" di riset ini lebih lemah daripada di riset 14**,
> karena ketiadaan bisa saja berarti "tidak terekstrak oleh ringkasan search",
> bukan "tidak ada di halaman". Setiap vonis semacam itu di bawah hanya
> dijatuhkan kalau **dua atau lebih query berbeda** gagal memunculkan angkanya
> sementara angka tetangganya di tabel yang sama muncul dengan mudah. Vonis
> **COCOK** tidak terkena pelemahan ini — kalau angka resminya muncul dan sama,
> itu konfirmasi positif.

### Verifikasi sesi induk (2026-08-03)

Temuan di bawah ditulis oleh subagent riset dan **diperiksa ulang** oleh sesi
induk sebelum tiket 21 di-resolve. Yang bisa diperiksa lokal diperiksa; yang
bergantung pada `developers.cloudflare.com` **tidak bisa** — sesi induk kena
blokir egress yang sama.

**Berdiri setelah diperiksa:** seluruh pengukuran korpus (47.131 baris / 319
file; rincian per subdir cocok persis untuk ketujuhnya), `SKILL.md` 248 baris,
klaim bahwa `skills-lock.json` tidak menyimpan versi/tanggal/SHA upstream, isi
tabel `d1/gotchas.md:47-56` dan `workers-ai/README.md:45-47` apa adanya, dan
bahwa **tidak ada file skill yang disentuh** (`git status` bersih kecuali file
riset ini).

**Blokir egress dikonfirmasi independen, bukan diterima begitu saja.**
`WebFetch` ke `https://developers.cloudflare.com/d1/platform/limits/` balas
**403** dari sesi induk juga, dan `curl -sS "$HTTPS_PROXY/__agentproxy/status"`
mencatat `developers.cloudflare.com:443` sebagai `connect_rejected` — *"gateway
answered 403 to CONNECT (policy denial)"*. **`docs.mcp.cloudflare.com:443`
dan `www.cloudflare.com:443` juga ditolak.** Itu berarti **kedua kanal yang
AGENTS.md sendiri tunjuk** (halaman docs dan MCP `docs.mcp.cloudflare.com`)
tertutup di environment ini. `/root/.ccr/README.md` menyatakan 403 adalah
penolakan kebijakan organisasi yang **tidak boleh diakali, hanya dilaporkan** —
jadi subagent bertindak benar, dan `WebSearch` memang satu-satunya kanal tersisa.

**Empat koreksi:**

1. **`references/` berisi 63 subdirektori, bukan 61** (`find -maxdepth 1 -type d`,
   nol file di level atas). Angka 61 diwarisi dari badan tiket 21, tidak diukur
   ulang — ironi yang pantas dicatat di riset yang justru mengaudit angka
   warisan. Persentase permukaan tersampel bergeser tipis: 7/63 = **11,1%**
   subdir, dan yang tidak dipakai jadi **56**, bukan 54.
2. **Tabel "Plan Tier Limits" berisi 8 baris data, bukan 9** (baris 47-56 = judul
   + pemisah + 8 data). Ini **memperkuat**, bukan melemahkan: 5 dari **8** baris
   tanpa padanan resmi = **63%** satu tabel, bukan 56%.
3. **`computedHash` bukan SHA-256 dari `SKILL.md`.** Riset ini menduga hash-nya
   menunjuk `SKILL.md` sehingga pemangkasan `references/` aman. Diuji: sha256
   `SKILL.md` = `89bcccbb…`, sedangkan lockfile menyimpan `a1646a6a…`. Varian
   yang juga dicoba dan meleset: tanpa newline akhir, CRLF→LF, dan konkatenasi
   seluruh pohon. Jadi **apa yang dicakup hash itu tidak diketahui** — pertanyaan
   "apakah memangkas `references/` membatalkan lockfile" **tetap terbuka**, dan
   itu justru bahan grilling yang lebih tajam daripada dugaan semula.
4. **Lokasi kanoniknya `.agents/skills/cloudflare/`, bukan `.claude/skills/`.**
   `.claude/skills/*` adalah kumpulan symlink (`cloudflare -> ../../.agents/skills/cloudflare`);
   git melacak 320 file di bawah `.agents/skills/cloudflare/` dan hanya **satu**
   entri untuk symlink-nya. Path `file:baris` di bawah tetap resolve dan tidak
   perlu ditulis ulang, tapi siapa pun yang bertindak atas opsi mitigasi 1
   (memangkas) harus menyentuh `.agents/`, bukan `.claude/`.

**Satu penguatan.** Bagian 5 memparafrase `SKILL.md`; kalimat aslinya lebih keras
dan lebih tepat sasaran — `.agents/skills/cloudflare/SKILL.md:29`: *"When a
reference file and the docs disagree, **trust the docs**. This is especially
important for: **numeric limits, pricing tiers**, type signatures, and
configuration options."* Vendor-nya **menamai persis** dua kategori tempat riset
ini menemukan kegagalannya. Itu menggeser bentuk masalahnya: bukan "dokumen
vendor menyesatkan tanpa peringatan", melainkan "peringatannya ada, ditulis oleh
vendor sendiri, dan tetap tidak cukup" — karena peringatan hanya bekerja kalau
pembacanya punya alasan curiga, dan tabel bertier yang rapi menghapus alasan itu.

---

## 1. Penyebutnya — seberapa besar permukaan yang disampel

Skill `cloudflare` yang divendor, diukur hari ini:

| Ukuran | Nilai |
|---|---|
| Total `references/` | **47.131 baris**, **319 file**, **63 subdirektori** (dikoreksi — lihat Verifikasi sesi induk) |
| `SKILL.md` | 248 baris |
| Subdirektori yang benar-benar disentuh Struku | **7** dari 63 (`d1`, `workers`, `durable-objects`, `workers-ai`, `bindings`, `wrangler`, `miniflare`) |
| Baris di 7 subdir itu | **6.047 baris** (12,8% dari korpus) |
| File di 7 subdir itu | **36 file** (11,3% dari korpus) |

Rincian per subdir yang disampel:

| Subdir | File | Baris |
|---|---|---|
| `workers` | 6 | 1.020 |
| `durable-objects` | 5 | 930 |
| `wrangler` | 5 | 926 |
| `bindings` | 5 | 918 |
| `d1` | 5 | 807 |
| `miniflare` | 5 | 806 |
| `workers-ai` | 5 | 640 |

**Umur vendor.** `skills-lock.json` **tidak menyimpan versi, tanggal, atau commit
SHA upstream** — hanya `source: "cloudflare/skills"`, `skillPath`, dan
`computedHash`. Jadi umur konten tidak bisa dibaca dari lockfile. Yang bisa
dibaca: `git log` menunjukkan skill masuk repo ini **2026-07-31** (commit
`5fa95a7`, "chore(skills): add Cloudflare agent skills") — **tiga hari lalu**.
Itu penting untuk pertanyaan 2: **isi yang basi bukan karena vendor-nya lama
mengendap di repo ini**; kalau ada yang basi, ia sudah basi di hulu saat
divendor.

**Pemilihan sampel.** Grep pola angka + satuan lintas 7 subdir menghasilkan
**165 baris kandidat**; setelah membuang angka yang hidup di dalam contoh kode
(`max_batch_size: 10`, `maxRetries = 3`, dimensi embedding, nomor versi model),
tersisa **±90 klaim platform yang benar-benar bisa diadili**. Dari situ
**49 klaim diverifikasi satu per satu** (≈54% dari yang bisa diadili, ≈0,8% dari
seluruh korpus 47k baris), dipilih agar seimbang lintas 7 subdir **dan** lintas
genre file. Satu klaim tambahan (`bindings/gotchas.md:165`) masuk sampel tapi
**gagal diverifikasi** karena keterbatasan kanal — dicatat terpisah, tidak
dihitung.

---

## 2. Tabel sampel — 49 klaim, satu per satu

Vonis: **COCOK** · **TIDAK COCOK** (angka resminya beda) · **DIKARANG** (slot
limitnya tidak ada di dokumentasi sama sekali) · **TIDAK ADA DI DOKUMENTASI**
(angka berdiri tanpa sumber yang bisa ditemukan, tapi bukan format tabel
otoritatif) · **AMBIGU** (halaman resminya sendiri tidak tegas).

Pemisahan **DIKARANG** vs **TIDAK ADA DI DOKUMENTASI** memakai kriteria yang bisa
diperiksa orang lain: *apakah klaimnya disajikan sebagai baris tabel limit,
sering dengan pembedaan free/paid?* Kalau ya → **DIKARANG** (ia meniru bentuk
dokumen resmi). Kalau ia cuma kalimat prosa → **TIDAK ADA DI DOKUMENTASI**.

### 2a. Genre `gotchas.md` (34 klaim)

| # | Klaim | Lokasi | Kata dokumentasi resmi | Vonis |
|---|---|---|---|---|
| G1 | Database size 500 MB free / 10 GB paid | `d1/gotchas.md:49` | Free 500 MB per database, 10 GB paid — https://developers.cloudflare.com/d1/platform/limits/ [DOC] | COCOK |
| G2 | **Row size 1 MB (free & paid)** | `d1/gotchas.md:50` | Maximum row size **2.000.000 byte (2 MB)** — https://developers.cloudflare.com/d1/platform/limits/ [DOC-14] | **TIDAK COCOK** |
| G3 | Query timeout 30s | `d1/gotchas.md:51` | Maximum query duration 30 detik — https://developers.cloudflare.com/d1/platform/limits/ [DOC-14] | COCOK |
| G4 | **"30s (900s with sessions)"** | `d1/gotchas.md:51` | Tidak ada timeout diperpanjang lewat Sessions API di mana pun; Sessions API dijelaskan sebagai mekanisme konsistensi read replica, bukan perpanjangan durasi — https://developers.cloudflare.com/d1/best-practices/read-replication/ [DOC] | **DIKARANG** |
| G5 | **Batch size 1.000 statements (free) / 10.000 (paid)** | `d1/gotchas.md:52` | Tidak ada batas jumlah statement per batch. Yang ada: "the maximum SQL statement length of 100 KB applies to each statement inside a `db.batch()`" — https://developers.cloudflare.com/d1/platform/limits/ [DOC] | **DIKARANG** |
| G6 | Time Travel 7 hari free / 30 hari paid | `d1/gotchas.md:53` | "restore a D1 database back to any minute within the last 30 days (Workers Paid) or 7 days (Workers Free)" — https://developers.cloudflare.com/d1/reference/time-travel/ [DOC] | COCOK |
| G7 | **Sessions API: ❌ free / ✅ "Up to 15 min" paid** | `d1/gotchas.md:55` | Sessions API adalah bagian dari D1 Worker Binding, tidak digerbangi tier dan tidak punya batas durasi terdokumentasi ("does not specify a time-based limit") — https://developers.cloudflare.com/d1/best-practices/read-replication/ [DOC] | **DIKARANG** |
| G8 | **Concurrent requests 10.000/min (free)** | `d1/gotchas.md:56` | Tidak ada limit request-per-menit di halaman limits. Batas konkurensi yang ada: "you can open up to six connections simultaneously for each invocation of your Worker" — https://developers.cloudflare.com/d1/platform/limits/ [DOC] | **DIKARANG** |
| G9 | Replication lag 100 ms–2 s | `d1/gotchas.md:72` | Halaman read replication membahas konsistensi sequential, tidak menyebut angka lag — https://developers.cloudflare.com/d1/best-practices/read-replication/ [DOC] | TIDAK ADA DI DOKUMENTASI |
| G10 | Request size 100 MB | `workers/gotchas.md:122` | "Free and Pro plans: 100 MB; Business: 200 MB; Enterprise: 500 MB" — https://developers.cloudflare.com/workers/platform/limits/ [DOC] | COCOK (tanpa varian tier) |
| G11 | CPU time Free 10 ms | `workers/gotchas.md:124` | Satu penelusuran memunculkan "the Workers Free plan has a 10 ms CPU time limit"; penelusuran kedua atas halaman yang sama tidak bisa mengkonfirmasi angka itu dan hanya memunculkan warisan 50 ms Bundled — https://developers.cloudflare.com/workers/platform/limits/ [DOC] | **AMBIGU** |
| G12 | Subrequests 50 free / 10.000 paid | `workers/gotchas.md:126-127` | "Free plan, subrequests are limited to 50/request"; paid "limited to 10,000 subrequests per invocation by default" — https://developers.cloudflare.com/changelog/post/2026-02-11-subrequests-limit/ [DOC] | COCOK |
| G13 | KV value size 25 MiB | `workers/gotchas.md:129` | Batas nilai KV 25 MB/MiB — https://developers.cloudflare.com/kv/platform/limits/ [DOC] | COCOK |
| G14 | Environment variable size 5 KB | `workers/gotchas.md:130` | "Environment variable size is limited to 5 KB for both free and paid plans" — https://developers.cloudflare.com/workers/platform/limits/ [DOC] | COCOK |
| G15 | SQLite storage per DO 10 GB | `durable-objects/gotchas.md:169` | "Each SQLite-backed Durable Object has a storage limit of 10 GB on a Workers Paid plan" — https://developers.cloudflare.com/durable-objects/platform/limits/ [DOC] | COCOK |
| G16 | SQLite total 5 GB free / Unlimited paid | `durable-objects/gotchas.md:170` | "Accounts on the Workers Free plan are limited to 5 GB total Durable Objects storage" — https://developers.cloudflare.com/durable-objects/platform/limits/ [DOC] | COCOK |
| G17 | Key+value size 2 MB "(SQLite/async)" | `durable-objects/gotchas.md:171` | Dokumentasi memisahkan backend: untuk DO ber-backend KV, "the 128 KiB (131072 bytes) value-size limit"; batas SQLite-backed tidak muncul di ringkasan. Label gabungan "SQLite/async" tidak punya padanan resmi — https://developers.cloudflare.com/durable-objects/platform/limits/ [DOC] | **AMBIGU** |
| G18 | WebSocket message 32 MiB | `durable-objects/gotchas.md:177` | "maximum WebSocket message size limit has been increased from 1 MiB to 32 MiB" — https://developers.cloudflare.com/durable-objects/platform/limits/ [DOC] | COCOK |
| G19 | ~1K req/s per DO (soft limit) | `durable-objects/gotchas.md:178` | "An individual Object has a soft limit of 1,000 requests per second" — https://developers.cloudflare.com/durable-objects/platform/limits/ [DOC] | COCOK |
| G20 | Memory per DO 128 MB | `durable-objects/gotchas.md:182` | "the 128 MB of memory your Durable Object is allocated" — https://developers.cloudflare.com/durable-objects/platform/pricing/ [DOC] | COCOK |
| G21 | **Bindings per Worker: 64 total** | `bindings/gotchas.md:158` (juga `bindings/README.md:109`, `configuration.md:179`) | Angka 64 milik **environment variables** dan hanya untuk Free: "128 variables on the Workers Paid plan, and 64 variables on the Workers Free plan" — https://developers.cloudflare.com/workers/platform/limits/ [DOC] | **TIDAK COCOK** |
| G22 | R2 object size 5 TB | `bindings/gotchas.md:166` | "The object size limit is 5 GiB less than 5 TiB, so **4.995 TiB**" — https://developers.cloudflare.com/r2/platform/limits/ [DOC] | **AMBIGU** (pembulatan, arah aman) |
| G23 | **D1 rows per query 100.000 ("result set limit")** | `bindings/gotchas.md:169` | Tidak ada batas jumlah baris hasil query di halaman limits; yang ada hanya panduan prosa "break the work into smaller chunks (e.g., processing 1,000 rows at a time)" — https://developers.cloudflare.com/d1/platform/limits/ [DOC]. Riset 14 juga menyimpulkan hal sama secara mandiri [DOC-14] | **DIKARANG** |
| G24 | D1 databases 10 (free) | `bindings/gotchas.md:170` | "Workers Free plan ... can create up to 10 databases per account" — https://developers.cloudflare.com/d1/platform/limits/ [DOC] | COCOK |
| G25 | Queue batch size 100 messages "per consumer batch" | `bindings/gotchas.md:171` | 100 adalah batas **producer** `sendBatch()`; batch konsumen default 10 dan dikonfigurasi lewat `max_batch_size` — https://developers.cloudflare.com/queues/platform/limits/ [DOC] | **AMBIGU** (angka ada, labelnya salah kamar) |
| G26 | Queue message size 128 KB | `bindings/gotchas.md:172` | "Individual messages are limited to 128 KB each" — https://developers.cloudflare.com/queues/platform/limits/ [DOC] | COCOK |
| G27 | Config file size ~1 MB | `wrangler/gotchas.md:130` | Tidak ditemukan batas ukuran file konfigurasi wrangler di dokumentasi — https://developers.cloudflare.com/workers/wrangler/configuration/ [DOC] | TIDAK ADA DI DOKUMENTASI |
| G28 | **Workers Assets size 25 MB "per deployment"** | `wrangler/gotchas.md:131` | 25 MiB adalah batas **per file**, bukan per deployment: "The individual file size limit of 25 MiB remains unchanged" — https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/ [DOC] | **TIDAK COCOK** |
| G29 | **Workers Assets files 20.000 (tanpa tier)** | `wrangler/gotchas.md:132` | 20.000 hanya berlaku Free; "paid and Workers for Platforms users can now upload up to **100,000** static assets per Worker version, up from the previous limit of 20,000" — https://developers.cloudflare.com/changelog/2025-09-02-increased-static-asset-limits/ [DOC] | **TIDAK COCOK** (basi) |
| G30 | **Script size (compressed) 1 MB free / 10 MB paid** | `wrangler/gotchas.md:133` | "Worker size is limited to **3 MB** on the free plan and 10 MB on paid plans" — https://developers.cloudflare.com/workers/platform/limits/ [DOC] | **TIDAK COCOK** (basi) |
| G31 | CPU 10 ms free / 30s default (5min max) paid | `wrangler/gotchas.md:134` | Sama dengan G11 untuk sisi free; sisi paid: "5 min for HTTP requests and 15 min for Cron Triggers" — https://developers.cloudflare.com/workers/platform/limits/ [DOC] | **AMBIGU** |
| G32 | Subrequest 50 free / 10.000 paid | `wrangler/gotchas.md:135` | Sama dengan G12 — https://developers.cloudflare.com/changelog/post/2026-02-11-subrequests-limit/ [DOC] | COCOK |
| G33 | Free tier 10.000 neurons/day | `workers-ai/gotchas.md:56` | "a free allocation of 10,000 Neurons per day. All limits reset daily at 00:00 UTC" — https://developers.cloudflare.com/workers-ai/platform/pricing/ [DOC] | COCOK |
| G34 | **"Check context limits (2K-8K tokens)"** | `workers-ai/gotchas.md:71` | Context window didokumentasikan per model dan jauh lebih besar — mis. `llama-3.2-1b-instruct` "context window set to 60,000" — https://developers.cloudflare.com/workers-ai/models/ [DOC] | **TIDAK COCOK** (basi) |

*(G35 `miniflare/gotchas.md:155` dipindah ke tabel 2b bersama pasangannya —
lihat R14/R15.)*

### 2b. Genre halaman referensi (`README.md` / `api.md` / `configuration.md` / `patterns.md`) — 15 klaim

| # | Klaim | Lokasi | Kata dokumentasi resmi | Vonis |
|---|---|---|---|---|
| R1 | Free: rows read 5 juta/hari | `d1/configuration.md:171` | "Rows read: 5 million / day" — https://developers.cloudflare.com/d1/platform/pricing/ [DOC] | COCOK |
| R2 | Free: rows written 100.000/hari | `d1/configuration.md:172` | "Rows written: 100,000 / day" — https://developers.cloudflare.com/d1/platform/pricing/ [DOC] | COCOK |
| R3 | Free storage 5 GB; included paid 25 miliar baris baca / 50 juta baris tulis per bulan | `d1/configuration.md:171-173` | "Storage: 5 GB (total)"; "First 25 billion / month included"; "First 50 million / month included" — https://developers.cloudflare.com/d1/platform/pricing/ [DOC] | COCOK |
| R4 | **Batch size 1.000 / 10.000 statements** | `d1/configuration.md:175` | Sama dengan G5 — tidak ada di halaman limits — https://developers.cloudflare.com/d1/platform/limits/ [DOC] | **DIKARANG** |
| R5 | $0,001/juta baris baca + $1,00/juta baris tulis + $0,75/GB-bulan | `d1/configuration.md:181` (juga `README.md:83`) | "$0.001 / million rows"; "$1.00 / million rows"; "$0.75 / GB-mo" — https://developers.cloudflare.com/d1/platform/pricing/ [DOC] | COCOK |
| R6 | **Row size 1 MB max (free & paid)** | `d1/README.md:77` | Sama dengan G2 — resmi 2.000.000 byte — https://developers.cloudflare.com/d1/platform/limits/ [DOC-14] | **TIDAK COCOK** |
| R7 | **Batch size 1.000 / 10.000 statements** | `d1/README.md:79` | Sama dengan G5/R4 — https://developers.cloudflare.com/d1/platform/limits/ [DOC] | **DIKARANG** |
| R8 | **Session "up to 15 minutes"** | `d1/README.md:52`, `d1/api.md:71` | Sama dengan G7 — tidak ada batas durasi sesi terdokumentasi — https://developers.cloudflare.com/d1/best-practices/read-replication/ [DOC] | **DIKARANG** |
| R9 | Cold start "< 1ms" | `workers/README.md:8` | Angka ini tidak muncul di halaman limits maupun overview; dokumentasi berbicara soal isolate tanpa mengklaim angka sub-milidetik — https://developers.cloudflare.com/workers/platform/limits/ [DOC] | TIDAK ADA DI DOKUMENTASI |
| R10 | "50+ pre-trained models" | `workers-ai/README.md:8` | "Workers AI gives you access to **50+** open-source models" — https://developers.cloudflare.com/workers-ai/ [DOC] | COCOK |
| R11 | Cold start model 1–3 s, request berikutnya ~100–500 ms | `workers-ai/README.md:15`, `api.md:112` | Tidak ada angka latensi cold start model di dokumentasi Workers AI — https://developers.cloudflare.com/workers-ai/ [DOC] | TIDAK ADA DI DOKUMENTASI |
| R12 | **Biaya per model: llama-3.1-70b "~2000 neurons", llama-3.1-8b "~200 neurons", mistral-7b "~50 neurons", SDXL "~10.000 neurons"** | `workers-ai/README.md:45-47, 67` (juga `patterns.md:113`, `gotchas.md:53`) | Pricing Workers AI dinyatakan **per juta token**, dengan kolom neuron sebagai konversi ("The Price in Tokens column is equivalent to the Price in Neurons column"). Tidak ada angka "neuron per request" per model seperti ini di mana pun — https://developers.cloudflare.com/workers-ai/platform/pricing/ [DOC] | **DIKARANG** |
| R13 | Neurons/day free 10.000 | `workers-ai/README.md:130` | Sama dengan G33 — https://developers.cloudflare.com/workers-ai/platform/pricing/ [DOC] | COCOK |
| R14 | **D1 "100k rows per query"** | `bindings/patterns.md:157` | Sama dengan G23 — tidak ada batas result set — https://developers.cloudflare.com/d1/platform/limits/ [DOC] | **DIKARANG** |
| R15 | Opsi Miniflare `scriptTimeout` (CPU 30s) dan `workersConcurrencyLimit: 10` | `miniflare/gotchas.md:155`, `miniflare/configuration.md:138-139` | Dua penelusuran berbeda atas dokumentasi Miniflare tidak memunculkan opsi `scriptTimeout` maupun `workersConcurrencyLimit` — https://developers.cloudflare.com/workers/testing/miniflare/ [DOC] | TIDAK ADA DI DOKUMENTASI |

### 2c. Klaim yang gagal diverifikasi (tidak dihitung)

| Klaim | Lokasi | Kenapa gagal |
|---|---|---|
| "KV operations 1000 reads/day (Free tier only)" | `bindings/gotchas.md:165` | Empat query berbeda ke `/kv/platform/pricing/` dan `/kv/platform/limits/` **tidak berhasil mengekstrak tabel kuota harian free tier KV** — halaman ditemukan, isinya tidak. Karena angka ini terlihat mencurigakan (skala 10³ untuk kuota baca harian jauh di bawah kuota tulis produk sejenis), ia layak diverifikasi ulang begitu `WebFetch` ke host ini terbuka. Dicatat sebagai **belum diadili**, bukan sebagai temuan. |
| KV key size 512 byte, KV writes 1/detik per key, secret size 1 KB | `bindings/gotchas.md:161,163,160` | Sama — tabel limit KV tidak terekstrak lewat kanal search. Dikeluarkan dari sampel supaya tidak ada vonis yang berdiri di atas kegagalan alat. |

---

## 3. Hitungan per pola

### 3a. Vonis mentah (49 klaim)

| Vonis | Jumlah | % |
|---|---|---|
| COCOK | 22 | 45% |
| TIDAK COCOK | 7 | 14% |
| DIKARANG | 10 | 20% |
| TIDAK ADA DI DOKUMENTASI | 6 | 12% |
| AMBIGU | 4 | 8% |
| **Bermasalah (3 kategori tengah)** | **23** | **47%** |

**Hampir satu dari dua klaim numerik yang diadili tidak bisa dipertanggungjawabkan
ke halaman resmi.** Kalau AMBIGU dihitung sebagai "aman", angka bermasalahnya
tetap 47%; kalau AMBIGU dihitung sebagai "tidak bisa dipercaya tanpa cek", jadi
55%.

### 3b. Basi vs dikarang — pembedaan yang diminta pertanyaan 2

Ini pembelahan yang paling penting di riset ini, dan hasilnya bukan yang
diperkirakan tiket.

**Pola A — angka basi (pernah benar, dokumen bergerak): 5 klaim.**

| Klaim | Dulu | Sekarang |
|---|---|---|
| Script size free (G30) | 1 MB | **3 MB** |
| Workers Assets files (G29) | 20.000 untuk semua | 20.000 free / **100.000 paid** (naik 2025-09-02) |
| Context window Workers AI (G34) | 2K–8K token | puluhan ribu token, per model |
| Row size D1 (G2, R6) | 1 MB | **2 MB** |

Semuanya bergerak **ke arah yang sama**: batas naik, dokumen skill tertinggal.
Konsekuensi praktisnya **konservatif** — agent yang percaya angka basi akan
membangun sesuatu yang lebih kecil/lebih hati-hati dari yang diizinkan. Merugikan,
tapi tidak merusak.

**Pola B — angka dikarang (slot limitnya tidak pernah ada): 16 klaim.**

Dipecah lagi menurut seberapa otoritatif penyajiannya:

| Sub-pola | Jumlah | Contoh |
|---|---|---|
| **Dikarang dalam format tabel bertier free/paid** | 10 | Batch size 1.000/10.000 (muncul **3×**: G5, R4, R7); Sessions API "❌ free / ✅ 15 min" (G7, R8); Concurrent requests 10.000/min (G8); "900s with sessions" (G4); D1 rows per query 100.000 (G23, R14); biaya neuron per model (R12) |
| **Dikarang dalam prosa** | 6 | Replication lag 100 ms–2 s (G9); config file ~1 MB (G27); cold start Workers <1 ms (R9); cold start Workers AI 1–3 s (R11); opsi Miniflare `scriptTimeout`/`workersConcurrencyLimit` (R15) |

**Dikarang mengalahkan basi lebih dari 3:1 (16 vs 5).** Dan kekhawatiran spesifik
tiket terkonfirmasi: **10 dari 16 karangan disajikan dalam bentuk tabel bertier**
— bentuk yang paling terbaca sebagai hasil membaca halaman resmi. Tabel "Plan
Tier Limits" di `d1/gotchas.md:47-56` berisi **8 baris data** (dikoreksi dari 9),
dan **5 di antaranya tidak punya padanan resmi sama sekali** — **63% satu tabel
tunggal**. Ini bukan dokumen yang ketinggalan
zaman; ini dokumen yang **membuat kolom yang tidak ada di sumbernya**.

Tiga klaim TIDAK COCOK sisanya (G21, G28, dan sebagian G25) bukan basi maupun
murni dikarang, melainkan **pola ketiga: angka resmi dipasang di kamar yang
salah** — 64 (env var free) dilabeli "bindings"; 25 MiB (per file) dilabeli "per
deployment"; 100 (producer batch) dilabeli "per consumer batch". Ini pola paling
sulit dideteksi, karena angkanya *ada* di dokumentasi dan akan lolos pencarian
sepintas.

**Penyebaran.** Tiga karangan yang sama muncul di lebih dari satu file
(batch size 3×, session 15 menit 3×, rows per query 2×, 64 bindings 3×). Jadi
tidak ada satu file "buruk" yang bisa dikarantina — karangan yang sama
direplikasi lintas `gotchas.md`, `README.md`, `configuration.md`, `api.md`, dan
`patterns.md` di dalam satu subdir.

### 3c. Per subdirektori

| Subdir | Disampel | COCOK | Bermasalah | Rasio bermasalah |
|---|---|---|---|---|
| `d1` | 15 | 7 | 8 | 53% |
| `durable-objects` | 6 | 5 | 0 (1 ambigu) | **0%** |
| `workers` | 6 | 4 | 1 (1 ambigu) | 17% |
| `wrangler` | 6 | 1 | 4 (1 ambigu) | 67% |
| `bindings` | 7 | 3 | 2 (2 ambigu) | 29% |
| `workers-ai` | 6 | 3 | 3 | 50% |
| `miniflare` | 1 | 0 | 1 | 100% |

`durable-objects` bersih sempurna pada 6 klaim (termasuk dua angka yang **baru
berubah**: WebSocket 32 MiB dan storage 10 GB — dokumen ini justru *lebih* segar
dari `wrangler`). `wrangler` dan `d1` yang paling buruk. Sampel per subdir kecil
(1–15), jadi ini indikasi arah, bukan peringkat yang kokoh.

---

## 4. Jawaban tegas untuk pertanyaan 3: apakah `d1/gotchas.md` anomali?

**Tidak. Ia mewakili — dan hipotesis genre tidak terbukti.**

| Genre | Disampel | COCOK | Bermasalah | Rasio bermasalah |
|---|---|---|---|---|
| `gotchas.md` | 34 | 16 (47%) | 14 | **41%** |
| Halaman referensi (`README`/`api`/`configuration`/`patterns`) | 15 | 6 (40%) | 9 | **60%** |

**Halaman referensi biasa justru lebih sering salah daripada `gotchas.md`, bukan
lebih jarang.** Arah temuannya berlawanan dengan dugaan tiket. Dan pembelahannya
sama tidak menguntungkan pada pola yang berbahaya: dari 15 klaim halaman
referensi, **5 adalah karangan** (33%), dibanding 15 dari 34 di `gotchas.md`
(44%) — dua-duanya tinggi.

Tiga alasan kenapa hipotesis genre harus ditolak, bukan sekadar "tidak
terdukung":

1. **Karangannya identik lintas genre.** "Batch size 1.000/10.000" hidup di
   `gotchas.md:52`, `README.md:79`, **dan** `configuration.md:175`. "Session up
   to 15 minutes" hidup di `gotchas.md:55`, `README.md:52`, **dan** `api.md:71`.
   Kalau `gotchas.md` adalah genre "rangkuman lisan dari ingatan", isi ingatan
   yang sama sudah menyebar ke halaman yang dianggap otoritatif.
2. **`gotchas.md` justru memuat beberapa angka paling segar di korpus.**
   `durable-objects/gotchas.md:177` menyebut WebSocket 32 MiB — perubahan
   yang baru; `workers/gotchas.md:126-127` menyebut 10.000 subrequest paid —
   sesuai changelog 2026-02-11. Genre ini bukan tempat sampah angka lama.
3. **Kegagalan terburuk dalam sampel bukan di `gotchas.md`.** Biaya neuron
   per model (R12) — angka yang paling mungkin dipakai untuk memilih model di
   Struku — ada di `workers-ai/README.md`, file pertama yang dibaca agent saat
   masuk subdir itu.

**Konsekuensi mitigasi:** menyasar genre `gotchas.md` **tidak akan bekerja**.
Apa pun mitigasinya harus berlaku ke seluruh subdir yang dipakai, bukan ke nama
file tertentu.

---

## 5. Catatan tambahan: skill itu sendiri sudah menyuruh jangan mempercayainya

`SKILL.md` skill `cloudflare` memuat instruksi yang, kalau dipatuhi, sudah
menyelesaikan masalah ini: *"when a reference file and the docs disagree, trust
the docs"* (dicatat riset 14). Artinya masalahnya **bukan kekurangan aturan** —
baik AGENTS.md maupun skill itu sendiri sudah menyuruh hal yang benar. Yang
belum ada adalah **cara mengetahui bahwa ada disagreement**: agent hanya akan
membandingkan ke dokumentasi kalau ia sudah punya alasan untuk curiga, dan
tabel bertier yang rapi justru menghapus alasan untuk curiga. Itulah kenapa
riset 14 menyebut penyelamatannya "keberuntungan prosedural" — ia mengambil
halaman resmi lebih dulu untuk alasan lain, lalu ketidakcocokannya jatuh ke
pangkuannya.

---

## 6. Rekomendasi untuk pertanyaan 4 (keputusan **tidak** diambil di sini)

**Rekomendasi: ya, graduasikan jadi tiket `grilling` tersendiri.**

Alasannya bukan sekadar angka 47%. Alasannya adalah bentuk masalahnya: pola
dominannya **dikarang, bukan basi** (16 vs 5), dan karangan **tidak membaik
dengan menunggu upstream** — tidak ada versi berikutnya dari
`cloudflare/skills` yang akan memperbaiki baris yang tidak pernah punya sumber.
Ditambah: `skills-lock.json` **tidak menyimpan versi upstream**, jadi tidak ada
mekanisme untuk mengetahui kapan (atau apakah) vendor-nya diperbarui. Ini
keputusan yang punya trade-off nyata dan pantas digrilling, bukan diputuskan
sambil lalu.

Opsi mitigasinya **berperingkat**, bukan menu netral:

**1. (Paling direkomendasikan) Buang 56 subdirektori yang tidak dipakai Struku.**
Memangkas permukaan dari 47.131 baris ke 6.047 (**−87%**), tanpa kehilangan apa
pun yang repo ini pakai. Ini satu-satunya opsi yang mengurangi *paparan*, bukan
sekadar menambah peringatan yang harus dibaca. Biayanya kecil dan sekali bayar.
Yang harus digrilling: apakah `computedHash` di `skills-lock.json` menjadi tidak
valid setelah pemangkasan, dan apakah itu mengunci repo dari re-vendor
otomatis di kemudian hari. ⚠️ **Bahan bakunya lebih tipis dari yang tertulis
semula:** dugaan bahwa hash `a1646a6a…` menunjuk `SKILL.md` **diuji dan
gugur** — sha256 `SKILL.md` = `89bcccbb…`. Apa yang dicakup hash itu tidak
diketahui, jadi pertanyaannya tetap terbuka. Dan pemangkasannya menyentuh
`.agents/skills/cloudflare/` (lokasi kanonik, 320 file terlacak git), bukan
`.claude/skills/` yang cuma symlink.

**2. Peringatan spesifik di AGENTS.md yang menyebut skill vendor dengan nama.**
Murah, langsung, dan menyasar celah yang sebenarnya: bukan "ambil dokumentasi
terkini" (sudah ada) melainkan **"jangan perlakukan tabel limit di
`.claude/skills/**/references/` sebagai dokumentasi — ia sering mengarang kolom
free/paid yang tidak ada di sumbernya"**. Perlu digrilling: aturan AGENTS.md
sudah panjang, dan aturan tambahan bersaing memperebutkan perhatian dengan
aturan STOP yang sudah ada. Menambah baris ke-N yang diabaikan bukan mitigasi.
Opsi 1 dan 2 **saling melengkapi**, bukan bersaing — 1 mengurangi paparan, 2
menangani sisa 6.047 baris yang tetap tinggal.

**3. File errata di repo yang mendaftar klaim-klaim yang sudah terbukti salah.**
Riset ini sudah menyediakan isinya (23 klaim bermasalah dengan lokasi
`file:baris`). Lemah karena harus dibaca agar berguna, dan akan ikut basi.
Nilainya nyata hanya sebagai lampiran opsi 2, bukan berdiri sendiri.

**4. (Tidak direkomendasikan) Status quo.** Bisa dibela — riset ini tidak
menemukan satu pun kesalahan yang **saat ini** merusak Struku (Struku tidak
memakai Sessions API, tidak mendekati batas batch, tidak memakai Workers Assets
maupun R2). Ditolak karena karangan yang paling licin (biaya neuron per model,
`workers-ai/README.md:45-47`) berada persis di jalur keputusan yang sedang
dikerjakan riset lain tentang pemilihan model.

**Kondisi yang membatalkan rekomendasi ini** — kalau salah satu benar, jangan
buat tiket `grilling`:

- **Struku memutuskan melepas skill `cloudflare` yang divendor sepenuhnya.**
  Aturan STOP di AGENTS.md sudah memaksa pengambilan dokumentasi hidup; skill
  ini menyediakan sedikit nilai tambah di atas itu selain daftar isi. Kalau
  keputusan itu diambil, seluruh pertanyaan 4 lenyap dan tidak perlu digrilling.
- **Upstream `cloudflare/skills` menerbitkan revisi yang membuang tabel
  limit-nya.** Perlu dicek sebelum menggrilling; kalau upstream sudah
  memperbaiki, tindakannya cuma re-vendor, bukan keputusan.
- **AGENTS.md sudah dijadwalkan ditulis ulang untuk alasan lain.** Kalau begitu,
  opsi 2 menumpang ke pekerjaan itu dan yang tersisa (opsi 1) terlalu mekanis
  untuk pantas digrilling.

Dan satu kondisi yang **memperkuat** rekomendasi: kalau
`bindings/gotchas.md:165` ("KV 1000 reads/day free") terbukti meleset dua orde
begitu kanal `WebFetch` terbuka, itu menambah satu lagi ke kolom TIDAK COCOK
pada tabel yang sudah punya tiga kesalahan lain — dan menaikkan `bindings` dari
29% ke 43% bermasalah.

---

## 7. Batas kepercayaan temuan ini

Apa yang **tidak** tercakup, dan kenapa itu penting:

1. **Kanal pengambilan dokumentasi terdegradasi.** `WebFetch` ke
   `developers.cloudflare.com` diblokir kebijakan egress (403) di sesi ini;
   seluruh [DOC] di atas lewat `WebSearch`, yang membaca halaman resminya tapi
   mengembalikan ringkasan. Efeknya **asimetris**: vonis COCOK kuat (angka
   resminya muncul dan sama), vonis DIKARANG/TIDAK ADA lebih lemah. Kalau
   sebagian dari 16 karangan ternyata *ada* di halaman resmi tapi tidak
   terekstrak, rasio bermasalah 47% turun. **Seluruh riset ini layak diulang
   dengan `WebFetch` terbuka**, dan itu adalah satu-satunya pekerjaan
   verifikasi yang tersisa.
2. **Empat klaim gagal diadili sama sekali** (tabel 2c) — semuanya di area
   limit KV. Area itu efektif tidak tersampel.
3. **49 dari ±90 klaim yang bisa diadili, dari ±90 dari 6.047 baris, dari
   47.131 baris.** 56 subdirektori tidak disentuh sama sekali. Riset ini
   **tidak berhak** mengklaim apa pun tentang `r2`, `queues`, `vectorize`,
   `workflows`, atau 50 subdir lain — termasuk tidak berhak mengklaim mereka
   sama buruknya.
4. **Sampel per subdir kecil** (1–15 klaim). Tabel 3c adalah indikasi arah;
   `miniflare` 100% berdiri di atas **satu** klaim dan tidak boleh dibaca
   sebagai peringkat.
5. **Klaim non-numerik tidak diperiksa sama sekali.** Riset ini hanya mengadili
   angka. Nasihat prosedural, contoh kode, dan nama API di korpus yang sama —
   yang jumlahnya jauh lebih banyak — belum tersentuh, dan `R15` (opsi Miniflare
   yang tidak terdokumentasi) memberi alasan untuk curiga bahwa nama API pun
   bisa dikarang.
6. **Vonis AMBIGU tidak dipaksa jadi vonis**, sesuai batasan tiket. Empat klaim
   (G11, G17, G22, G31) dibiarkan menggantung karena halaman resminya sendiri
   tidak tegas atau tidak terekstrak dengan cukup jelas. Menghitung mereka
   sebagai salah akan menaikkan rasio bermasalah ke 55%; itu **tidak**
   dilakukan.

---

## Sumber

- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/reference/time-travel/
- https://developers.cloudflare.com/d1/best-practices/read-replication/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/changelog/post/2026-02-11-subrequests-limit/
- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- https://developers.cloudflare.com/changelog/2025-09-02-increased-static-asset-limits/
- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://developers.cloudflare.com/workers/testing/miniflare/
- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/kv/platform/limits/
- https://developers.cloudflare.com/queues/platform/limits/
- https://developers.cloudflare.com/r2/platform/limits/
- https://developers.cloudflare.com/workers-ai/
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/workers-ai/models/
- Riset [14](14-d1-aggregate-query-capability.md) untuk angka bertanda [DOC-14]
  (halaman limits D1 diambil langsung 2026-08-01)
- Pengukuran korpus lokal: `.claude/skills/cloudflare/references/`,
  `skills-lock.json`, `git log 5fa95a7` (vendor 2026-07-31)

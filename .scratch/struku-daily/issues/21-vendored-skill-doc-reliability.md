# 21 — Seberapa luas dokumen skill yang divendor salah angka

Type: research
Status: resolved
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

## Answer

Diriset 2026-08-03 lewat subagent, lalu diverifikasi ulang sesi induk.
→ **[temuan lengkap](../research/21-vendored-skill-doc-reliability.md)** (49 klaim
diadili satu per satu, dengan tabel `klaim → file:baris → kata dokumentasi resmi
→ vonis`).

### 1. Seberapa luas

**23 dari 49 klaim numerik yang diadili (47%) tidak bisa dipertanggungjawabkan ke
halaman resmi.** COCOK 22 · TIDAK COCOK 7 · DIKARANG 10 · TIDAK ADA DI
DOKUMENTASI 6 · AMBIGU 4. Kalau AMBIGU ikut dihitung tidak tepercaya: 55%.

Penyebutnya: korpus 47.131 baris / 319 file / **63** subdirektori; yang benar-benar
disentuh Struku 7 subdir = 6.047 baris (12,8%). Dari ±90 klaim yang bisa diadili
di situ, 49 diverifikasi.

### 2. Polanya: **dikarang**, bukan basi — 16 lawan 5

Ini pembelahan terpenting riset ini, dan **hasilnya kebalikan dari dugaan tiket**.

- **Basi (5)** — batas naik, dokumen tertinggal: script size free 1 MB (resmi
  3 MB), Workers Assets 20.000 file (paid kini 100.000), context window "2K–8K
  token", row size D1 1 MB (resmi 2 MB). Semuanya bergerak ke arah yang sama, jadi
  akibatnya **konservatif** — agent yang percaya akan membangun lebih hati-hati
  dari yang diizinkan. Merugikan, tidak merusak.
- **Dikarang (16)** — slot limitnya tidak pernah ada di dokumentasi. **10 di
  antaranya disajikan sebagai tabel bertier free/paid**, bentuk yang paling
  terbaca otoritatif. Tabel "Plan Tier Limits" di `d1/gotchas.md:47-56`: **5 dari
  8 baris tanpa padanan resmi (63%)**.
- **Pola ketiga yang tiket belum antisipasi: angka resmi dipasang di kamar yang
  salah.** 64 (env var, free) dilabeli "bindings per Worker"; 25 MiB (per file)
  dilabeli "per deployment"; 100 (producer batch) dilabeli "per consumer batch".
  **Paling sulit dideteksi** — angkanya memang ada di dokumentasi dan lolos
  pencarian sepintas.

Karangan yang sama **direplikasi lintas file**: batch size 1.000/10.000 muncul 3×,
"session up to 15 minutes" 3×, 64 bindings 3×. Tidak ada satu file buruk yang bisa
dikarantina.

### 3. `d1/gotchas.md` **mewakili**, dan hipotesis genre **gugur**

| Genre | Disampel | Bermasalah |
|---|---|---|
| `gotchas.md` | 34 | **41%** |
| Halaman referensi (`README`/`api`/`configuration`/`patterns`) | 15 | **60%** |

Arahnya **berlawanan** dengan dugaan tiket — halaman referensi justru lebih sering
salah. `durable-objects/gotchas.md` malah bersih sempurna dan memuat angka
tersegar di korpus (WebSocket 32 MiB), sementara karangan terburuk dalam sampel
ada di `workers-ai/README.md:45-47`. **Mitigasi yang menyasar genre tidak akan
bekerja.**

### 4. Perlu mitigasi lebih keras? → **ya, digraduasikan** ke
[27 · Mitigasi dokumen skill yang divendor](27-vendored-skill-doc-mitigation.md)

Sesuai batasan tiket, keputusannya **tidak diambil di sini** — yang diambil hanya
keputusan untuk menggraduasikannya. Alasannya bukan angka 47%, melainkan
bentuknya: **karangan tidak membaik dengan menunggu upstream**, dan
`skills-lock.json` tidak menyimpan versi upstream sehingga tidak ada mekanisme
untuk tahu kapan vendor-nya diperbarui.

### Temuan sampingan yang mengubah bentuk masalah

`SKILL.md:29` skill itu **sudah** memperingatkan: *"When a reference file and the
docs disagree, trust the docs. This is especially important for: **numeric limits,
pricing tiers**, …"* — vendor-nya **menamai persis** dua kategori tempat riset ini
menemukan kegagalannya. Jadi masalahnya **bukan kekurangan aturan**: peringatannya
ada, ditulis vendor sendiri, dan tetap tidak cukup — karena peringatan hanya
bekerja kalau pembacanya punya alasan curiga, dan tabel bertier yang rapi
**menghapus** alasan itu. Itulah kenapa riset 14 menyebut penyelamatannya
"keberuntungan prosedural".

### ⚠️ Batas kepercayaan — baca sebelum memakai angka di atas

**Kanal dokumentasi terdegradasi, dan ini bukan pilihan agent.** `WebFetch` ke
`developers.cloudflare.com` **diblokir kebijakan egress (403)** di environment
ini — diverifikasi independen oleh sesi induk lewat `WebFetch` dan
`$HTTPS_PROXY/__agentproxy/status` (`connect_rejected`, *"gateway answered 403 to
CONNECT (policy denial)"*). **`docs.mcp.cloudflare.com` juga ditolak**, jadi
**kedua kanal yang AGENTS.md sendiri tunjuk tertutup**; `/root/.ccr/README.md`
melarang mengakalinya. Kanal tersisa: `WebSearch` ber-`allowed_domains`, yang
membaca halaman resminya tapi mengembalikan ringkasan.

Efeknya **asimetris**: vonis **COCOK kuat**, vonis **DIKARANG/TIDAK ADA lebih
lemah** (ketiadaan bisa berarti "tidak terekstrak ringkasan"). Kalau sebagian dari
16 karangan ternyata ada di halaman resmi, rasio 47% turun. **Riset ini layak
diulang begitu `WebFetch` terbuka** — itu satu-satunya verifikasi tersisa. Empat
klaim area limit KV gagal diadili sama sekali dan dicatat sebagai belum diadili,
bukan sebagai temuan.

Tidak tersampel: 56 subdir lain (`r2`, `queues`, `vectorize`, `workflows`, …) —
riset ini **tidak berhak** mengklaim apa pun tentang mereka, termasuk tidak berhak
mengklaim mereka sama buruknya. Klaim non-numerik (nasihat prosedural, contoh
kode, nama API) tidak diperiksa sama sekali, padahal `R15` memberi alasan curiga
bahwa nama opsi pun bisa dikarang.

### Koreksi sesi induk atas temuan subagent

Empat, semuanya diverifikasi lokal: (a) `references/` berisi **63** subdir, bukan
61 — angka 61 diwarisi dari badan tiket ini tanpa diukur ulang, ironi yang pantas
dicatat; (b) tabel Plan Tier Limits berisi **8** baris data, bukan 9 — ini
*memperkuat* rasionya jadi 63%; (c) dugaan `computedHash` = sha256 `SKILL.md`
**diuji dan gugur** (`89bcccbb…` vs `a1646a6a…`), jadi "apakah memangkas
`references/` membatalkan lockfile" **tetap terbuka**; (d) lokasi kanoniknya
`.agents/skills/cloudflare/` (320 file terlacak git), `.claude/skills/` cuma
symlink — penting bagi siapa pun yang memangkas.

**Nol file skill disentuh** — batasan "ini riset, bukan perbaikan" dipatuhi.

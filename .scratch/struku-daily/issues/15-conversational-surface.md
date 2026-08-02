# 15 — Permukaan percakapan: apakah bot boleh ngobrol, dan di mana batasnya

Type: grilling
Status: resolved
Blocked by: —

## Question

Hari ini `intent: unknown` jatuh ke satu balasan datar
(`REPHRASE_REPLY`, [`src/worker/parsing/reply.ts:121`](../../../src/worker/parsing/reply.ts)):
*"Hmm, saya kurang paham. Coba ulangi?"* — jadi sapaan, ucapan terima kasih, dan
pertanyaan "kamu bisa apa aja" semuanya diperlakukan sebagai kegagalan parsing.
Permintaan pemilik repo: *"bot juga harus bisa diajak bercakap natural, jangan
hanya menerima pesan terkait pemasukan."*

Yang harus diputuskan:

1. **Apakah ini intent baru?** ADR-0005 mengunci enum `intent` ke
   `transaction | budget | category | query | unknown`. Menambah
   `smalltalk`/`chitchat` adalah **revisi ADR-0005**, bukan tweak prompt.
   Alternatifnya: `unknown` tetap satu-satunya jaring, tapi balasannya yang
   dibuat lebih hangat — jauh lebih murah, dan mungkin sudah cukup. Timbang
   keduanya; jangan asumsikan intent baru itu jawabannya.
2. **Siapa yang menulis balasan obrolan?** Copy statis (seperti seluruh copy
   sekarang) atau panggilan model kedua? Panggilan kedua menambah latency ke
   NFR-PERF-01 (anggaran 5–10s; parse saja sudah p50 ~1.7s / p95 ~2.4s) dan
   membuka permukaan yang bisa mengarang — bot keuangan yang berhalusinasi soal
   uang itu mahal. Kalau memang model, batasan apa yang menjaganya tetap aman?
3. **Apakah Coordinator menyimpan konteks percakapan?** ADR-0001 sudah memberi
   per-user DO tempat menyimpan conversation context, dan onboarding sudah
   memakainya. Pertanyaannya bukan *bisa atau tidak* — tapi *apakah obrolan
   perlu ingatan sama sekali*, atau tiap pesan berdiri sendiri. Jawaban "tidak"
   itu sah dan jauh lebih murah.
4. **Bagaimana obrolan tidak menabrak transaksi?** Risiko nyata di dua arah:
   pesan transaksi yang salah diklasifikasi sebagai obrolan (uang hilang dari
   catatan — jauh lebih parah), dan sebaliknya. Yang mana yang lebih pantas
   ditanggung, dan bagaimana kontrak parsing mencerminkan asimetri itu?

**Catatan penting — ini bukan lahan kosong.** `budget`/`category`/`query` sudah
punya stub yang sopan ("belum tersedia — segera hadir ya!",
[`reply.ts:62`](../../../src/worker/parsing/reply.ts)), jadi sudah ada permukaan
routing setengah jadi. Keputusan di sini harus cocok dengan itu, bukan
membangun jalur paralel.

Kalau ada keputusan, tulis sebagai **revisi ADR-0005** atau ADR baru, dan
tambahkan istilah barunya ke [`CONTEXT.md`](../../../CONTEXT.md) lewat
`/domain-modeling`.

## Catatan pra-grilling (2026-08-01, sesi non-interaktif)

Sesi non-interaktif tidak boleh me-resolve tiket `grilling` — empat pertanyaan di
atas soal selera dan toleransi risiko pemilik repo. Tiket **tidak di-claim**.
Yang di bawah ini murni bacaan kode, supaya sesi interaktif tidak habis di hal
yang bisa dicek sendiri. **Tidak ada keputusan di sini.**

### Koreksi kutipan di badan tiket

Tiket mengutip `REPHRASE_REPLY` sebagai *"Hmm, saya kurang paham. Coba ulangi?"*.
Teks aslinya ([`reply.ts:77-80`](../../../src/worker/parsing/reply.ts)) sudah
lebih hangat: *"Hmm, aku belum ngerti maksudnya. Coba tulis ulang ya?"* — "aku",
bukan "saya".

Konsekuensinya untuk pertanyaan 1: opsi termurah ("balasannya yang dibuat lebih
hangat") **sebagian sudah jalan**. Jadi bandingannya bukan *datar vs ngobrol*,
melainkan **"sudah hangat tapi tetap satu jaring" vs "benar-benar mengenali
sapaan sebagai sapaan"**. Pertanyaannya jadi: apakah yang mengganggu itu
*nada*-nya (sudah ditangani) atau *tidak dikenalinya* (belum).

### Tiga fakta kode yang mempersempit pilihan

1. **Permukaan routing sesempit yang diharapkan.**
   [`reply.ts:121-125`](../../../src/worker/parsing/reply.ts): `unknown` → satu
   balasan, sisanya → lookup `STUB_REPLIES`. Menambah cabang `smalltalk` di sini
   sepele. Biaya keputusan ini ada di **ADR-0005**, bukan di kode.

2. **Asimetri yang menguntungkan pertanyaan 4.** Sejak tiket 13, Coordinator
   **mencegat parse transaksi bersih sebelum `buildParseReply` dipanggil**
   ([`reply.ts:82-89`](../../../src/worker/parsing/reply.ts)) — amount +
   txn_type lengkap → langsung draft + konfirmasi. Jalur obrolan hidup di sisi
   lain gerbang itu. Jadi risiko "uang hilang dari catatan" terkurung di
   mis-klasifikasi **di dalam satu panggilan AI**, bukan di routing sesudahnya.
   Asimetri yang ditanyakan tiket sudah sebagian tertanam di arsitektur.

3. **"Panggilan model kedua" mahal secara arsitektur, bukan cuma latency.**
   ADR-0005 §1 memutuskan **satu panggilan flat**, dan itu load-bearing: skema
   bersarang bikin spiral whitespace tembus 14s di spike. Anggaran sekarang p50
   ~1.7s / p95 ~2.4s dari 5–10s — panggilan kedua mungkin masih muat, tapi itu
   melawan alasan asli ADR-nya, bukan sekadar menambah detik.

### Urutan grilling yang disarankan

**Pertanyaan 1 dulu** (intent baru vs perluas `unknown`) — jawabannya menentukan
apakah 2, 3, 4 masih hidup. Kalau jawabannya "perluas `unknown` saja",
pertanyaan 3 (ingatan percakapan) kemungkinan besar langsung mati dan ini
berhenti jadi revisi ADR.

## Arah dari pemilik repo (2026-08-01) — **belum digrilling**

Disampaikan setelah sesi produksi yang melahirkan [24](24-edit-mode-escape.md).
Dicatat verbatim sebagai **arah**, bukan keputusan — konsekuensinya belum
ditimbang, dan beberapa di antaranya mahal.

> Flow untuk setiap interaksi chat adalah sebagaimana berikut:
> User mengirimkan query → LLM memproses dan menebak maksud → lanjut business
> process → LLM membuat jawaban yang sesuai → kirim jawaban ke user.
>
> Menebak maksud di sini termasuk:
> - Menebak apakah user ingin menambah entry atau mengubah entry
> - Menebak apakah user hanya ingin bercakap ringan saja
> - Menebak apakah arah pembicaraan user sudah keluar dari konteks bot (yang di
>   mana bot harus meluruskan kembali)

### Kenapa ini lebih besar daripada tampaknya

Arah ini **mengubah bentuk tiket 15 dari "boleh ngobrol atau tidak" menjadi
"arsitektur percakapan seluruh bot"**. Empat konsekuensi yang harus digrilling
sebelum apa pun dibangun:

1. **Dua panggilan model per pesan, bukan satu.** Flow di atas menempatkan LLM di
   **awal** (menebak maksud) *dan* di **akhir** (menyusun jawaban). Ini langsung
   melawan fakta kode #3 di atas: **ADR-0005 §1 memutuskan satu panggilan flat**,
   dan itu load-bearing (skema bersarang bikin spiral whitespace tembus 14s di
   spike). Anggaran NFR-PERF-01 5–10s dengan p95 ~2.4s untuk satu panggilan —
   dua panggilan mungkin masih muat, tapi ini **revisi ADR-0005**, bukan tweak.
2. **"LLM membuat jawaban" membuka permukaan halusinasi pada angka.** Seluruh
   copy hari ini statis/deterministik. Kalau balasan disusun model, bot keuangan
   bisa **mengarang angka** — dan pertanyaan 2 tiket ini sudah menandainya
   (*"bot keuangan yang berhalusinasi soal uang itu mahal"*). Perlu batas keras:
   misalnya model hanya boleh menyusun kalimat, sementara semua angka disisipkan
   app dari nilai yang sudah dihitung.
3. **"Menambah entry vs mengubah entry" adalah `intent` baru.** Enum ADR-0005
   (`transaction | budget | category | query | unknown`) **tidak punya konsep
   "ubah"**. Ini bersinggungan langsung dengan
   [24](24-edit-mode-escape.md) (menafsirkan *"tidak jadi"* saat mode edit) dan
   [23](23-draft-confirmation-surface.md) bagian A (edit bahasa natural) — yang
   justru **diputuskan tanpa menyentuh ADR-0005** dengan cara memakai kembali
   field `ParseResult` yang sudah ada. Arah ini membatalkan penghematan itu.
   **Jangan diputuskan terpisah di tiga tempat.**
4. **"Keluar konteks → bot meluruskan" butuh ingatan percakapan.** Menilai *arah
   pembicaraan* tidak bisa dari satu pesan tunggal — ini menghidupkan pertanyaan
   3 tiket ini (konteks percakapan di DO), yang sebelumnya diperkirakan bisa
   mati murah.

### Yang harus ditanyakan saat grilling

- Apakah "LLM membuat jawaban" berlaku untuk **semua** balasan, atau hanya jalur
  obrolan/klarifikasi? (Balasan transaksi hari ini deterministik dan **benar** —
  mengubahnya jadi hasil generasi itu risiko tanpa imbalan jelas.)
- Kalau dua panggilan model per pesan, apakah keduanya wajib **berurutan**?
  Panggilan kedua hanya perlu jalan ketika balasannya memang tidak bisa disusun
  dari copy statis.
- Apakah "menebak maksud" menggantikan gerbang deterministik yang ada
  ([`coordinator.ts:283-287`](../../../src/worker/coordinator.ts): intent +
  amount + txn_type + category semuanya non-null → draft), atau duduk di
  depannya? Gerbang itu **satu-satunya** yang menjaga uang tetap tercatat.

## Answer

Digrilling 2026-08-02. Arah pemilik repo (§ di atas) **diterima dan diperkeras
jadi keputusan**, dengan satu pemisahan yang tidak ada di arah aslinya (butir 7).

Bentuk barunya: setiap pesan lewat **panggilan-1 (tebak maksud + ekstraksi) →
business process → panggilan-2 (susun jawaban + ringkasan)**.

### 1. Balasan disusun model, angka disisipkan app

**Berlaku untuk semua balasan, bukan hanya jalur obrolan.** Model menyusun
kalimat; angka tidak pernah lewat model sebagai nilai — model diberi **slot**
(`{amount}`, `{category}`, `{total_harian}`) dan app yang mengisinya dari nilai
yang sudah dihitung. Alasan pemilik repo: *"kita mau percakapan dengan bot terasa
personal."*

Opsi "hanya jalur obrolan" **ditawarkan dan ditolak** — rekomendasi agent adalah
opsi itu, dengan alasan keluhan yang melahirkan tiket ini (sapaan diperlakukan
sebagai gagal parsing) tidak menyentuh balasan transaksi sama sekali. Pemilik
repo memilih konsistensi rasa personal di atas penghematan itu.

⚠️ **Konsekuensi yang diterima sadar:** copy statis **tetap harus dipelihara**
sebagai jalur mundur (butir 4), jadi ini menambah lapisan model **di atas** copy
statis — ongkos pemeliharaan naik, bukan turun. Copy deterministik yang kena
bukan hanya [`reply.ts`](../../../src/worker/parsing/reply.ts) tapi juga
[`onboarding/state-machine.ts`](../../../src/worker/onboarding/state-machine.ts),
yang tidak pernah disebut di badan tiket.

### 2. Panggilan-2 selalu jalan, dengan model lebih kecil

Kedua panggilan **wajib berurutan** — panggilan-2 butuh hasil business process,
tidak bisa paralel. ADR-0005 §2 mencatat p50 ~1.7s / p95 ~2.4s **per panggilan**,
jadi dua panggilan 70B berurutan ≈ p95 4.8s dari anggaran NFR-PERF-01 5–10s:
muat, tapi tipis, dan itu sebelum D1 + Telegram.

Karena itu panggilan-2 memakai **model lebih kecil**. ADR-0005 §2 sendiri menulis
kapan pengecualiannya boleh diambil (*"revisit only if cost/latency becomes a
problem at scale"*) — ini momennya. Menyusun kalimat ramah dari slot yang sudah
terisi jauh lebih ringan daripada ekstraksi terstruktur.

**Cadangan kalau masih berat:** kirim balasan dua tahap — balasan deterministik
duluan (~2.4s), pesan model menyusul. Belum diputuskan, hanya dicatat sebagai
jalan keluar yang sudah dipertimbangkan.

⚠️ **Model kecilnya belum ditentukan** dan sengaja **tidak ditebak dari ingatan**
(AGENTS.md: jangan percaya pengetahuan lama soal Workers AI). → digraduasikan
jadi tiket riset.

### 3. Model **menggantikan** gerbang deterministik (a-penuh)

Gerbang di [`coordinator.ts:283-287`](../../../src/worker/coordinator.ts)
**dilepas**. Model yang menentukan dan memilih jalur; tidak ada cek independen
setelahnya.

**Koreksi fakta untuk badan tiket:** gerbang itu menuntut **empat** field
non-null (`intent`, `amount`, `txn_type`, **`category`**), bukan tiga seperti
tertulis di § "Yang harus ditanyakan". Konsekuensinya bukan sepele: hari ini
transaksi yang kategorinya gagal ditebak **tidak pernah** jadi draft — ia jatuh
ke `buildParseReply` sebagai pertanyaan klarifikasi.

**Dua bacaan dibedakan saat grilling, dan yang lebih mahal dipilih:**

- **(a-router)** — model memilih jalur, cek empat-field tetap hidup **di dalam**
  jalur transaksi. Model tidak pernah bisa membuat draft dari data bolong.
- **(a-penuh)** — model menggantikan gerbangnya. **Ini yang dipilih.**

⚠️ **Ongkos yang ditunjukkan sebelum keputusan dicatat, dan tetap dipilih:**
[`workers-ai-text-parser.ts:77`](../../../src/worker/parsing/workers-ai-text-parser.ts)
mengembalikan `UNKNOWN_REPHRASE_RESULT` saat model gagal dua kali — parser
**tidak pernah throw**. Hari ini itu aman justru karena gerbang deterministik
melihat `amount === null` dan menahan draft. Dengan a-penuh, mode gagal itu
kehilangan penahannya. Komentar di
[`workers-ai-text-parser.ts:94-102`](../../../src/worker/parsing/workers-ai-text-parser.ts)
adalah bekas luka nyata: `.response` pernah mengembalikan bentuk yang salah dan
**seluruh jalur parse jatuh ke `UNKNOWN_REPHRASE_RESULT` padahal model menjawab
benar sepanjang waktu** — lolos dari suite lokal yang hijau. Seam ini sudah
pernah gagal diam-diam di produksi, satu kali.

### 4. Kegagalan model dibalas eksplisit, tanpa parser cadangan

Kalau model gagal: balas **"sistem sedang bermasalah"** — dibedakan dari "aku
belum ngerti maksudnya". Hari ini keduanya menghasilkan balasan yang sama, dan
itu **berbohong**: user yang kena `env.AI` mati disuruh menulis ulang dengan
kalimat lain, padahal masalahnya bukan di dia.

**Parser cadangan deterministik (regex) ditawarkan dan ditolak** — ia melawan
alasan memilih a-penuh (satu otoritas, bukan dua kontrak parsing yang bisa beda
pendapat), dan jalur yang jarang terpakai akan busuk tanpa pernah teruji.

⚠️ **Diterima sadar: kalau `env.AI` mati, Struku tidak bisa mencatat apa pun.**
Tidak ada jaring deterministik yang tersisa. Ini konsekuensi langsung butir 3 + 4
dan harus tertulis di ADR, bukan ditemukan saat kejadian.

### 5. Ingatan percakapan: ringkasan berjalan, dititipkan ke panggilan-2

Bukan transkrip N pesan terakhir, bukan panggilan model ketiga. **Panggilan-2
mengeluarkan dua field flat: `reply` (string) + `summary` (string)** — nol
panggilan tambahan.

**Kenapa ini kemungkinan besar aman terhadap ADR-0005 §1:** yang membuat spiral
whitespace 14s di spike adalah **objek bersarang** (`{ intent, transaction:
{…}|null }`), bukan dua string sejajar. `reply` + `summary` tetap flat. Tapi
*"kemungkinan besar"* itu **belum diuji** — lihat § Guardrail.

Opsi "ingatan hanya untuk jalur obrolan" adalah rekomendasi agent (alasannya:
panggilan-1 sekarang satu-satunya yang menentukan uang tercatat, jadi jangan
tambah variabel ke sana) — **tidak dipilih**; pemilik repo memilih c-2 untuk
personality. Konsekuensinya: kalau ringkasan ikut masuk prompt panggilan-1,
pesan `"warteg 25rb"` bisa terbaca berbeda tergantung obrolan sebelumnya.
**Belum diputuskan apakah ringkasan diumpankan ke panggilan-1 atau hanya
panggilan-2** — lihat § Yang belum tertutup.

### 6. Ringkasan direset harian, identitas user tidak

Reset per hari di timezone user. Unit alami Struku memang hari (`entry_date`,
total harian 23B), batas atas distorsi jadi keras (maksimal sehari), dan
ongkosnya nol — bandingkan tanggal, tanpa panggilan model.

Tanpa batas reset, ringkasan-dari-ringkasan jadi telepon rusak: salah paham di
giliran 3 terbawa sampai giliran 20. Struku dipakai satu orang **setiap hari,
selamanya** — tidak ada "sesi berakhir" alami.

**Yang direset hanya isi obrolan, bukan siapa user-nya.** Nama, locale, dan
timezone sudah ada di tabel `users` dan tetap diumpankan ke prompt panggilan-2
setiap giliran, jadi bot tidak "berkenalan setiap hari".

Belum ditutup: percakapan yang menyeberang tengah malam terpotong. Tambalannya
(reset saat pesan pertama setelah jeda >4 jam **dan** ganti hari) dicatat sebagai
optimisasi, bukan keputusan hari ini.

### 7. **Kebiasaan belanja dipisah dari ringkasan percakapan**

Permintaan pemilik repo: *"Struku juga harus mempelajari kebiasaan pengeluaran
seiring penggunaan, tanpa dibatasi reset harian."*

Ini **dipisah menjadi ingatan kedua** dan **tidak diputuskan di tiket ini**,
karena sumbernya berbeda:

- **Konteks percakapan** lahir dari ngobrol → ringkasan model, reset harian
  (butir 5–6).
- **Kebiasaan belanja** lahir dari **ledger** — sudah terstruktur dan akurat di
  D1. *"Biasanya kopi 20rb tiap pagi"* itu `GROUP BY`, bukan kesan percakapan.

Kalau kebiasaan dititipkan ke ringkasan model, ia jadi **pola tebakan** — model
menulis *"user sering belanja besar"* dari kesan, bukan angka. Di bot keuangan
itu halusinasi yang paling halus: tidak mengarang angka, tapi mengarang **pola**.

Bahan bakunya belum ada — agregasi ledger adalah
[16](16-reporting-query-surface.md), yang masih *blocked by* 14 dan 20. →
digraduasikan jadi tiket sendiri, *blocked by* 16.

## Yang belum tertutup oleh keputusan ini

1. **Pesan ambigu saat ada draft.** Punya draft lalu mengetik `"kopi 15rb"` —
   transaksi baru atau edit draft jadi 15rb? Dengan a-penuh tidak ada gerbang
   yang menengahi; murni tebakan model. Belum ada penyelesaian.
2. **Keluar-konteks yang kebetulan ada angkanya** bisa menjadi draft alih-alih
   diluruskan, karena panggilan-1 memutuskan sendirian.
3. **Apakah ringkasan diumpankan ke panggilan-1?** Butir 5 memutuskan ringkasan
   *dihasilkan* oleh panggilan-2; ke mana ia *dikonsumsi* belum diputuskan.
   Mengumpankannya ke panggilan-1 menambah variabel ke satu-satunya komponen
   yang kini menentukan uang tercatat.
4. **Model kecil untuk panggilan-2 belum dipilih** (butir 2).
5. **Batas slot angka belum dirancang.** Butir 1 memutuskan *prinsipnya* (model
   menyusun kalimat, app mengisi angka); bentuk kontraknya — daftar slot yang
   sah, apa yang terjadi kalau model menyebut slot yang tidak ada atau menulis
   angka langsung — belum ada.

## Dampak ke tiket lain

- **Revisi ADR-0005, bukan tweak.** §1 (satu panggilan flat) dan §2 (satu model
  terkunci) keduanya batal. Enum `intent` bertambah konsep "ubah".
- **[23](23-draft-confirmation-surface.md) bagian A batal.** Ia menang justru
  karena **tidak menyentuh ADR-0005** — memakai ulang field `ParseResult` yang
  ada. Penghematan itu hangus begitu "tambah vs ubah" jadi `intent` baru. 23A
  **belum dibangun**, jadi tidak ada kode yang perlu dibongkar.
- **[24](24-edit-mode-escape.md) berubah bentuk.** Jalan keluar mode edit
  sekarang lewat "tebak maksud" di panggilan-1, bukan tambalan pada
  `parseDraftCommand`. Empat pertanyaan di badan 24 sebagian besar terjawab oleh
  keputusan ini.

## Guardrail

🧊 **Freeze:** jalur ini menyentuh `env.AI` **dua kali per pesan**. `test:live`
(tidak ikut beku) bisa membuktikan **bentuk output `reply` + `summary` tetap flat
dan tidak spiral** — itu satu-satunya bagian keputusan ini yang bisa dibuktikan
sebelum freeze dicabut. **Latency dua panggilan berurutan di workerd asli tidak
akan terbukti sampai deploy terakhir.** Kalau tembus anggaran NFR-PERF-01,
ketahuannya menumpuk di ujung.

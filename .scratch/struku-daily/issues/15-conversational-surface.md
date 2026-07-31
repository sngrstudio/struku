# 15 — Permukaan percakapan: apakah bot boleh ngobrol, dan di mana batasnya

Type: grilling
Status: open
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

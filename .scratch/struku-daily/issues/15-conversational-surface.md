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

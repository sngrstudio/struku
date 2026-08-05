# 30 — Slice pemulihan: kembalikan pencatatan transaksi ke produksi

Type: task
Status: open
Blocked by: —

## Question

**Kerjakan dan rilis tiga perubahan yang diputuskan
[29](29-parse-schema-5024.md), lalu deploy sekali.**

Ini satu-satunya tiket di map ini yang **melakukan**, bukan memutuskan. Ia ada
karena keputusan pertanyaan 3 tiket 29 memberi map ini **override eksekusi untuk
slice ini saja** — lihat `map.md` § Notes. Segala hal lain di map tetap
planning-only, dan freeze tetap berdiri untuk segala hal di luar slice ini.

Ia berbentuk `task` karena ia **membuka keputusan lain**: fog yang menunggu bukti
pemakaian (beban konfirmasi, akurasi kategori, kategori kustom, budget) tidak bisa
bergerak sampai bot bisa mencatat lagi. Tanpa tiket ini map-nya melingkar.

## Cakupan — persis tiga, tidak lebih

1. **`anyOf` di [`schema.ts`](../../../src/worker/parsing/schema.ts)** — setiap
   `type: [X, "null"]` diganti `anyOf: [{type:X}, {type:"null"}]`. Untuk field
   ber-`enum` (`txn_type`, `category`), `enum` ikut masuk ke cabang non-null.
   `parseResultSchema` (Zod) **tidak berubah**.
2. **Hasil gagal panggilan yang terpisah** — `TextParser` menangkap kegagalan
   `ai.run` di boundary-nya dan mengembalikan hasil yang **berbeda** dari
   `UNKNOWN_REPHRASE_RESULT`; coordinator memetakannya ke balasan *"sistem sedang
   bermasalah, coba lagi sebentar"*. Tidak ada `try`/`catch` yang disebar di
   `coordinator.ts`.
3. **Satu boundary normalisasi respons** — mengerti `{ response }` (string maupun
   object) dan `choices[0].message.content`; bentuk tak dikenal memakai hasil gagal
   dari butir 2, **tidak** runtuh jadi `""`. Logika yang benar sudah ada di
   `normalize()` [`test/live/reply-composer-probe.test.ts`](../../../test/live/reply-composer-probe.test.ts)
   — pindahkan ke produksi, jangan tulis ulang dari nol.

Ditambah, dari keputusan pertanyaan 4 tiket 29:

4. **Unit test lokal deterministik** yang menolak skema `response_format` yang
   memuat `type` berupa array atau key `nullable`. Nol neuron, jalan di setiap
   `npm test`, berlaku untuk **kedua** panggilan.

**Di luar cakupan:** [24](24-edit-mode-escape.md) (bentuknya masih digantung
[15](15-conversational-surface.md), tambalan cepatnya sudah ditolak dua kali),
arsitektur dua-panggilan [15](15-conversational-surface.md), dan apa pun yang
menyentuh [20](20-stats-refresh-trigger.md).

## Definition of done

- [ ] Empat butir di atas dibangun lewat `/tdd`, ditutup `/code-review`.
- [ ] `npm test` hijau (baseline 77/77 + test baru), `tsc` bersih, `eslint` 0 error.
- [ ] `npm run test:live` dijalankan dan **`text-parser-contract.test.ts` lolos** —
      ini pembuktian sebenarnya bahwa `5024` hilang. ⚠️ Naikkan `testTimeout`-nya
      ke 45s lebih dulu: probe #1 melihat `5024` tiba di **28s**, jadi dinding 20s
      yang sekarang menyamarkan penolakan sebagai timeout.
- [ ] `wrangler deploy` **sekali**, lalu `wrangler tail` saat mengirim transaksi
      sungguhan dari Telegram. Guardrail miniflare ≠ workerd — wajib, bukan opsional.
- [ ] Setelah normalisasi pindah ke produksi:
      `test/live/reply-composer-probe.test.ts` boleh dihapus (sampai saat itu ia
      memegang satu-satunya salinan logika yang benar).

## Catatan

- **Revisi ADR-0005 belum ditulis saat tiket ini dikerjakan.** Itu disengaja —
  keputusannya sudah final di [29](29-parse-schema-5024.md) § Answer, dan ADR-nya
  ditulis sekalian bersama empat butir lain yang menunggu (§1+§2 dari
  [15](15-conversational-surface.md), §6 dari [28](28-transaction-gate-arity.md)).
  Jangan menulis revisi ADR sepotong di sini.
- **Pengecualian freeze ini bernomor satu.** Deploy berikutnya butuh keputusan
  baru; jangan memperlakukan tiket ini sebagai pencabutan freeze.
- Pemakaian harian **masih terhalang [24](24-edit-mode-escape.md)** walau
  pencatatan pulih, jadi bukti pemakaian belum tentu langsung mengalir.

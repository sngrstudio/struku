# 30 — Slice pemulihan: kembalikan pencatatan transaksi ke produksi

Type: task
Status: resolved
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

- [x] Empat butir di atas dibangun lewat `/tdd`, ditutup `/code-review`.
- [x] `npm test` hijau (baseline 77/77 + test baru), `tsc` bersih, `eslint` 0 error.
- [x] `npm run test:live` dijalankan dan **`text-parser-contract.test.ts` lolos** —
      ini pembuktian sebenarnya bahwa `5024` hilang. ⚠️ Naikkan `testTimeout`-nya
      ke 45s lebih dulu: probe #1 melihat `5024` tiba di **28s**, jadi dinding 20s
      yang sekarang menyamarkan penolakan sebagai timeout.
- [x] `wrangler deploy` **sekali**, lalu `wrangler tail` saat mengirim transaksi
      sungguhan dari Telegram. Guardrail miniflare ≠ workerd — wajib, bukan opsional.
- [x] Setelah normalisasi pindah ke produksi:
      `test/live/reply-composer-probe.test.ts` boleh dihapus (sampai saat itu ia
      memegang satu-satunya salinan logika yang benar).

## Kemajuan 2026-08-05 — dibangun & terbukti lokal, **deploy belum**

Commit [`a9d5efc`](#) (empat butir) + [`bd6ec02`](#) (temuan `/code-review`).

### Yang terbukti

| Bukti | Hasil |
|---|---|
| `npm test` | **97/97** (baseline 77 + 20 test baru) |
| `tsc -b --force` | exit 0 |
| `eslint .` | 0 error (2 warning lama di `worker-configuration.d.ts`) |
| `npm run test:live` | **7/7 LOLOS**, dua run terpisah (49s dan 39s) |

**`5024` hilang.** Tiga run konklusif sebelumnya 7/7 gagal; sekarang 7/7 lolos
terhadap `env.AI` sungguhan lewat `remoteBindings: true`. `testTimeout` sudah
dinaikkan 20s → 45s dan **tidak ada satu pun test yang mendekati dindingnya** —
jadi gejala kedua (timeout 20s) memang `5024` yang telat, seperti dugaan run-5.

### Bentuk yang dipilih untuk butir 2

`TextParser.parse` balikin **discriminated union** `ParseOutcome`
(`{kind:"parsed",result}` | `{kind:"call_failed"}`), bukan sentinel value —
supaya compiler, bukan konvensi, yang menjaga kedua kelas kegagalan tetap
terpisah. Dipilih pemilik repo dari tiga opsi.

### Keputusan implementasi yang tidak tertulis di tiket

- **`{ response: null }` sekarang = kegagalan panggilan**, dulu
  `UNKNOWN_REPHRASE_RESULT`. Key ada tapi nol payload = tidak ada payload; itu
  persis mode runtuh-jadi-`""` yang dilarang keputusan pertanyaan 5.
- **`{ response: "" }` tetap di jalur parse.** Bentuknya dikenal, isinya kosong —
  itu model yang diam, bukan binding yang bicara dialek asing. Retry ADR-0005 §7
  tidak tersentuh.
- **Kegagalan panggilan dicatat `console.error`**, terpisah antara `throw` dan
  bentuk tak dikenal. Alert produksi ditolak sadar, jadi `wrangler tail`
  satu-satunya tempat ini terlihat.

### ⚠️ Temuan di luar cakupan — jangan hilang

**`tsc` tidak pernah meng-cover `test/`.** Root `tsconfig.json` cuma mereferensi
`app`/`node`/`worker`; `test/tsconfig.json` ada tapi **tidak terdaftar**.
Akibatnya `test/live/text-parser-contract.test.ts` yang rusak oleh perubahan
signature `parse()` lolos `tsc` **dan** lolos `npm test` (test/live dikecualikan)
— ketahuan hanya karena `test:live` dijalankan. Kelasnya persis yang dikeluhkan
pertanyaan 4: pengaman yang terlihat ada padahal tidak.
Sengaja **tidak** diperbaiki di sini — di luar "persis tiga, tidak lebih", dan
menyalakannya bisa memunculkan error tipe di seluruh suite tepat sebelum deploy.

**Registry `RESPONSE_FORMAT_SCHEMAS` menjaga skema yang _terdaftar_, bukan yang
_dikirim_.** Cukup untuk hari ini (satu panggilan, satu skema), tapi panggilan-2
yang mengirim literal tanpa mendaftarkannya lolos tanpa penjagaan. Celah ini
harus ditutup saat panggilan-2 mendarat.

---

## Answer

**Resolved 2026-08-05.** Empat butir dibangun, dideploy sekali, dan **terbukti di
workerd sungguhan**. Pengecualian freeze #1 sekarang **terpakai habis**.

### Deploy

Versi produksi **`7436f2b5` → `6d432d89`** (Version ID
`6d432d89-6a93-49bf-8919-84f88dc5c50e`), `https://struku.sngrcreative.workers.dev`.
Dijalankan pemilik repo — `wrangler deploy` diblokir classifier harness di sesi
agent.

### Bukti guardrail miniflare ≠ workerd

**1. `wrangler tail`, ~10 pesan / 3 menit: semua `Ok`.** Yang paling berarti
justru **yang tidak muncul** — nol `parse: env.AI.run threw` dan nol
`parse: unrecognized env.AI response shape`. Kedua log itu dipasang persis untuk
jalur ini, jadi diamnya bermakna, bukan sekadar tidak ada kabar. Tidak ada
`AiError` yang menembus jalur pesan seperti sebelum ini.

**2. D1 `--remote`: transaksi benar-benar tercatat** — dan ini bukti yang lebih
keras dari tail, karena `Ok` cuma berarti "tak ada exception", bukan "uang
tercatat".

```
entry  019fd0e6-52de-7d9a-9305-c22522f9e204
       entry_date 2026-08-05 · status posted
       description "Nonton bioskop 100k"   ← verbatim
lines  debit  expense_entertainment  100000 IDR
       credit cash                   100000 IDR   ← balanced
```

Parsing benar di dua tempat yang sebelumnya mustahil dicapai: `"100k"` → `100000`
dan `"bioskop"` → `entertainment`.

**3. `COUNT(*) FROM journal_entries` = 1.** DB dikosongkan 2026-08-01, jadi ini
**transaksi pertama yang pernah tercatat di produksi**. Jam tolok ukur destination
(*tujuh hari berturut-turut*) baru sekarang bisa mulai berdetak.

### Efek samping: utang verifikasi [22](22-persist-entry-description.md) **lunas**

`description` berisi teks user verbatim di baris produksi sungguhan — sesuatu
yang `map.md` § Notes catat sebagai *"sudah dibangun & hijau lokal, belum pernah
terbukti di produksi"*. Sekarang terbukti.

⚠️ **[23B](23-draft-confirmation-surface.md) TIDAK ikut lunas.** Balasan tiga
baris + *"Pengeluaran hari ini"* adalah teks balasan, dan D1 maupun tail tidak
bisa melihatnya. Ia butuh pengamatan pemilik repo di layar Telegram — **masih
utang**.

### Yang **tidak** ditutup tiket ini

1. **Freeze tetap berdiri.** Pengecualian #1 habis dipakai. Deploy berikutnya
   butuh keputusan baru — tiket ini bukan pencabutan.
2. **Override eksekusi habis bersama slice-nya.** Map kembali planning-only.
3. **[24](24-edit-mode-escape.md) masih menjebak di produksi**, jadi pemakaian
   harian belum tentu mengalir walau pencatatan pulih.
4. **Revisi ADR-0005 belum ditulis** — sengaja, lihat § Catatan. Sekarang ada
   **lima** butir menunggu: §1+§2 dari [15](15-conversational-surface.md), §6 dari
   [28](28-transaction-gate-arity.md), dan §3/§6/§7 dari
   [29](29-parse-schema-5024.md).
5. **Dua celah pengaman yang ditemukan sambil jalan** (lihat § Kemajuan) belum
   diputuskan nasibnya → difogkan di `map.md`.

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

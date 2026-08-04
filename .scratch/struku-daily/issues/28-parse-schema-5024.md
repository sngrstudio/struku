# 28 — Skema parsing ADR-0005 §3 ditolak model: `5024 JSON Model couldn't be met`

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

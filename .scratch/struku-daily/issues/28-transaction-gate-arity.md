# 28 — Gerbang transaksi ditulis dua kali dengan syarat berbeda, dan celahnya membalas seperti konfirmasi

Type: grilling
Status: open
Blocked by: —

## Question

Ditemukan 2026-08-04 lewat survei arsitektur AFK
([temuan lengkap](../research/architecture-survey-2026-08-04.md), kandidat 01).
**Bukan hasil pembacaan kode — dibuktikan jalan.**

Aturan "apakah pesan ini transaksi yang boleh dicatat" hidup di **dua** module
dengan **arity berbeda**:

| Tempat | Syarat |
|---|---|
| [`coordinator.ts:283-288`](../../../src/worker/coordinator.ts) | `intent` + `amount` + `txn_type` + **`category`** — empat non-null |
| [`reply.ts:96`](../../../src/worker/parsing/reply.ts) | `amount` + `txn_type` — dua non-null |

Parse yang lolos ambang bawah tapi gagal di ambang atas — yaitu **`category === null`
dengan amount lengkap** — jatuh ke [`reply.ts:107-118`](../../../src/worker/parsing/reply.ts),
yang merendernya dengan `transactionSummaryLine`: **fungsi yang sama persis** yang
dipakai prompt konfirmasi draft ([`draft/logic.ts:37-51`](../../../src/worker/draft/logic.ts)).

### Bukti — probe sementara, dijalankan lalu dihapus

Diinjeksikan lewat `injectFakeTextParser` pada webhook sungguhan:

```
ParseResult { intent:"transaction", txn_type:"expense",
              amount:25000, currency:"IDR", category:null }

replyText             "Pengeluaran Rp 25.000 — Lainnya (2026-08-04)"
isChoicePrompt        false
journalEntriesWritten 0
```

User membaca kalimat berbentuk ringkasan konfirmasi, **tanpa tombol**, dan **nol
baris masuk ledger**. Kata "Lainnya" di situ berasal dari
[`reply.ts:43-47`](../../../src/worker/parsing/reply.ts) (fallback untuk
`category === null`) dan **tidak bisa dibedakan** dari `category:"other"` asli —
yang justru **akan** tercatat.

⚠️ **Batas klaim, jangan diperlebar:** dibuktikan pada branch
`claude/struku-percakapan-handoff-8enqrr` di `bbafc93`. **Tidak** diverifikasi
terhadap `7436f2b5` yang terpasang di produksi. Ini bukan klaim produksi.

### Kenapa ini tidak tertangkap

- Nol test mengirim `category:null` bersama `amount` non-null. Tiga test yang
  memakai `category:null` semuanya juga `amount:null`
  (`parsing-webhook.test.ts:218-263`), jadi mereka mendarat di cabang klarifikasi.
- Seluruh `draft/` (7 file, 477 baris) tidak punya satu test langsung pun.
- Sebuah subagent yang menyurvei permukaan test menyimpulkan cabang ini
  **unreachable**. Itu keliru, dan kekeliruannya masuk akal: gerbangnya memang
  mencegat parse transaksi bersih — cuma definisi "bersih"-nya berbeda dua field.
  **Dicatat karena polanya berulang**, sama seperti koreksi subagent di sesi
  2026-08-03.

## Yang harus diputuskan

### 1. Apakah ini diperbaiki sekarang, atau diserap [15](15-conversational-surface.md)?

[15](15-conversational-surface.md) butir 3 **mengganti gerbang ini** dengan
panggilan-1 (a-penuh, bukan a-router). Jadi ada dua jalan sah:

- **Tambal sekarang** — kecil, tidak menyentuh `env.AI`, tapi menambal kode yang
  arsitektur barunya akan bongkar.
- **Serahkan ke revisi ADR-0005** — bentuk gerbangnya diputuskan sekali, di
  tempat yang benar. Risikonya: sampai `/to-spec` → `/implement` selesai, celah
  ini tetap terbuka.

⚠️ **Freeze tidak memaksa jawabannya.** Freeze menahan *rilis*, bukan *perbaikan*;
tambalan tetap boleh dibangun dan di-commit. Tapi produksi juga masih
menjebak di mode edit ([24](24-edit-mode-escape.md)), jadi pemakaian harian nyata
praktis terhenti — yang **menurunkan** urgensinya, bukan menaikkan.

### 2. Kalau ditambal: apa perilaku yang benar untuk `category === null`?

Tiga arah, konsekuensinya berbeda:

- **Klarifikasi** ("kategorinya apa?") — konsisten dengan ADR-0005 §6
  (*clarify, never invent*), tapi menambah satu putaran pada transaksi yang
  amount-nya sudah jelas.
- **Default ke `other` lalu tetap buat draft** — uang tercatat, kategorinya bisa
  dibetulkan lewat jalur edit. Tapi `other` sah sebagai kategori sungguhan, jadi
  ini membuat "gagal ditebak" dan "memang lainnya" tidak terbedakan **di ledger**,
  bukan cuma di layar.
- **Perlebar gerbang jadi tiga field** (buang syarat `category`) — paling murah,
  tapi memindahkan pertanyaan yang sama ke `toChartOfAccountsSlug`, yang pulang
  `null` untuk pasangan tidak cocok dan berakhir di `commitFailed`.

### 3. Apakah bentuknya jadi satu module?

Survei mengusulkan satu module memutuskan apa yang diizinkan sebuah `ParseResult`
dan mengembalikan union tertutup (`draftable` | `needs_clarification` |
`not_a_transaction`), sehingga celah dua-ambang **tidak bisa direpresentasikan**,
bukan sekadar tertutup. Ini **usulan survei, bukan keputusan** — dan ia bertabrakan
dengan butir 1: kalau panggilan-1 mengambil alih, module ini mungkin lahir mati.

### 4. Apakah ADR-0005 §6 perlu menyebut kasus ini?

ADR menulis *clarify, never invent*. Jalur ini tidak melanggar hurufnya — ia tidak
mengarang angka — tapi juga **tidak mengklarifikasi dan tidak mencatat**. Ini kasus
yang ADR-nya tidak pernah bayangkan. Kalau revisi ADR-0005 ditulis (sudah tertunda
dari [15](15-conversational-surface.md)), apakah ia menutup celah ini secara
eksplisit?

## Catatan

Ini **satu-satunya** dari enam kandidat survei yang lubangnya terbukti hidup dan
menyentuh uang. Lima sisanya soal depth/seam dan tercatat di
[survei](../research/architecture-survey-2026-08-04.md) sebagai bahan, bukan tiket.

Prioritas: **lebih tinggi dari [27](27-vendored-skill-doc-mitigation.md), lebih
rendah dari [20](20-stats-refresh-trigger.md)** — 20 memblokir lima tiket, 28
tidak memblokir apa pun. Tapi 28 satu-satunya yang jawabannya bisa mengubah isi
revisi ADR-0005, jadi ia tidak boleh lewat dari `/to-spec` tanpa dijawab.

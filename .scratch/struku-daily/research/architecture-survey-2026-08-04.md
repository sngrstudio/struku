# Survei arsitektur — jalur masuk pesan (2026-08-04)

> **Penamaan menyimpang dari konvensi dengan sengaja.** File lain di `research/`
> dinomori mengikuti tiket induknya (`14-`, `21-`, `25-`). Survei ini **tidak lahir
> dari tiket** — ia keluaran `/improve-codebase-architecture` di jalur AFK, jadi
> dinamai bertanggal. Kalau nanti digraduasikan jadi tiket, biarkan nama ini dan
> tautkan dari tiketnya.

**Sifat keluaran: bahan, bukan keputusan.** Nol baris kode repo diubah. Nol
keputusan diambil. Skill-nya berhenti di "pilih satu untuk digrilling"; pemilik
repo memilih **mencatat dulu**, jadi ini catatannya.

**Basis:** `bbafc93`, `src/` 2.107 baris / 30 module, 77/77 test hijau
(diverifikasi di sesi ini, bukan diwarisi dari handoff).

**Laporan visual:** https://claude.ai/code/artifact/2f4abdec-7410-4c97-813a-dcab03eb86e3
⚠️ Artifact bisa hilang atau berubah; **file ini yang kanonik**, bukan tautan itu.

---

## Cara memilih di mana melihat

Churn 60 commit terakhir pada `src/`:

```
7  coordinator.ts        ← sekaligus module src/ terbesar (323 baris)
3  index.ts · draft/store.ts
2  webhook.ts · parsing/{workers-ai-text-parser,schema,reply}.ts · draft/{types,logic,copy}.ts
   messaging/{types,telegram-provider}.ts · ledger/{writer,currency}.ts
```

Hot spot dan seam yang [15](../issues/15-conversational-surface.md) akan bongkar
**menunjuk tempat yang sama**: jalur masuk pesan. Ke situ survei diarahkan.
Cluster `ledger/`, `onboarding/`, `messaging/` disurvei juga, tapi sebagai
pembanding depth — bukan sasaran.

---

## Kandidat 01 — digraduasikan

→ [28 · Gerbang transaksi ditulis dua kali dengan syarat berbeda](../issues/28-transaction-gate-arity.md).
Satu-satunya yang lubangnya terbukti hidup dan menyentuh uang. Detail dan buktinya
ada di tiketnya, jangan diduplikasi ke sini.

---

## Kandidat 02 — seam `env.AI` dipasang dengan menusuk field publik

**Strong · ports & adapters**

[`coordinator.ts:51-54`](../../../src/worker/coordinator.ts) mendeklarasikan
`textParser: TextParser = new WorkersAiTextParser(this.env.AI)` sebagai **field
publik yang bisa ditulis**, dan
[`test/helpers/inject-fake-text-parser.ts`](../../../test/helpers/inject-fake-text-parser.ts)
menimpanya lewat `runInDurableObject`.

Akibat yang terlihat di test:

- Adapter produksi **tetap dikonstruksi** di setiap test, baru referensinya ditimpa.
  Yang menahannya jadi tidak berbahaya cuma `remoteBindings: false` di
  `vitest.config.ts`.
- Injeksi **terikat urutan**: user harus di-seed dulu (supaya `userId` pasti), baru
  poke, baru kirim pesan — karena `idFromName(userId)` di helper harus cocok dengan
  `getAgentByName` di [`webhook.ts:59`](../../../src/worker/webhook.ts).
- Karena fake mengganti seluruh `TextParser`, suite gating **tidak pernah**
  menjalankan prompt sungguhan, retry sungguhan, atau validasi Zod atas output
  model. Itu semua hanya hidup di `test/live/` yang non-gating.

**Kenapa sekarang, bukan nanti.** Hari ini satu adapter — *one adapter means a
hypothetical seam*. [15](../issues/15-conversational-surface.md) butir 2
menambahkan panggilan-2 dengan **model berbeda**: itu adapter kedua, yang membuat
seam ini **nyata**. Diputuskan sekarang = satu desain; diputuskan setelah
implementasi = membongkar dua call site plus helper test.

**Pembanding di repo ini sendiri.**
[`telegram-provider.ts`](../../../src/worker/messaging/telegram-provider.ts)
menerima `fetchImpl` lewat konstruktor — seam paling bersih yang ada. Tapi
**seluruh test webhook melewatinya** dan menimpa `globalThis.fetch`, karena
[`webhook.ts:25`](../../../src/worker/webhook.ts) mengkonstruksi provider-nya
sendiri tanpa titik injeksi. **Seam yang benar tapi tidak dipakai tetap tidak
membayar** — pelajaran yang berlaku langsung untuk desain seam `env.AI`.

---

## Kandidat 03 — urutan keputusan draft tidak punya permukaan test

**Strong · in-process**

[`coordinator.ts:191-236`](../../../src/worker/coordinator.ts) memanggil dua fungsi
murni dengan **kontrak asimetris**:

- `decideDraftCommand` **boleh** pulang `fall_through` (EC-TXT-03).
- `decideEditValue` **tidak punya** varian itu — tipenya `Exclude<DraftDecision,
  { kind: "fall_through" }>` ([`draft/logic.ts:122`](../../../src/worker/draft/logic.ts)).

Dan `editState` diperiksa **lebih dulu**. Jadi begitu `edit_field` terisi, tidak ada
jalan kembali ke `parseDraftCommand` — yang **sudah** mengerti "batal". Itu akar
[24](../issues/24-edit-mode-escape.md), dan ia adalah properti **urutan di caller**,
bukan properti salah satu fungsi murni.

`draft/` = **7 file, 477 baris, nol test langsung.** Yang menguji perilakunya cuma
suite webhook, dan itu pun tipis: dari empat field yang bisa diedit, hanya jalur
`amount` yang pernah dijalankan sekali.

**Temuan sampingan — field mati di interface.** `decideDraftCommand` mengembalikan
`{ kind: "commit", action: draftConfirmPrompt(...) }`, tapi
[`coordinator.ts:223-235`](../../../src/worker/coordinator.ts) **membuang** `action`
itu dan menyusun `committedReply` sendiri. Satu field union yang tidak berarti
apa-apa untuk satu variannya: kerja yang dihitung lalu dibuang, dan pembaca
berikutnya harus membuktikan sendiri bahwa itu memang mati.

⚠️ **Alasan sah untuk menunda:** [15](../issues/15-conversational-surface.md) sudah
mengubah bentuk [24](../issues/24-edit-mode-escape.md) — jalan keluarnya sekarang
lewat "tebak maksud" di panggilan-1. Merapikan urutan ini sebelum arsitektur barunya
terbentuk berisiko merapikan sesuatu yang akan dibongkar.

---

## Kandidat 04 — chart of accounts punya dua deklarasi tanpa tautan compile-time

**Worth exploring · in-process**

[`parsing/category-mapping.ts:7-21`](../../../src/worker/parsing/category-mapping.ts)
mendeklarasikan **10 slug chart of accounts sebagai literal string**
(`food: "expense_food"`, … `salary: "income_salary"`). Tabel sungguhannya ada di
[`ledger/chart-of-accounts.ts:28-44`](../../../src/worker/ledger/chart-of-accounts.ts),
dengan `slug` bertipe `string` polos di kedua sisi. **Rename satu slug → compile
tetap hijau, runtime gagal.**

Arah dependensinya juga terbalik:
[`ledger/writer.ts:1-2`](../../../src/worker/ledger/writer.ts) meng-import **ke atas**
ke `parsing/` (`toChartOfAccountsSlug`, `CategorySlug`) — resolusi akun ledger
bergantung pada enum kategori parser AI.

**Kenapa lebih tajam dari kelihatannya:** kalau pemetaan meleset, `commitTransaction`
pulang `{ok:false}` dan user dapat `commitFailed`. **Keempat jalur gagal
`writer.ts` tidak pernah dieksekusi suite mana pun** — setiap test webhook menyemai
chart lengkap, jadi tulisannya selalu sukses, dan copy `commitFailed` **tidak pernah
diassert satu kali pun**.

---

## Kandidat 05 — dua idiom "conversation context" berdampingan

**Worth exploring · local-substitutable**

`CONTEXT.md` punya **satu** istilah — *Conversation context*. Kodenya punya dua
bentuk:

| sumbu | onboarding | draft |
|---|---|---|
| penyimpanan | satu blob JSON, satu baris (`CHECK id = 0`) | tabel relasional 11 kolom |
| penanda posisi | enum `step` eksplisit | kolom `edit_field` nullable |
| protokol transisi | next-state — caller menyimpan verbatim | union perintah — caller menafsirkan |
| baris di caller | 1 ([`coordinator.ts:116`](../../../src/worker/coordinator.ts)) | 35 ([`coordinator.ts:201-235`](../../../src/worker/coordinator.ts)) |
| kardinalitas | 0 atau 1 | 0..n, LIFO |
| SQL-nya di mana | **inline di `coordinator.ts`** | `draft/store.ts` |

Baris terakhir membalik konvensi yang ditulis
[`draft/store.ts:4-8`](../../../src/worker/draft/store.ts) sendiri.

**Komentar yang menyesatkan pembaca berikutnya:**
[`draft/logic.ts:17-18`](../../../src/worker/draft/logic.ts) menulis bahwa
`DraftDecision` *"mirroring the onboarding state machine's pure context→action
shape."* **Ia tidak mirror** — onboarding mengembalikan **state**, draft
mengembalikan **perintah**. Divergensinya kemungkinan besar tidak disengaja.

**Kenapa sekarang.** [15](../issues/15-conversational-surface.md) butir 5 menambah
state percakapan **ketiga** (ringkasan berjalan, reset harian). Memilih idiomnya
setelah state ketiga terpasang berarti memindahkan tiga hal, bukan dua.

---

## Kandidat 06 — dua aturan yang masing-masing punya dua pemilik

**Worth exploring · in-process · termurah di daftar ini**

1. **"hari ini di timezone user"** — [`coordinator.ts:315-322`](../../../src/worker/coordinator.ts)
   (`todayIn`, private) dan [`reply.ts:53-60`](../../../src/worker/parsing/reply.ts)
   (`todayInTimezone`, exported). **Identik verbatim.** Yang benar-benar diuji suite
   justru duplikat privatnya.
2. **"25rb → 25000"** — [`workers-ai-text-parser.ts:27`](../../../src/worker/parsing/workers-ai-text-parser.ts)
   menugaskannya ke **model** lewat teks prompt; [`parse-edit-value.ts:27-40`](../../../src/worker/draft/parse-edit-value.ts)
   mengimplementasikannya ulang sebagai **regex deterministik**. Aturan sama, dua
   pemilik, dua jalur menuju field yang sama.

⚠️ **ADR-0005 §3** menugaskan resolusi shorthand ke model. Salinan deterministik di
jalur edit ada **di luar** cakupan itu — bukan pelanggaran, tapi begitu
[15](../issues/15-conversational-surface.md) menulis ulang prompt panggilan-1,
keduanya bisa berpisah **tanpa satu test pun merah**.

---

## Temuan pinggir yang tidak jadi kandidat

Dicatat supaya tidak ditemukan ulang, bukan untuk dikerjakan:

- **`users` tidak punya module pemilik** — ditulis di `identity.ts:30` dan
  `onboarding/provisioning.ts:36`, dibaca di `webhook.ts:53` dan `coordinator.ts:305`.
  Empat file, empat himpunan kolom, nol repository.
- **`ensureDraftTable` dipanggil di setiap accessor** `draft/store.ts` (6 tempat),
  masing-masing menjalankan `CREATE TABLE IF NOT EXISTS` + `PRAGMA table_info`. Satu
  pesan memicunya berkali-kali. Terkait `TODO(remove once verified in production)`
  yang **belum boleh dicabut**.
- **Tabrakan kosakata `direction`** — berarti *income/expense* di `draft/` dan
  `parsing/reply.ts`, tapi *debit/credit* di `ledger/balance.ts` dan migrasi. Dua
  konsep tak berhubungan, satu identifier.
- **`formatAmount` mengunci locale angka ke `"id-ID"`**
  ([`format-amount.ts:12`](../../../src/worker/parsing/format-amount.ts)) tanpa
  memandang `Locale`, jadi user `en` tetap dapat `Rp 25.000`.
- **Kabar baik yang layak dicatat:** string `"debit"`/`"credit"` sebagai *arah
  ledger* dan kolom `amount_minor` **tidak muncul di mana pun di luar `ledger/`**.
  Containment-nya bertahan. Yang bocor adalah **slug akun** (kandidat 04) dan
  `assetSlug`, yang jadi field `PendingDraft` dan kolom di SQLite Durable Object.
- **Module terdalam di repo ini**, sebagai patokan bentuk yang benar:
  `onboarding/state-machine.ts` (3 input → 1 output, menyembunyikan mesin 7 state)
  dan `ledger/daily-total.ts` (4 skalar → 1 angka, menyembunyikan join 3 tabel +
  jebakan (b) dan (c) riset 14).

---

## Caveat metode

- **Dua subagent Explore dipakai untuk menyapu, dan hasilnya diverifikasi, bukan
  ditelan.** Klaim yang dikutip di file ini sudah dicek ulang langsung ke kode.
- **Satu klaim subagent terbukti salah** dan justru menunjuk temuan terkuat: ia
  menyimpulkan cabang transaksi `buildParseReply` sudah *unreachable*. Tidak.
  Lihat [28](../issues/28-transaction-gate-arity.md).
- **Kandidat 01 dibuktikan dengan probe sementara** yang ditulis, dijalankan, lalu
  **dihapus** di sesi yang sama. Tree bersih. Lima kandidat lain **tidak** dibuktikan
  jalan — mereka pembacaan kode, dan kelas buktinya lebih lemah.
- **Yang survei ini tidak jawab:** apakah kandidat 02–06 masuk destination map
  "Layak Dipakai Harian" sama sekali. Semuanya soal *cara membangun*, bukan *apakah
  pemilik repo bisa memakai Struku harian* — pertanyaan yang sama yang
  [27](../issues/27-vendored-skill-doc-mitigation.md) butir 0 tanyakan tentang
  dirinya sendiri. **Keputusan pemilik repo.**

# 17 — Koreksi transaksi setelah commit: apa arti "salah, benerin dong"

Type: grilling
Status: open
Blocked by: —

## Question

Pemilik repo melaporkan ini **sudah terjadi** — sebuah transaksi masuk ke
kategori yang salah, dan tidak ada cara membenarkannya. Di tracer #1, "edit"
hanya berarti mengubah **draft yang belum di-commit**; begitu terkonfirmasi,
entry-nya beku.

Yang harus diputuskan:

1. **Model koreksinya apa?** ADR-0002 sudah memesan kapasitasnya — kolom `status`
   dan `reverses_entry_id` ada justru untuk ini, dan ledger-nya **append-only**.
   Jadi pertanyaannya bukan "boleh di-UPDATE atau tidak" (jawabannya sudah:
   tidak) — tapi apakah koreksi = membalik + memposting ulang, atau ada bentuk
   lain yang tetap menghormati append-only. Apa yang user lihat setelahnya:
   satu transaksi yang "berubah", atau jejak dua entry?
2. **Bagaimana user menunjuk transaksi yang salah?** Ini bagian yang paling
   tidak jelas dan mungkin yang paling menentukan. "yang tadi", "kopi tadi pagi",
   "yang 25rb". Perhatikan preseden: ADR-0004 §2 mengunci `callback_data` ke
   `confirm`/`edit`/`discard` **tanpa draft id**, sehingga disambiguasi
   multi-draft bersifat **LIFO** — balasan mengenai draft yang paling baru.
   Apakah aturan yang sama masuk akal untuk transaksi terkomit ("yang barusan"),
   atau koreksi butuh cara menunjuk yang lebih eksplisit — dan kalau iya, dari
   mana user melihat pilihannya? **Ini menyentuh [16](16-reporting-query-surface.md)
   secara langsung:** "lihat transaksi terakhir" mungkin adalah prasyarat untuk
   bisa menunjuk mana yang salah.
3. **Sejauh apa yang bisa dikoreksi?** Kategori saja (keluhan nyatanya), atau
   jumlah, tanggal, metode pembayaran, dan penghapusan penuh? Yang paling sempit
   yang menyelesaikan keluhan nyata adalah kandidat yang sah — jangan otomatis
   pilih yang paling lengkap.
4. **Apakah koreksi butuh konfirmasi?** Membalik entry lebih berat daripada
   membuatnya. Timbang terhadap beban konfirmasi yang sudah ada.

**Catatan — jangan salah kejar.** Frasa persis transaksi yang meleset itu **tidak
tercatat**, dan pemilik repo secara sadar memilih tidak mengejarnya (sedang
melihat gambaran besar). Jadi tiket ini adalah tentang **bisa membenarkan**, bukan
tentang memperbaiki akurasi parsing. Kalau ternyata polanya sistematis, itu fog
terpisah yang sudah dicatat di map ("Akurasi kategori pada pemakaian nyata") dan
akan jadi tiket sendiri kalau buktinya terkumpul.

§3.7 (post-commit editing/reklasifikasi/reversal) ada di Out of Scope **spec
tracer #1** — itu benar untuk tracer #1 dan tidak lagi mengikat di sini; map ini
punya destination yang berbeda dan keluhannya sudah nyata.

## Catatan pra-grilling (2026-08-01, sesi non-interaktif)

Sesi non-interaktif tidak boleh me-resolve tiket `grilling` — empat pertanyaan di
atas soal selera dan toleransi risiko pemilik repo. Tiket **tidak di-claim**.
Yang di bawah ini murni bacaan kode + ADR, supaya sesi interaktif tidak habis di
hal yang bisa dicek sendiri. **Tidak ada keputusan di sini.**

### Fakta 1 — ADR-0002 memang sengaja menyerahkan pilihan ini ke sini

ADR-0002 §6 ("Append-only entry lifecycle with reversal capacity") menyediakan
`status` + `reverses_entry_id` dan menulis eksplisit bahwa itu memesan kapasitas
untuk **either** gaya reversing-entry **or** update-with-audit, *"without choosing
one here — that flow is owned by the future editing ticket (§3.7)"*.

Jadi pertanyaan 1 bukan menafsir ulang ADR-0002; ia **mengeksekusi janji** yang
ADR-0002 tinggalkan. Konsekuensinya: keputusan di sini kemungkinan besar **ADR
baru**, bukan revisi ADR-0002 — ADR-0002 tidak perlu diubah, cukup dilanjutkan.

### Fakta 2 — kapasitasnya masih 100% skema, nol kode

`grep` ke seluruh `src/`: **tidak ada satu pun** kemunculan `reverses_entry_id`,
`'reversed'`, maupun `'reversal'`. Tidak ada jalur tulis yang pernah menyentuh
`status`. Artinya tidak ada utang implementasi yang membatasi pilihan — lahan
kosong di sisi kode, meski skemanya sudah siap.

### Fakta 3 — `status` bahkan belum ditulis saat commit ⚠️

[`writer.ts:84-87`](../../../src/worker/ledger/writer.ts):

```sql
INSERT INTO journal_entries (id, user_id, entry_date, source, currency, created_at)
VALUES (?, ?, ?, 'text', ?, ?)
```

Kolom `status` **tidak disebut** — semua entry mengandalkan `DEFAULT 'posted'`.
Hari ini benar dan tidak berbahaya. Tapi begitu koreksi ada, `status` berubah
dari kolom pasif jadi kolom yang menentukan kebenaran laporan — dan riset
[14](14-d1-aggregate-query-capability.md) sudah menandai jebakan (c): kalau
`status` tidak disaring, reversal **terhitung ganda**. Kaitan 17↔16 karena itu
lebih ketat dari yang tertulis di badan tiket: bukan cuma "16 mungkin prasyarat
menunjuk transaksi", tapi **keputusan 17 mengubah bentuk query 16**.

### Fakta 4 — preseden LIFO untuk pertanyaan 2 memang nyata

[`store.ts:68-70`](../../../src/worker/draft/store.ts) — komentarnya harfiah
*"so disambiguation is LIFO"*, implementasinya `listPendingDrafts(sql)[0]`. Jadi
preseden yang dikutip tiket benar-benar ada di kode, bukan cuma di ADR-0004.

Bedanya yang layak digrill: draft LIFO beroperasi pada himpunan **kecil dan
berumur pendek** (draft pending). Transaksi terkomit himpunannya **tumbuh
selamanya**. "Yang barusan" mungkin tetap cukup untuk keluhan nyata, tapi
argumen "sudah ada presedennya" tidak otomatis pindah.

### Urutan grilling yang disarankan

**Pertanyaan 3 dulu** (sejauh apa yang bisa dikoreksi), bukan 1. Alasannya:
keluhan nyatanya *kategori salah*. Kalau ruang lingkupnya ternyata "kategori
saja", maka pertanyaan 1 mengecil drastis — mengganti kategori tidak mengubah
angka, sehingga "balik + posting ulang" mungkin berlebihan dan bentuk koreksi
yang lebih ringan jadi kandidat kuat. Menjawab 1 duluan berisiko mengunci
mekanika berat untuk masalah yang ternyata ringan.

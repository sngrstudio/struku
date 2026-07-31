# 23 — Konfirmasi draft: edit bahasa natural + balasan commit berrincian

Type: grilling
Status: open
Blocked by: 22

## Question

[17 · Koreksi transaksi setelah commit](17-post-commit-correction.md) memutuskan
koreksi pasca-commit **ditunda sampai reporting ada**, dan memindahkan
pertahanannya ke **hulu**: tahan transaksi salah sebelum masuk ledger. Tiket ini
adalah pertahanan itu. Kalau konfirmasi draft tidak diperbaiki, ledger berjalan
**tanpa jaring pengaman sama sekali** — yang pertama belum dipasang, yang kedua
sudah ditolak.

Pemilik repo menggambar flow yang diinginkan saat grilling
[17](17-post-commit-correction.md):

```
User:  "warteg 25rb"
Bot:   Keterangan: Warteg
       Jumlah: IDR 25000
       Kategori: Other
       Jenis: Pemasukan
User:  "edit"
Bot:   "Apa yang mau diperbaiki?"
User:  "Seharusnya kategori Makan dan Minum, dan jenisnya Pengeluaran."
Bot:   <konfirmasi ulang dengan nilai baru>
User:  "ya"
Bot:   "Sudah dicatat" + rincian transaksi + "Pengeluaran hari ini: IDR XXX"
```

Dua hal di flow itu **belum ada**:

### A. Edit draft masih menu kaku, bukan bahasa natural

Hari ini edit berjalan field-per-field lewat menu:
[`copy.ts:35`](../../../src/worker/draft/copy.ts) —
*"Mau ganti yang mana: jumlah, kategori, tanggal, atau jenis (masuk/keluar)?"* —
lalu satu pertanyaan lagi untuk nilai barunya
(`askNewAmount`/`askNewCategory`/`askNewDate`/`askNewDirection`). State-nya
`setEditState(sql, draft.entryId, 'choosing')`
([`coordinator.ts:210-212`](../../../src/worker/coordinator.ts)).

Yang diinginkan: **satu kalimat bebas, boleh menyentuh lebih dari satu field
sekaligus** — *"kategori Makan dan Minum, dan jenisnya Pengeluaran"* mengubah
dua field dalam satu giliran.

### B. Balasan commit tidak menyebut apa pun

[`copy.ts:33`](../../../src/worker/draft/copy.ts): `"Sip, sudah dicatat!"` —
tanpa rincian, tanpa kategori. Ini **temuan yang mengubah arah grilling
[17](17-post-commit-correction.md)**: user tidak punya cara tahu kategorinya
meleset, jadi ia baru sadar berhari-hari kemudian. Yang diinginkan: rincian
transaksi + **"Pengeluaran hari ini: IDR XXX"**.

Yang harus diputuskan:

1. **Apakah edit bahasa natural = intent baru, atau tetap di jalur draft?**
   ADR-0005 mengunci enum `intent`. Tapi edit terjadi **saat draft pending**, dan
   ADR-0004 §2 sudah menetapkan balasan draft dicek **sebelum** TextParser
   dipanggil ([`coordinator.ts:241-244`](../../../src/worker/coordinator.ts)) —
   jadi kemungkinan besar ini parser terpisah untuk "delta terhadap draft", bukan
   intent baru. Konfirmasi, karena kalau ternyata butuh enum baru, ini **revisi
   ADR-0005**, bukan tweak prompt.
2. **Apa yang terjadi kalau parse edit-nya gagal atau ambigu?** Hari ini ada
   `editFieldRetry` untuk menu. Bahasa bebas gagal dengan cara yang lebih banyak:
   field tak dikenal, nilai tak terparse, kalimat yang tidak mengubah apa pun.
   Jatuh balik ke menu lama, atau minta ulang?
3. **Apakah menu lama dipertahankan sebagai fallback?** Membuang menu berarti
   satu jalur saja untuk dirawat; mempertahankannya berarti ada jalan keluar saat
   parse gagal berulang. Ini menyentuh
   [15 · Permukaan percakapan](15-conversational-surface.md) — jangan diputuskan
   dua kali di tempat berbeda.
4. **"Pengeluaran hari ini" itu query seperti apa?** Ini agregat pertama yang
   benar-benar dijalankan Struku, dan ia mendarat **tepat di atas jebakan riset
   [14](14-d1-aggregate-query-capability.md)**: (a) tanpa `PRAGMA optimize`
   planner mengabaikan `idx_journal_entries_user_date`
   ([20](20-stats-refresh-trigger.md)); (b) filter naif `direction='debit'`
   mencemari hasil dengan `cash` — harus lewat `accounts.type`; (c) `status`
   harus disaring. **Sengaja tidak mem-block tiket ini ke
   [16](16-reporting-query-surface.md)**: ini satu angka untuk satu hari, bukan
   permukaan reporting. Tapi kalau grilling menemukan ia menyeret bentuk query
   yang lebih besar, hentikan dan pertimbangkan mem-block-nya.
5. **Berapa banyak yang ditampilkan setelah commit?** Rincian penuh tiap kali
   bisa jadi berisik untuk transaksi yang berulang tiap hari. Timbang terhadap
   fog **"Beban konfirmasi"** di map — sama seperti butir 3, jangan diputuskan
   terpisah dari sana.

## Kenapa blocked by 22

[22](22-persist-entry-description.md) memutuskan apa yang masuk `description`.
Baris pertama flow di atas adalah **"Keterangan: Warteg"** — jadi tiket ini
menampilkan field yang bentuknya baru diputuskan di 22. Kalau 22 memilih
menyimpan teks mentah (*"warteg 25rb"*) alih-alih keterangan ternormalisasi
(*"Warteg"*), tampilan konfirmasinya ikut berubah, dan butir 2 di
[22](22-persist-entry-description.md) (boleh diedit atau tidak) menambah satu
field lagi ke jalur edit di tiket ini.

Kalau grilling 22 ternyata sesingkat dugaan, dua tiket ini boleh digabung ke satu
sesi — urutannya tetap 22 dulu.

## Catatan

Guardrail map berlaku penuh di sini: **miniflare ≠ workerd**. Edit bahasa natural
menyentuh seam `env.AI`, jadi `npm run test:live` + deploy nyata + `wrangler tail`
**wajib** — suite lokal hijau tidak membuktikan apa pun. Dua bug produksi sudah
pernah lolos lewat celah ini.

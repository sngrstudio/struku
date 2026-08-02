# 23 — Konfirmasi draft: edit bahasa natural + balasan commit berrincian

Type: grilling
Status: resolved
Blocked by: — (22 resolved 2026-08-01)

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

## Answer — bagian B (balasan commit berrincian)

**Bagian A (edit bahasa natural) belum digrilling** — sesi ini sengaja memisah
B dulu karena A menyentuh seam `env.AI` dan ongkosnya jauh berbeda.

### Temuan kode: rinciannya sudah ada, hanya tidak diulang

Flow yang digambar di [17](17-post-commit-correction.md) **sudah separuh ada**.
Yang bot kirim saat konfirmasi hari ini
([`logic.ts:36-50`](../../../src/worker/draft/logic.ts) →
[`reply.ts:48`](../../../src/worker/parsing/reply.ts)):

```
Pengeluaran Rp 25.000 — Makan (2026-01-15) Betul?   [Konfirmasi] [Edit] [Batal]
```

Arah, jumlah, kategori, dan tanggal **semuanya sudah tampil** — hanya dipadatkan
jadi satu baris, dan hanya sebelum commit. Yang hilang setelah Konfirmasi hanya
`"Sip, sudah dicatat!"` ([`copy.ts:33`](../../../src/worker/draft/copy.ts)).

### Keputusan: rincian pasca-commit adalah **echo**, bukan info baru

Pemilik repo: *"echo, sebagai laporan"*. Rincian yang diulang berfungsi
**menutup transaksi** (penanda "ini yang barusan masuk"), bukan menyampaikan
sesuatu yang belum terlihat. Yang benar-benar baru hanyalah **angka harian**.

⚠️ **Konsekuensi yang harus dicatat jujur:** butir B **tidak menutup lubang
deteksi kategori meleset** yang melahirkan tiket ini. Temuan grilling
[17](17-post-commit-correction.md) berbunyi *"user tidak punya cara tahu
kategorinya meleset"* — tapi kategori **sudah** tampil sebelum commit, jadi
masalah sebenarnya adalah **menekan Konfirmasi tanpa membacanya**. Meng-echo
teks yang sama sedetik kemudian tidak memperbaiki itu: baris kedua akan
di-skip dengan alasan yang sama persis. Yang didapat dari B adalah **angka
harian**, dan itu barang yang berbeda. Lubang deteksi kategori **masih
terbuka** — jangan dianggap tertutup oleh tiket ini.

### Butir 4 — bentuk agregat "Pengeluaran hari ini"

1. **"Hari ini" = `entry_date`, bukan `created_at`.** Mencatat jam 1 pagi untuk
   belanja kemarin masuk hitungan **kemarin**. Konsisten dengan ledger: yang
   dihitung tanggal akuntansi, bukan waktu ketik.
2. **Hanya pengeluaran, bukan net.** Pemasukan (gaji) tidak mengurangi angkanya.
3. **Multi-currency dipisah, tanpa FX.** ADR-0002 tetap utuh (FX hanya di jalur
   reporting, yang belum ada) → **23 tidak perlu di-block ke
   [16](16-reporting-query-surface.md)**.

**Tampilan (butir 3 di atas): opsi A polos** — hanya mata uang transaksi yang
baru saja di-commit, **tanpa label mata uang**:

```
Pengeluaran hari ini: Rp 125.000
```

Ditawarkan eksplisit dua alternatif (A dengan label `(IDR)`, dan B yang
menampilkan semua mata uang sebaris); pemilik repo memilih A polos. Konsekuensi
yang diterima sadar: **kalau hari itu ada pengeluaran mata uang lain, angka ini
diam-diam tidak lengkap dan tidak memberi tahu apa pun soal itu.** Melihat yang
lain adalah pekerjaan [16](16-reporting-query-surface.md).

### Jebakan riset 14 pada agregat ini

Ketiganya tetap berlaku dan **wajib** saat implementasi
([14](14-d1-aggregate-query-capability.md)):

- **(a) `PRAGMA optimize`** — tanpanya planner mengabaikan
  `idx_journal_entries_user_date`. Ini [20](20-stats-refresh-trigger.md), **belum
  selesai**. Query ini akan berjalan di atas planner yang salah sampai 20 mendarat
  — dapat diterima untuk satu angka satu hari, tapi jangan dilupakan.
- **(b) filter naif `direction='debit'` mencemari hasil dengan `cash`** — harus
  lewat `accounts.type = 'expense'`. Keputusan "hanya pengeluaran, bukan net"
  membuat ini lolos bersih.
- **(c) `status` harus disaring** (`status = 'posted'`) atau reversal terhitung
  ganda begitu [17](17-post-commit-correction.md) mendarat.

## Answer — bagian A (edit bahasa natural)

> ⚠️ **DIBATALKAN oleh [15](15-conversational-surface.md) (2026-08-02).** Baca
> § "Status bagian A setelah tiket 15" di bawah **sebelum** memakai apa pun di
> bagian ini. Jawaban A di bawah dipertahankan utuh sebagai catatan sejarah —
> alasan-alasannya masih berguna, tapi **premis intinya sudah runtuh**. Bagian B
> **tidak terpengaruh** dan tetap berlaku (sudah dibangun, `099ca39`).

### Butir 1 — tetap di jalur draft, **bukan** intent baru → ADR-0005 utuh

**Temuan kode yang menutup pertanyaan ini:** `ParseResult`
([`parsing/types.ts:19-27`](../../../src/worker/parsing/types.ts)) **sudah
memuat keempat field yang bisa diedit** — `amount`, `category`, `date`,
`txn_type`. Jadi kalimat edit cukup dilempar ke `TextParser` yang sudah ada,
lalu field non-null diambil sebagai delta. **Tidak perlu enum `intent` baru,
tidak perlu parser baru, ADR-0005 tidak tersentuh.** Ini juga konsisten dengan
ADR-0004 §2 yang sudah menempatkan balasan draft **sebelum** TextParser dipanggil
([`coordinator.ts`](../../../src/worker/coordinator.ts)) — jalur edit adalah
cabang di dalam penanganan draft, bukan intent tingkat atas.

**Semantik delta: menambal, bukan menulis ulang.** Field yang **tidak disebut
(null) berarti "jangan sentuh"**, bukan "kembalikan ke default".

Opsi "tulis ulang" (yang tidak disebut kembali ke default) sempat dipilih karena
terdengar lebih sederhana, lalu **dibatalkan setelah ongkosnya ditunjukkan**:
untuk mengubah satu field, user harus mengetik ulang seluruh transaksi
(*"belanja 25rb tanggal 15 januari pengeluaran"*), kalau tidak draft-nya rusak.
Itu **lebih buruk daripada menu yang sudah ada**. Yang menentukan: kalimat contoh
pemilik repo sendiri di [17](17-post-commit-correction.md) — *"Seharusnya
kategori Makan dan Minum, dan jenisnya Pengeluaran"* — menyebut dua field dan
**diam soal jumlah dan tanggal**, jelas berharap keduanya tidak tersentuh.
Kalimat itu **tidak jalan** dalam mode tulis ulang. Ongkos kode kedua opsi
praktis sama (satu aturan: ambil yang non-null).

### Butir 1b — `currency` **tidak pernah ikut diedit**

Aturan "null = jangan sentuh" jalan untuk empat field, **tapi tidak untuk
`currency`**: field itu **non-null dengan default `'IDR'`**
([`types.ts:23`](../../../src/worker/parsing/types.ts)), jadi ia tidak pernah
"diam". Tanpa penanganan khusus, mengedit draft USD apa pun akan menimpanya
jadi IDR — `$ 15` menjadi `Rp 15`, tanpa satu tanda pun di layar.

**Keputusan: mata uang ditentukan saat draft dibuat, titik.** Mau ganti mata
uang → batalkan, ketik ulang transaksinya. Alasan: mengganti mata uang berarti
**transaksi lain**, bukan koreksi. Konsekuensi yang diterima: kalau AI salah
membaca mata uang di awal, satu-satunya jalan keluar adalah membatalkan draft.

Alternatif yang ditolak: membuat `currency` bisa diedit menuntut cara
membedakan *"user menyebut IDR"* dari *"default-nya IDR"* — dan `ParseResult`
tidak bisa membedakan itu, jadi itu **revisi ADR-0005**, hal yang justru
dihindari di butir 1.

### Butir 2 — dua mode gagal, dua mekanisme berbeda

Bahasa bebas gagal dengan lebih banyak cara daripada menu, dan **yang berbahaya
bukan yang terlihat**:

- **Gagal terang** — parser mengembalikan semua null; tidak ada yang berubah.
  Ditangani oleh **fallback ke menu** (butir 3).
- **Gagal diam** — parser mengembalikan field yang **terbaca tapi salah**.
  Contoh: *"jangan makan, tapi transport"* → AI menangkap `category: food`,
  karena kata "makan" ada di kalimat meski maksudnya justru menolak.

**Keputusan: setelah edit natural, tampilkan apa yang berubah — bukan hanya
keadaan akhir.**

```
Kategori: Makan → Transportasi
Pengeluaran Rp 25.000 — Transportasi (2026-01-15) Betul?
```

Hanya untuk **jalur edit natural**; jalur menu tetap seperti sekarang (di menu
user baru saja memilih field-nya, jadi sudah tahu apa yang berubah).

Alasan mekanisme ini penting: kesimpulan bagian B adalah masalah sebenarnya
**menekan Konfirmasi tanpa membaca**. Edit natural menaruh jalur yang bisa salah
menafsirkan kalimat **tepat sebelum tombol itu**. Baris diff membuat salah-tangkap
**terlihat berbeda dari yang dimaksud**, tanpa user harus membandingkannya dengan
ingatannya sendiri.

⚠️ Ini juga **jawaban parsial untuk fog "Beban konfirmasi"** di map (butir 5
tiket ini, dan map melarang memutuskannya terpisah): rincian tambahan
**hanya ditambahkan di jalur yang butuh pembuktian**, tidak di semua jalur.

### Butir 3 — menu lama **dipertahankan sebagai fallback**

Natural duluan: tekan Edit → ketik bebas. Kalau parse **gagal terang** (semua
null), jatuh ke menu lama.

Alasan, bukan selera: menu **sudah dibangun dan sudah hijau di test**
([`parse-edit-value.ts`](../../../src/worker/draft/parse-edit-value.ts) — regex
+ tabel alias, **nol panggilan AI**). Mempertahankannya berongkos nyaris nol —
bukan menulis jalur kedua, melainkan **tidak menghapus jalur yang sudah ada** —
dan ia satu-satunya jalur edit yang **tetap jalan saat `env.AI` mati**.

Ditolak: membuang menu (tidak ada jalan keluar saat parse gagal berulang atau
`env.AI` ngadat; juga menyentuh [15](15-conversational-surface.md), jangan
diputuskan dua kali) dan menu-tetap-default (praktis tidak memberi apa-apa).

**Catat batasnya:** jaring menu hanya menangkap **gagal terang**. **Gagal diam**
tidak tertangkap olehnya — yang menangkap itu tampilan diff di butir 2. Dua
mekanisme untuk dua mode gagal; jangan mengira salah satunya menutup keduanya.

### Status verifikasi produksi (2026-08-01)

**Bagian B sudah dibangun (`099ca39`) dan ter-deploy (`7436f2b5`), tapi belum
terbukti di workerd.** Percobaan verifikasi gagal dilakukan: draft terbentuk
benar, lalu pemilik repo terjebak di mode edit → [24](24-edit-mode-escape.md).
Tidak ada transaksi ter-commit, jadi balasan tiga baris + `Pengeluaran hari ini`
belum pernah benar-benar tampil di produksi.

⚠️ **Temuan 24 melemahkan satu keputusan bagian A:** butir 3 memilih menu lama
sebagai jaring pengaman saat parse natural gagal terang — tapi 24 membuktikan
**menu lama itu sendiri menjebak**. Jaring itu bocor. Putuskan 24 sebelum (atau
bersamaan dengan) membangun bagian A; jangan bangun A di atas asumsi bahwa menu
adalah tempat mendarat yang aman.

### Guardrail implementasi bagian A

Berbeda dari bagian B, **A menyentuh seam `env.AI`**. Guardrail map berlaku
penuh dan **tidak opsional**: `npm run test:live` + deploy nyata +
`wrangler tail`. Suite lokal hijau **tidak membuktikan apa pun** di sini —
miniflare ≠ workerd, dan dua bug produksi sudah pernah lolos lewat celah ini.

🧊 **Disesuaikan oleh deployment freeze (map, 2026-08-01):** bagian guardrail
yang masih bisa jalan sekarang hanya **`npm run test:live`** (memanggil model
sungguhan, tidak me-rilis apa pun) — itu tetap **wajib** sebelum bagian A
dianggap selesai. **Deploy nyata + `wrangler tail` tertunda ke akhir map**, jadi
A akan dibangun tanpa pernah terbukti di workerd sampai saat itu. Risiko
diterima sadar; **jangan menyatakan A "selesai dan terbukti"** sebelum
verifikasi akhir.

## Catatan

Guardrail map berlaku penuh di sini: **miniflare ≠ workerd**. Edit bahasa natural
menyentuh seam `env.AI`, jadi `npm run test:live` + deploy nyata + `wrangler tail`
**wajib** — suite lokal hijau tidak membuktikan apa pun. Dua bug produksi sudah
pernah lolos lewat celah ini.

## Status bagian A setelah tiket 15 (2026-08-02)

**Bagian A dibatalkan. Bagian B tetap berlaku.**

[15](15-conversational-surface.md) memutuskan arsitektur percakapan menyeluruh:
setiap pesan lewat **panggilan-1 (tebak maksud + ekstraksi) → business process →
panggilan-2 (susun jawaban + ringkasan)**, dan panggilan-1 **menggantikan**
gerbang deterministik di
[`coordinator.ts:283-287`](../../../src/worker/coordinator.ts).

### Premis A yang runtuh

Seluruh kemenangan bagian A bertumpu pada satu kalimat di butir 1: *"**Tidak
perlu enum `intent` baru, tidak perlu parser baru, ADR-0005 tidak tersentuh.**"*

Premis itu **tidak berlaku lagi**. [15](15-conversational-surface.md) menerima
arah pemilik repo bahwa "menebak maksud" mencakup **tambah entry vs ubah entry**
sebagai maksud tingkat atas — yaitu `intent` baru, yaitu **revisi ADR-0005**.
Penghematan yang membuat A menang sudah hangus terlepas dari apa pun yang
diputuskan di sini.

### Yang masih hidup dari bagian A

Alasan-alasannya, bukan mekanismenya:

- **Semantik menambal, bukan menulis ulang** (field null = jangan sentuh). Ini
  keputusan soal *makna*, bukan soal jalur kode — dan bukti pendukungnya masih
  kuat: kalimat contoh pemilik repo sendiri di
  [17](17-post-commit-correction.md) menyebut dua field dan diam soal dua
  lainnya. Bawa ini ke desain `intent` "ubah".
- **`currency` tidak pernah ikut diedit.** Alasannya murni mekanis (non-null,
  default `'IDR'` → tiap edit menimpa draft USD jadi IDR, `$ 15` → `Rp 15`) dan
  **tetap berlaku** di arsitektur baru.
- **Tampilan diff untuk gagal diam** (*"jangan makan, tapi transport"* → `food`)
  — prinsipnya, *rincian tambahan hanya di jalur yang butuh pembuktian*, tetap
  masuk akal.

### Yang mati

- **Melempar kalimat edit ke `TextParser` yang ada dan mengambil field non-null
  sebagai delta.** Diganti oleh panggilan-1 dengan `intent` "ubah".
- **Fallback ke menu lama sebagai jaring pengaman.** Ini sudah rapuh sebelum 15 —
  [24](24-edit-mode-escape.md) menemukan bahwa **menu lama itulah yang
  menjebak**. Sekarang ia mati dua kali: [15](15-conversational-surface.md)
  butir 4 memutuskan **tidak ada parser cadangan deterministik**; kegagalan model
  dibalas *"sistem sedang bermasalah"*, bukan dialihkan ke jalur lain.

### Tidak ada kode yang perlu dibongkar

Bagian A **tidak pernah dibangun** — hanya diputuskan (`3188002`). Bagian B
sudah dibangun (`099ca39`) dan **tidak terpengaruh**: ia tidak menyentuh
`env.AI`, dan keputusannya (echo rincian + `Pengeluaran hari ini`, `entry_date`,
satu mata uang tanpa FX) berdiri sendiri.

⚠️ **Utang verifikasi bagian B tetap berdiri.** B masih belum pernah terbukti di
workerd — lihat § Catatan di bawah dan
[24](24-edit-mode-escape.md).

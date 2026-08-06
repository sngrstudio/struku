# 24 — Terjebak di mode edit: tidak ada jalan keluar

Type: grilling
Status: resolved
Blocked by: —

## Question

**Ditemukan di produksi 2026-08-01**, saat sesi verifikasi deploy `7436f2b5`
(bukan dari pembacaan kode). Transkrip nyata:

```
User: "rokok malboro 55k"
Bot:  Pengeluaran Rp 55.000 — Hiburan (2026-08-01) Betul?
      [Konfirmasi] [Edit] [Batal]
User: <tekan Edit>
Bot:  "Mau ganti yang mana: jumlah, kategori, tanggal, atau jenis (masuk/keluar)?"
User: "Tidak jadi."
Bot:  "Aku belum ngerti — coba sebut: jumlah, kategori, tanggal, atau jenis."
User: "Tetap sama"
Bot:  "Aku belum ngerti — coba sebut: jumlah, kategori, tanggal, atau jenis."
User: (mencoba lagi)
Bot:  "Aku belum ngerti — coba sebut: jumlah, kategori, tanggal, atau jenis."
```

**User terjebak.** Draft tidak pernah ter-commit, dan satu-satunya jalan keluar
adalah menunggu `DRAFT_TIMEOUT_SECONDS` (30 menit) mematikannya diam-diam.

### Mekanisme persisnya

Begitu `editState` terisi,
[`coordinator.ts:194-203`](../../../src/worker/coordinator.ts) melompat ke
`decideEditValue` dan **`parseDraftCommand` tidak pernah dipanggil lagi**.
Padahal fungsi itu **sudah mengerti `"batal"`**
([`command.ts:5`](../../../src/worker/draft/command.ts):
`DISCARD_SYNONYMS = {discard, batal, hapus, cancel}`) — ia hanya tidak
terjangkau dari dalam mode edit.

Di dalam `editState === "choosing"`
([`logic.ts:125-133`](../../../src/worker/draft/logic.ts)), satu-satunya input
yang diterima adalah `parseEditField(text)` — "jumlah/kategori/tanggal/jenis".
Apa pun selain itu → `retry`, **tanpa batas**.

Diperparah dua hal:

1. **Balasan retry `kind: "text"`, tanpa opsi** — jadi tombol
   `[Konfirmasi][Edit][Batal]` yang tadinya ada **ikut hilang** dari layar. Jalan
   keluar yang secara teknis ada (kata "batal") juga tidak lagi terlihat.
2. **Tidak ada hitungan percobaan.** `retry` tidak menaikkan counter apa pun dan
   tidak pernah menyerah — berbeda dari onboarding, yang perlu diperiksa apakah
   punya pola escape yang bisa ditiru.

### Arahan pemilik repo

> "Bot harus bergantung pada processing model untuk menentukan apa yang dimaksud
> oleh user (seperti pada ss: tidak jadi, artinya user ingin membatalkan)."

Jadi solusinya **bukan** menambah kata ke `DISCARD_SYNONYMS`. Menambahkan
"tidak jadi"/"tetap sama" ke daftar hanya memindahkan dinding, tidak
merobohkannya — kalimat berikutnya yang tak terduga akan menjebak lagi.

Yang harus diputuskan:

1. **Model dipanggil di titik mana?** Setiap balasan saat mode edit, atau hanya
   setelah parser deterministik gagal (`parseEditField` null)? Yang kedua lebih
   murah dan menjaga jalur cepat tetap nol-AI, tapi berarti dua lapis penafsiran
   untuk satu giliran.
2. **Apa saja yang boleh disimpulkan model di mode edit?** Minimal
   "batal/keluar". Tapi *"tetap sama"* pada transkrip di atas sebenarnya berarti
   **"kembali ke konfirmasi tanpa mengubah apa-apa"** — itu maksud yang berbeda
   dari membatalkan transaksi. Apakah keduanya dibedakan?
3. **Bagaimana kalau model juga gagal?** Ini pertanyaan yang sama dengan yang
   melahirkan bug ini, satu tingkat lebih dalam. Harus ada dasar yang tidak bisa
   menjebak — misalnya menyerah setelah N kali dan kembali ke prompt konfirmasi.
4. **Apakah tombol dikembalikan di balasan retry?** Ini perbaikan paling murah
   dan **tidak butuh model sama sekali**: selama `[Batal]` terlihat, user tidak
   pernah benar-benar terjebak. Timbang apakah ini tetap dilakukan sebagai lapis
   dasar, terlepas dari keputusan butir 1-3.

## Hubungannya dengan tiket lain

- **Tumpang tindih besar dengan [23](23-draft-confirmation-surface.md) bagian A**
  (edit bahasa natural, sudah di-resolve tapi **belum dibangun**). Menafsirkan
  *"tidak jadi"* saat mode edit adalah persis pekerjaan yang sama: kalimat bebas
  → maksud. **Pertimbangkan menggabungkan implementasinya** — atau setidaknya
  memutuskan keduanya bersama, karena 23A memutuskan "gagal terang → jatuh ke
  menu lama", dan tiket ini menemukan bahwa **menu lama itu sendiri yang
  menjebak**. Jaring pengaman 23A menggantung pada sesuatu yang bocor.
- **Menyentuh seam `env.AI`** → guardrail map berlaku penuh: `npm run test:live`
  + deploy nyata + `wrangler tail` **wajib**. Ini bukan tambalan kecil.
- Terkait fog **"menekan Konfirmasi tanpa membaca"** di map: transkrip di atas
  justru kasus user yang **membaca**, sadar kategorinya meleset ("Hiburan" untuk
  rokok), menekan Edit untuk memperbaiki — lalu dihukum karena melakukannya.

## Catatan

🧊 **Deployment freeze (map, 2026-08-01) — konsekuensi khusus untuk tiket ini.**
Bug ini **hidup di produksi** (`7436f2b5`) dan **tidak akan diperbaiki di sana
sampai map selesai**. Tambalan cepat (mengembalikan tombol `[Batal]` di balasan
retry — nol panggilan AI, tidak mengunci desain apa pun) **ditawarkan dan
ditolak**, konsisten dengan freeze.

Konsekuensi yang harus diingat saat menjadwalkan sisa map:

- Bot praktis **tidak bisa dipakai harian dengan nyaman** — menekan Edit
  menjebak, dan satu-satunya jalan keluar adalah menunggu 30 menit.
- Karena itu, semua fog yang menunggu **"bukti pemakaian harian"** (beban
  konfirmasi, akurasi kategori, kategori kustom, budget chat-native)
  **tidak akan bergerak** selama freeze. Jangan menunggu bukti yang secara
  struktural tidak mungkin terkumpul.
- Verifikasi produksi [22](22-persist-entry-description.md) dan
  [23B](23-draft-confirmation-surface.md) **terhalang oleh bug ini**, dan
  sekarang **berlipat** dengan freeze: keduanya baru bisa dibuktikan setelah
  24 selesai **dan** freeze dicabut.

Ditemukan saat memverifikasi [22](22-persist-entry-description.md) dan
[23](23-draft-confirmation-surface.md) bagian B di produksi. **Verifikasi itu
sendiri belum selesai** — tidak ada transaksi yang berhasil ter-commit di sesi
tersebut, jadi `description` terisi verbatim dan balasan commit berrincian
**masih belum terbukti di workerd**. Bug ini yang menghalanginya.

## Bentuk ulang setelah tiket 15 (2026-08-02)

[15](15-conversational-surface.md) memutuskan arsitektur percakapan menyeluruh,
dan itu **menjawab sebagian besar tiket ini secara tidak langsung**. Tiket tetap
`open` — ada sisa yang harus diputuskan — tapi **empat pertanyaan di § Question
tidak lagi berdiri seperti yang tertulis**. Baca bagian ini sebagai pengganti.

### Yang sudah terjawab oleh 15

- **Butir 1 (model dipanggil di titik mana).** Terjawab: **selalu**, di
  panggilan-1. [15](15-conversational-surface.md) butir 3 memutuskan panggilan-1
  **menggantikan** gerbang deterministik — tidak ada lagi "hanya setelah parser
  deterministik gagal", karena tidak ada parser deterministik yang mendahuluinya.
  Arahan pemilik repo di § di atas (*"bot harus bergantung pada processing model
  untuk menentukan apa yang dimaksud user"*) sekarang berlaku untuk **seluruh
  bot**, bukan hanya mode edit.
- **Butir 3 (kalau model juga gagal).** Terjawab sebagian:
  [15](15-conversational-surface.md) butir 4 memutuskan **tidak ada parser
  cadangan deterministik**; kegagalan model dibalas *"sistem sedang bermasalah"*,
  dibedakan dari *"aku belum ngerti"*. Yang **belum** terjawab: apakah mode edit
  butuh dasar tambahan yang tidak bisa menjebak (menyerah setelah N kali) — lihat
  di bawah.

### Yang berubah bentuk

- **Butir 2 (apa yang boleh disimpulkan model di mode edit)** bukan lagi
  pertanyaan lokal. "Tambah entry vs ubah entry" sekarang **`intent` tingkat
  atas** ([15](15-conversational-surface.md) butir 3, → revisi ADR-0005). Jadi
  *"tidak jadi"* dan *"tetap sama"* tidak ditafsirkan oleh cabang khusus mode
  edit — keduanya maksud yang dikenali panggilan-1. Pertanyaan aslinya (apakah
  "batal" dan "kembali ke konfirmasi tanpa mengubah" dibedakan) **masih hidup**,
  tapi jawabannya sekarang berbentuk **daftar maksud di enum**, bukan cabang
  `if`.
- **Jaring pengaman yang diandalkan [23](23-draft-confirmation-surface.md)
  bagian A sudah mati dua kali.** Tiket ini menemukan menu lama itu sendiri
  menjebak; [15](15-conversational-surface.md) butir 4 lalu menghapus fallback
  deterministik sepenuhnya. Tidak ada lagi "jatuh ke menu lama".

### Yang tersisa untuk diputuskan di tiket ini

1. **Apakah `editState` masih ada sama sekali?** Mekanisme bug ini adalah
   `editState` terisi → [`coordinator.ts:194-203`](../../../src/worker/coordinator.ts)
   melompat ke `decideEditValue` dan `parseDraftCommand` tak pernah terpanggil.
   Kalau panggilan-1 menafsirkan **setiap** pesan, state mode-edit yang
   mem-bypass parser mungkin **tidak perlu ada**, dan bug ini hilang secara
   struktural — bukan ditambal. Ini pertanyaan desain yang sebenarnya.
2. **Butir 4 tetap berdiri sendiri: apakah tombol dikembalikan di balasan
   retry?** Ini **tidak butuh model sama sekali** dan tidak dikunci oleh
   [15](15-conversational-surface.md). Selama `[Batal]` terlihat, user tidak
   pernah benar-benar terjebak — lapis dasar yang berlaku bahkan kalau `env.AI`
   mati (yang sekarang berarti Struku tidak bisa mencatat apa pun,
   [15](15-conversational-surface.md) butir 4).
3. **Dasar yang tidak bisa menjebak.** Dengan panggilan-1 sebagai otoritas
   tunggal, apa yang terjadi kalau ia salah menafsirkan berulang kali? Sisa dari
   butir 3 asli.

### Catatan tambahan

⚠️ **Tiket ini sekarang bergantung pada [15](15-conversational-surface.md), tapi
sengaja *tidak* di-block ke sana** — 15 sudah `resolved`, jadi tidak ada yang
perlu ditunggu. Yang perlu diperhatikan: butir 2 di atas (mengembalikan tombol)
**bisa diputuskan dan dibangun tanpa menyentuh arsitektur baru sama sekali**,
sementara butir 1 dan 3 sebaiknya diputuskan bersama implementasi 15.

Bug ini tetap **hidup di produksi** (`7436f2b5`) dan tetap **memblokir verifikasi
produksi** [22](22-persist-entry-description.md) dan
[23B](23-draft-confirmation-surface.md) — lihat § Catatan di atas. Freeze belum
dicabut.

## Answer

Digrilling 2026-08-05. Lima keputusan. **Mekanisme di § Question diverifikasi masih
berlaku** setelah slice pemulihan (tiket 30) — `editState` di
[`coordinator.ts:198-201`](../../../src/worker/coordinator.ts) masih short-circuit,
[`logic.ts:125-127`](../../../src/worker/draft/logic.ts) masih `retry` tanpa batas,
`"batal"` masih ada di `DISCARD_SYNONYMS` tapi tetap tak terjangkau.

### 1. `editState` tetap ada sebagai **data**, otoritasnya **dicabut**

Panggilan-1 selalu jalan lebih dulu. `editState` tidak lagi mem-bypass penafsiran;
ia hanya menyuplai konteks — *"barusan bot menanyakan field mana"*.

Opsi **menghapus `editState` sepenuhnya ditawarkan dan tidak dipilih.** Alasannya
ongkos yang ditunjukkan sebelum keputusan dicatat: `editState` mengerjakan **dua**
hal yang mudah dikira satu — mem-bypass penafsiran (yang jahat) **dan** menyimpan
field mana yang sedang diedit (yang berguna). Menghapus keduanya memaksa
panggilan-1 menyimpulkan field dari konteks percakapan, dan itu **memaksa fog
"apakah ringkasan percakapan diumpankan ke panggilan-1" ditutup sekarang** —
padahal [15](15-conversational-surface.md) sengaja meninggalkannya terbuka karena
panggilan-1 kini satu-satunya yang menentukan uang tercatat.

⚠️ **Risiko yang diterima sadar:** state-nya tetap ada, jadi bypass-nya bisa
dikembalikan orang lain tanpa sadar. **Itu dijaga test, bukan niat baik** — siapa
pun yang membangun ini wajib meninggalkan test yang gagal kalau `editState`
mem-bypass penafsiran lagi.

### 2. Dua maksud draft dibedakan, dan **asimetris**

`batal` (buang draft) **≠** `tetap sama` (kembali ke konfirmasi tanpa mengubah).
Menyatukan keduanya berarti *"tetap sama"* dibaca sebagai batal — dan **catatan
user terbuang justru saat ia bilang sudah benar**.

Kedua salahnya **tidak sama berat**, dan itu yang menentukan bentuknya:

| Salah baca | Akibat |
|---|---|
| `tetap sama` → dibaca `batal` | 💀 draft terbuang, user mengetik ulang dari nol |
| `batal` → dibaca `tetap sama` | 😐 tombol muncul lagi, user menekan Batal |

Jadi **maksud yang merusak menuntut keyakinan lebih tinggi**; saat ragu, pilih yang
tidak merusak.

⚠️ **Prinsipnya diputuskan, mekanismenya belum** — ambang keyakinan, atau
konfirmasi ulang sebelum membuang, belum ada bentuknya. Ini **satu-satunya**
pertahanan draft terhadap salah tebak, dan ia menyeberang ke implementasi
[15](15-conversational-surface.md) (lihat butir 5).

⚠️ Enum `intent` hari ini masih lima (`transaction`, `budget`, `category`, `query`,
`unknown`) — belum memuat konsep "ubah". Menambah dua maksud draft ini **menambah
butir ke revisi ADR-0005 yang sudah mengantre**.

### 3. Lantainya **tombol selalu ada**, tanpa hitungan menyerah

Selama draft menggantung, **setiap** balasan membawa `[Konfirmasi] [Edit] [Batal]`.
Selama tombolnya terlihat, user secara logika **tidak bisa terjebak** — tidak ada
lagi menunggu 30 menit.

**Hitungan menyerah ditawarkan dan ditolak**, dua alasan:

1. **Lantai yang butuh model bukan lantai.** [15](15-conversational-surface.md)
   butir 4 menerima bahwa kalau `env.AI` mati Struku tidak bisa mencatat apa pun —
   hitungan menyerah butuh bot yang hidup untuk menghitung; tombol tidak butuh apa
   pun.
2. **Ia tidak menyelesaikan keluhannya.** User yang ingin *mengubah* lalu salah
   dibaca 3× dan dipulangkan ke prompt konfirmasi **tetap belum berhasil
   mengubah** — itu memutar, bukan jalan keluar, dan menambah satu bagian mesin
   lagi.

**Temuan kode yang lebih buruk dari yang tiket tulis:** dari sepuluh balasan alur
draft, **hanya satu yang membawa tombol** —
[`logic.ts:47`](../../../src/worker/draft/logic.ts), prompt konfirmasi. Sembilan
sisanya `kind: "text"`. Jadi tombol **tidak hilang saat retry gagal; ia hilang
detik user menekan Edit** ([`logic.ts:103`](../../../src/worker/draft/logic.ts),
`editWhichField`). Badan tiket menulisnya terjadi di balasan retry — itu **satu
langkah terlambat**.

Ongkosnya: sembilan balasan berubah `text` → `choice`. Mekanismenya **sudah
terbukti di produksi** (prompt konfirmasi memakainya), jadi ini pemakaian ulang,
bukan barang baru. ⚠️ Belum diperiksa apakah kesembilannya pantas membawa **set
tombol yang sama**.

### 4. Tombol dipasang **sekarang, sebagai slice tersendiri**

Nol panggilan AI, nol arsitektur dikunci — apa pun yang terjadi pada `editState`
dan panggilan-1 nanti, tombol tetap tombol.

Alasan memilih sekarang, bukan menunggu arsitektur
[15](15-conversational-surface.md): **empat fog map menunggu "bukti pemakaian
harian"** (beban konfirmasi, akurasi kategori, kategori kustom, budget) dan
semuanya **beku secara struktural** — buktinya tidak mungkin terkumpul selama
menekan Edit menjebak 30 menit. Menunggu bukti yang tidak mungkin datang bukan
sabar, itu macet. Slice ini juga **membuka jalan** bagi utang verifikasi produksi
[22](22-persist-entry-description.md) dan
[23B](23-draft-confirmation-surface.md).

→ digraduasikan jadi
[31 · Slice lantai tombol draft](31-draft-button-floor.md).

⚠️ **Dua izin yang BELUM diberikan dan tidak ikut terjawab oleh keputusan ini:**
**pengecualian freeze #2** (jatah sekarang nol — #1 habis di tiket 30) dan
**override eksekusi** (map kembali planning-only). Keduanya keputusan terpisah
milik pemilik repo.

### 5. Bagian yang butuh model dititipkan ke implementasi [15](15-conversational-surface.md)

Butir 1 dan 2 tidak bisa dibangun sebelum panggilan-1 ada. Keduanya menyeberang ke
implementasi 15 — **bersama substansi yang dulu bernama 23A**, yang sudah
dibatalkan 15 dan diserap panggilan-1.

Alasannya: *"kalimat bebas saat konfirmasi"* (dulu 23A) dan *"kalimat bebas saat
mode edit"* (sisa tiket ini) adalah **satu mesin, bukan dua**. Membangun terpisah =
dua tempat menebak maksud dalam satu alur, yang bisa berbeda pendapat.

Alasan kedua, lebih penting: **jaring pengaman 23A sudah mati dua kali** — tiket
ini menemukan menu lama itu sendiri menjebak, lalu 15 butir 4 menghapus fallback
deterministik sepenuhnya. Digabung, itu terlihat dan terbetulkan; dipisah, ia
dibangun di atas jaring yang bolong.

⚠️ **Ongkos yang diterima:** implementasi 15 jadi lebih gemuk — dua panggilan
model, revisi ADR-0005 lima butir, **plus** dua maksud draft dan perombakan
`editState`. Slice besar lebih mudah meleset. Kalau kegemukan, **pecah saat
`/to-spec`** — bukan sekarang.

## Yang belum tertutup

1. **Apakah ringkasan percakapan diumpankan ke panggilan-1** — tetap fog. Butir 1
   **menunda**-nya, bukan menjawabnya; ia akan menagih saat implementasi 15.
2. **Mekanisme "keyakinan lebih tinggi" untuk maksud yang merusak** (butir 2).
   Prinsip ada, bentuk tidak.
3. **Apakah kesembilan balasan pantas membawa set tombol yang sama** (butir 3).
4. **Verifikasi produksi [22](22-persist-entry-description.md) dan
   [23B](23-draft-confirmation-surface.md)** hanya **dibukakan jalannya** oleh
   slice ini, belum lunas — masih butuh pemilik repo mengetik di Telegram.

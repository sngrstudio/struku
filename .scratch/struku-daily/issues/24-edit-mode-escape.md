# 24 — Terjebak di mode edit: tidak ada jalan keluar

Type: grilling
Status: claimed
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

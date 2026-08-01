# 24 — Terjebak di mode edit: tidak ada jalan keluar

Type: grilling
Status: open
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

# 27 — Mitigasi dokumen skill yang divendor mengarang angka

Type: grilling
Status: open
Blocked by: —

## Question

[21 · Seberapa luas dokumen skill yang divendor salah angka](21-vendored-skill-doc-reliability.md)
mengukur masalahnya dan **sengaja tidak memutuskan** mitigasinya. Ini tiketnya.

Yang sudah jadi fakta (jangan digrilling ulang, sudah diadili di
[temuan riset 21](../research/21-vendored-skill-doc-reliability.md)):

- **23 dari 49 klaim numerik (47%) tidak bisa dipertanggungjawabkan** ke halaman
  resmi Cloudflare.
- Pola dominannya **dikarang, bukan basi** (16 lawan 5), dan **10 dari 16
  karangan** berbentuk tabel bertier free/paid — bentuk yang paling terbaca
  otoritatif.
- **Hipotesis genre gugur**: halaman referensi biasa (60% bermasalah) lebih buruk
  daripada `gotchas.md` (41%). Mitigasi yang menyasar nama file tidak akan
  bekerja.
- `SKILL.md:29` **sudah** memperingatkan agar mempercayai dokumentasi di atas file
  referensi, dan **menamai persis** kategori yang gagal (*"numeric limits, pricing
  tiers"*). Jadi ini bukan kekurangan aturan.

## Yang harus ditanyakan

### 0. Apakah tiket ini masuk destination? (tanyakan **lebih dulu**)

Destination map ini: *"Struku layak dipakai satu user beneran setiap hari."*
Keandalan dokumen skill memengaruhi **cara agent membangun** Struku, bukan
apakah pemilik repo bisa memakainya harian. Ada argumen sah bahwa ini
**out of scope** dan mestinya jadi effort sendiri.

Tiket 21 sudah terlanjur dicarter ke dalam map ini dan berjalan di rutenya, jadi
sesi yang menggraduasikan 27 **tidak mengambil keputusan itu sendirian** — ia
menyerahkannya. Kalau jawabannya "out of scope", tutup tiket ini dan taruh satu
baris di § Out of scope map; jangan diselesaikan di rute.

### 1. Opsi mana yang diambil?

Riset 21 memberi peringkat, bukan menu netral:

1. **Buang 56 subdirektori yang tidak dipakai Struku** — permukaan 47.131 baris →
   6.047 (**−87%**). Satu-satunya opsi yang mengurangi **paparan**, bukan menambah
   peringatan yang harus dibaca.
2. **Peringatan spesifik di AGENTS.md** yang menyebut skill vendor dengan nama —
   bukan "ambil dokumentasi terkini" (sudah ada) melainkan "jangan perlakukan
   tabel limit di `references/` sebagai dokumentasi".
3. **File errata** — isinya sudah tersedia dari riset 21. Lemah berdiri sendiri.
4. **Status quo** — bisa dibela; riset tidak menemukan satu pun kesalahan yang
   **saat ini** merusak Struku.

Opsi 1 dan 2 **saling melengkapi**, bukan bersaing.

### 2. Ongkos opsi 1 belum diketahui — ini yang paling perlu digrilling

⚠️ Dugaan riset bahwa `computedHash` di `skills-lock.json` menunjuk `SKILL.md`
(sehingga memangkas `references/` aman) **diuji sesi induk dan gugur**: sha256
`SKILL.md` = `89bcccbb…`, lockfile menyimpan `a1646a6a…`; varian tanpa newline
akhir, CRLF→LF, dan konkatenasi seluruh pohon juga meleset. **Apa yang dicakup
hash itu tidak diketahui.**

Jadi: apakah memangkas membatalkan lockfile, dan apakah itu mengunci repo dari
re-vendor otomatis nanti? Kalau iya, opsi 1 berubah dari "sekali bayar, murah"
jadi "menukar utang dokumentasi dengan utang tooling".

Catatan bagi yang bertindak: lokasi kanoniknya **`.agents/skills/cloudflare/`**
(320 file terlacak git). `.claude/skills/*` cuma symlink.

### 3. Kalau opsi 2 — bagaimana ia tidak jadi baris ke-N yang diabaikan?

AGENTS.md sudah panjang dan sudah punya aturan STOP. Aturan tambahan bersaing
memperebutkan perhatian dengan aturan yang sudah ada, dan riset 21 menunjukkan
peringatan yang **sudah ada** di `SKILL.md` tidak menyelamatkan siapa pun —
karena peringatan hanya bekerja kalau pembacanya punya alasan curiga, dan tabel
bertier yang rapi menghapus alasan itu.

## Kondisi yang membatalkan tiket ini

Cek dulu; kalau salah satu benar, tutup tanpa digrilling:

- **Struku melepas skill `cloudflare` yang divendor sepenuhnya.** Aturan STOP
  sudah memaksa pengambilan dokumentasi hidup; skill ini menambah sedikit nilai
  di atas itu selain daftar isi.
- **Upstream `cloudflare/skills` sudah menerbitkan revisi yang membuang tabel
  limitnya.** ⚠️ **Belum bisa dicek** — akses GitHub sesi ini dibatasi ke
  `sngrstudio/struku`, jadi `cloudflare/skills` tidak terbaca. Ini pemeriksaan
  pertama yang harus dilakukan sesi yang mengambil tiket ini.
- **AGENTS.md memang sudah dijadwalkan ditulis ulang** untuk alasan lain — opsi 2
  menumpang ke situ, dan sisanya (opsi 1) terlalu mekanis untuk pantas digrilling.

## Prioritas

**Rendah, sama seperti [21](21-vendored-skill-doc-reliability.md).** Tidak
memblokir tiket mana pun. Ambil saat butuh kerjaan HITL ringan — bukan sebagai
ganti tiket frontier yang lebih dekat ke destination.

⚠️ Satu hal yang menaikkan urgensinya sedikit: karangan paling licin dalam sampel
(**biaya neuron per model**, `workers-ai/README.md:45-47` — *"llama-3.1-70b ~2000
neurons"*) berada persis di jalur keputusan
[25 · Model kecil mana untuk panggilan-2](25-small-model-for-reply-composition.md).
Angka itu **dikarang**; ADR-0005 §2 mengukur ~11 neuron/call untuk 70B nyata.
Selisihnya dua orde besaran.

# 31 — Slice lantai tombol draft

Type: task
Status: claimed
Blocked by: —

## Question

Melaksanakan **butir 3 + 4** [24 · Terjebak di mode edit](24-edit-mode-escape.md).
Keputusannya sudah diambil di sana; tiket ini **tidak memutuskan apa pun**, ia
membangun.

**Selama sebuah draft menggantung, setiap balasan membawa
`[Konfirmasi] [Edit] [Batal]`.** Selama tombolnya terlihat, user secara logika
tidak bisa terjebak — tidak ada lagi menunggu `DRAFT_TIMEOUT_SECONDS` 30 menit.

## Kenapa slice ini berdiri sendiri

- **Nol panggilan AI.** Tidak menyentuh seam `env.AI` sama sekali.
- **Nol arsitektur dikunci.** Apa pun yang terjadi pada `editState` dan
  panggilan-1 di implementasi [15](15-conversational-surface.md), tombol tetap
  tombol.
- **Membuka empat fog map yang macet secara struktural** — beban konfirmasi,
  akurasi kategori, kategori kustom, budget chat-native semuanya menunggu "bukti
  pemakaian harian" yang **tidak mungkin terkumpul** selama menekan Edit
  menjebak.
- **Membuka jalan** bagi utang verifikasi produksi
  [22](22-persist-entry-description.md) dan
  [23B](23-draft-confirmation-surface.md) — keduanya terhalang bug ini.

## Ruang lingkup

**Sembilan balasan** di [`draft/logic.ts`](../../../src/worker/draft/logic.ts)
berubah dari `kind: "text"` menjadi `kind: "choice"`. Yang sudah membawa tombol
hanya **satu** — baris 47, prompt konfirmasi.

Baris yang tersentuh (per `210e5cf`, verifikasi ulang sebelum menyentuh):
`74`, `98`, `103`, `127`, `131`, `137`, `142`, `147`, `152`.

⚠️ **Belum diputuskan dan bukan wewenang tiket ini kalau ternyata berbeda:**
apakah kesembilannya pantas membawa **set tombol yang sama**. Tiket 24 butir 3
mencatatnya sebagai lubang terbuka. Dua yang paling patut dicurigai:

- **`74` — balasan setelah commit.** Draft-nya **sudah tidak menggantung**; kalau
  ia ikut membawa tombol, tombolnya menunjuk draft yang tidak ada lagi. Kandidat
  kuat untuk **dikecualikan**.
- **`98` — balasan setelah discard.** Alasan yang sama.

Kalau pemeriksaan menunjukkan lingkupnya bukan sembilan, **catat di sini dan
lanjut** — itu temuan, bukan penyimpangan. Yang tidak boleh berubah tanpa
kembali ke [24](24-edit-mode-escape.md): prinsip bahwa **tidak ada balasan
ber-draft-hidup yang tanpa jalan keluar terlihat**.

## Yang membuat slice ini murah

Mekanismenya **sudah terbukti di produksi** — `kind: "choice"` +
`sendChoicePrompt` adalah jalur yang dipakai prompt konfirmasi hari ini di
`6d432d89`. Ini pemakaian ulang, bukan barang baru.

`OutboundAction` sudah punya bentuknya
([`messaging/types.ts:37-39`](../../../src/worker/messaging/types.ts)) dan
`CONFIRM_PROMPT_OPTIONS` sudah ada
([`draft/copy.ts:3`](../../../src/worker/draft/copy.ts)). Tidak ada tipe baru
yang perlu dilahirkan.

## Definition of done

1. Setiap balasan yang dikirim **saat draft menggantung** membawa opsi.
2. Test yang **gagal kalau ada balasan ber-draft-hidup kembali jadi `text`
   polos** — ini penjaganya; tanpa itu regresinya akan kembali diam-diam.
3. `npx vitest run` hijau, `npx tsc -b` exit 0, `npx eslint .` nol error.
4. `/code-review` dijalankan sebelum commit terakhir (map mewajibkan; di tiket 30
   kedua axis menemukan cacat nyata yang lolos test hijau).
5. Deploy nyata + `wrangler tail` + **satu putaran manual di Telegram**: tekan
   Edit, ketik kalimat ngawur, pastikan tombol masih ada dan `[Batal]` bekerja.
6. Sekalian bayar utang: verifikasi [22](22-persist-entry-description.md)
   (`description` verbatim) dan [23B](23-draft-confirmation-surface.md) (balasan
   tiga baris + `Pengeluaran hari ini`) di produksi — **keduanya baru mungkin
   setelah slice ini mendarat**.

⚠️ **`npm run test:live` tidak wajib di sini** — slice ini tidak menyentuh
`env.AI`. Guardrail miniflare ≠ workerd tetap berlaku lewat butir 5 (jalur
`fetch` Telegram), tapi seam itu sudah terbukti di produksi.

## 🧊 Prasyarat — ✅ **DIBERIKAN 2026-08-05**

Pemilik repo memberikan **keduanya** sebelum slice ini dimulai:

1. ✅ **Pengecualian freeze #2** (jatah sebelumnya nol — #1 habis terpakai di
   [30](30-recovery-slice.md)). **Jatah kembali nol setelah slice ini.**
2. ✅ **Override eksekusi.** Berlaku untuk slice ini saja; map kembali
   planning-only setelah selesai.

`wrangler deploy` diblokir classifier harness untuk agent — **pemilik repo yang
menjalankannya**.

## Bukan bagian dari slice ini

Semua yang butuh panggilan-1, yaitu [24](24-edit-mode-escape.md) butir 1 dan 2
(`editState` kehilangan otoritas; dua maksud draft `batal` vs `tetap sama`).
Keduanya dititipkan ke implementasi [15](15-conversational-surface.md) bersama
substansi yang dulu bernama 23A. **Jangan tarik ke sini** — slice ini bernilai
justru karena tidak menyentuh AI.

## Kemajuan (2026-08-05)

**Lingkupnya tujuh di `draft/logic.ts`, plus empat hal yang `/code-review`
temukan dan slice ini ikut tutup.** Estimasi sembilan di § Ruang lingkup salah
di kedua arah: dua dikecualikan dengan benar, tiga terlewat di luar
`draft/logic.ts`, dan satu jalan keluar ternyata mati.

### Yang dibangun

1. **Tujuh balasan `draft/logic.ts`** `text` → `choice`. `committedReply` dan
   balasan `discard` **dikecualikan** — draft sudah hilang; `commitFailed` juga,
   alasan sama. Dugaan di § Ruang lingkup terbukti benar.
2. 🔴 **Tombolnya ternyata MATI, dan itu temuan paling serius slice ini.**
   ADR-0004 §2 menormalkan tap jadi `{kind:'text', text:<option.id>}`, dan
   `coordinator.ts` merutekan ke `decideEditValue` selama `editState` aktif —
   yang tak pernah memanggil `parseDraftCommand`. Jadi `[Batal]` yang baru
   dipasang mengirim teks `"discard"` → `parseEditField` → `null` → `retry`.
   **Jalan keluar yang dipajang tapi tidak berfungsi lebih buruk daripada tidak
   ada.** Diperbaiki: command menang atas jalur edit-value.
   ⚠️ Ini juga menjawab sebagian [24](24-edit-mode-escape.md) butir 2 **tanpa
   model**: `[Konfirmasi]` saat mode edit **adalah** "tetap sama" yang
   deterministik.
3. **Tiga balasan ber-draft-hidup di luar `draft/logic.ts`** ikut ditutup lewat
   `keepEscapeHatch`: pesan non-teks (dipindah ke bawah pembacaan draft),
   `systemTroubleReply`, dan `buildParseReply` di jalur `fall_through` — yang
   terakhir **bentuk jebakan tiket 24 persis, di luar mode edit**.

### Penjaganya

Unit (`test/draft-pending-reply-options.test.ts`) + integrasi di
`test/ledger-webhook.test.ts` — yang kedua wajib, karena tap tombol hanya nyata
di seam webhook dan tiga balasan di atas hidup di `coordinator.ts`.

⚠️ **Batas penjaga yang harus diketahui:** klasifikasi eksaustif memakai
`Record<DraftDecision["kind"], …>`, yang **tidak dicek `npx tsc -b`** — root
`tsconfig.json` tidak mereferensi `test/`. Diverifikasi dengan menambah kind
percobaan: `tsc -b` exit 0, `tsc -p test/tsconfig.json` TS2741. Sampai celah itu
diputuskan (fogged di `map.md`), jalankan perintah kedua manual setelah menyentuh
`DraftDecision`.

### Belum: DoD 5 dan 6

Deploy nyata, `wrangler tail`, putaran manual Telegram, dan verifikasi produksi
[22](22-persist-entry-description.md) + [23B](23-draft-confirmation-surface.md)
**belum dikerjakan** — `wrangler deploy` diblokir classifier untuk agent, dan
verifikasi Telegram butuh pemilik repo mengetik sendiri.

### Ketegangan kosakata yang tidak diputuskan di sini

`CONTEXT.md` mendefinisikan **choice prompt** sebagai *"pesan yang meminta user
memilih satu dari set opsi tetap"*. Balasan seperti *"Jumlahnya jadi berapa?"*
sekarang berbentuk `choice` tapi memintanya **teks bebas** — opsinya jalan
keluar, bukan jawaban. Istilahnya jadi meregang. Ini pekerjaan
`/domain-modeling`, bukan slice eksekusi; dicatat, tidak diputuskan.

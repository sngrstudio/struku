# 26 — Struku mempelajari kebiasaan pengeluaran

Type: grilling
Status: open
Blocked by: 16

## Question

Permintaan pemilik repo saat grilling [15](15-conversational-surface.md)
(2026-08-02), verbatim:

> Struku juga harus mempelajari kebiasaan pengeluaran seiring penggunaan, tanpa
> dibatasi reset harian.

[15](15-conversational-surface.md) butir 7 **memisahkan ini** dari ringkasan
percakapan, dan menunda keputusannya ke sini. Alasan pemisahannya bukan
administratif — **sumber datanya berbeda**:

- **Konteks percakapan** lahir dari ngobrol → ringkasan yang disusun model,
  reset harian ([15](15-conversational-surface.md) butir 5–6). Sudah diputuskan.
- **Kebiasaan belanja** lahir dari **ledger** — sudah terstruktur dan akurat di
  D1. *"Biasanya kopi 20rb tiap pagi"* itu hasil `GROUP BY`, bukan kesan
  percakapan.

Kalau kebiasaan dititipkan ke ringkasan model, ia jadi **pola tebakan**: model
menulis *"user sering belanja besar"* dari kesan ngobrol, bukan dari angka. Di
bot keuangan itu bentuk halusinasi yang paling halus — tidak mengarang angka,
tapi mengarang **pola**, dan jauh lebih sulit ketahuan.

Yang harus diputuskan:

1. **Apa yang dihitung sebagai "kebiasaan"?** Rata-rata per kategori? Merchant
   yang sering muncul (butuh [22](22-persist-entry-description.md) —
   `description` verbatim)? Jam/hari yang berpola? Jangan pilih semuanya; tiap
   tambahan adalah query dan prompt yang lebih panjang.
2. **Dipakai untuk apa?** Tiga kegunaan yang sangat berbeda ongkosnya:
   - **Rasa personal** — bot menyebut kebiasaan saat ngobrol (ini yang diminta).
   - **Menebak lebih baik** — kebiasaan diumpankan ke panggilan-1 agar kategori
     lebih akurat. ⚠️ Ini menambah variabel ke satu-satunya komponen yang, setelah
     [15](15-conversational-surface.md) butir 3, menentukan uang tercatat.
   - **Proaktif** — bot berkomentar sendiri soal pola. Mendekati alert/anomali,
     yang **out of scope** di map (PRD §5.2, sudah dicoret di SRS §1.2).
3. **Dihitung kapan?** Query tiap pesan (mahal, selalu segar) vs cache berkala di
   DO SQLite (murah, bisa basi). ADR-0006 menaruh state per-user di
   `this.sql`, dan pola `INSERT ... ON CONFLICT DO UPDATE` sudah dipakai
   `onboarding_context` — infrastrukturnya sudah ada.
4. **Berapa data minimum sebelum "kebiasaan" berarti?** D1 produksi dikosongkan
   2026-08-01 (0 entry). Menyimpulkan pola dari 3 transaksi menghasilkan bot yang
   percaya diri dan salah — lebih buruk daripada tidak menyebut apa-apa.
5. **Bagaimana ia masuk ke prompt?** [15](15-conversational-surface.md) butir 1
   memutuskan angka disisipkan app lewat **slot**, model tidak pernah menerima
   nilai mentah. Kebiasaan adalah angka. Jadi ia harus lewat mekanisme slot yang
   sama — dan bentuk kontrak slot itu sendiri **belum dirancang**
   ([15](15-conversational-surface.md) § Yang belum tertutup, butir 5).

## Kenapa blocked by 16

Bahan bakunya adalah agregasi ledger, dan itu persis yang
[16 · Permukaan query reporting](16-reporting-query-surface.md) putuskan — yang
sendirinya masih *blocked by* [14](14-d1-aggregate-query-capability.md) dan
[20](20-stats-refresh-trigger.md).

Memutuskan tiket ini sebelum 16 berarti merancang query agregat dua kali dengan
bentuk yang mungkin bertabrakan. Tiga jebakan riset
[14](14-d1-aggregate-query-capability.md) berlaku penuh di sini juga: `PRAGMA
optimize` (a), `accounts.type` bukan `direction` (b), dan filter `status` (c).

## Catatan

- **Tanpa reset harian** — ini ingatan yang menumpuk, berbeda dari ringkasan
  percakapan. Tapi "tanpa reset" ≠ "tanpa batas": butir 1 dan 4 tetap harus
  membatasi apa yang disimpan.
- Bersinggungan dengan fog **"Akurasi kategori pada pemakaian nyata"** di map —
  kalau kebiasaan dipakai untuk menebak lebih baik (butir 2), sebagian fog itu
  ikut terjawab.

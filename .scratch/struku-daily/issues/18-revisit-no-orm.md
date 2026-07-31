# 18 — Revisit keputusan no-ORM, sekarang reporting nyata

Type: grilling
Status: open
Blocked by: 14, 16

## Question

Tracer #1 sengaja memakai repo tipis per-user di atas D1 dengan **SQL tulisan
tangan dan migrasi manual — tanpa ORM** (bukan Drizzle). Keputusan itu dicatat
dengan syarat eksplisit: **revisit at reporting.** Reporting sekarang nyata, jadi
syaratnya terpenuhi. Tiket ini menutup janji itu — dengan jawaban apa pun,
termasuk "tetap tanpa ORM".

Yang harus diputuskan:

1. **Apakah alasan aslinya masih berlaku?** SQL tangan menang saat query-nya
   sedikit, bentuknya stabil, dan menulisnya sekali. Query agregat lintas rentang
   tanggal dengan pengelompokan kategori dan bucketing sadar timezone adalah
   justru tempat argumen itu paling lemah. Tapi "paling lemah" ≠ "kalah" —
   ukur terhadap query yang **sebenarnya** dibutuhkan [16](16-reporting-query-surface.md),
   bukan terhadap reporting hipotetis.
2. **Apa yang sebenarnya sakit?** Pisahkan keluhan yang berbeda: menyusun SQL,
   memetakan baris ke tipe, keamanan tipe pada hasil query, atau evolusi skema
   (migrasi). Bisa jadi hanya satu yang sakit — dan obatnya mungkin query builder
   atau helper mapping, bukan ORM penuh. Jangan biarkan pertanyaan ini melebar
   jadi "ORM: ya/tidak" kalau yang sakit cuma satu bagian.
3. **Apa ongkos pindahnya sekarang?** Skema sudah hidup dengan data nyata dan dua
   migrasi terpakai. Mengadopsi ORM berarti memperkenalkannya ke kode yang sudah
   berjalan dan diuji — termasuk `writer.ts` yang menjaga invarian double-entry.
   Adopsi parsial (ORM hanya untuk jalur baca/reporting, SQL tangan tetap untuk
   jalur tulis) itu pilihan sah — timbang, jangan langsung tolak.
4. **Bagaimana ini berinteraksi dengan Workers?** Ukuran bundle, cold start, dan
   kompatibilitas dengan D1 di workerd. Kalau ini jadi faktor penentu, jangan
   jawab dari ingatan — **AGENTS.md menetapkan aturan STOP**; ambil dokumentasi
   terkini, atau pecah jadi tiket research tersendiri.

**Diblokir oleh [14](14-d1-aggregate-query-capability.md) dan
[16](16-reporting-query-surface.md) dengan sengaja.** Memutuskan soal ORM sebelum
tahu query apa yang harus ditulis (14) dan laporan apa yang harus dihasilkan (16)
berarti memilih perkakas sebelum tahu pekerjaannya. Kalau ada sesi yang tergoda
mengerjakan tiket ini lebih dulu — itu tandanya urutannya sedang dilanggar.

Apa pun hasilnya, tulis sebagai ADR — termasuk kalau jawabannya "tetap seperti
sekarang". Keputusan untuk tidak berubah, setelah ditinjau, tetap keputusan yang
layak dicatat.

# 20 — Kapan `PRAGMA optimize` dijalankan, sekarang migrasi terbukti bukan tempatnya

Type: grilling
Status: open
Blocked by: —

## Question

Verifikasi `--remote` di [14](14-d1-aggregate-query-capability.md) mengonfirmasi
produksi tidak punya `sqlite_stat1` sama sekali, dan tanpa itu planner
mengabaikan `idx_journal_entries_user_date` — filter rentang tanggal tidak
menyaring apa pun (58.116 vs 7.278 VM step pada 2000 entry, dan rasionya melebar
seiring ledger tumbuh).

Perbaikan yang kelihatan jelas — taruh `ANALYZE` di migrasi — **sudah diuji dan
gagal**: migrasi jalan sekali pada DB kosong, `ANALYZE` di DB kosong tidak
menulis statistik apa pun, dan begitu ledger terisi planner balik ke rencana
yang salah. Migrasi `0003` sempat ditulis lalu dibuang.

Jadi pertanyaan yang tersisa adalah **kapan**, bukan **apakah**:

- Di mana `PRAGMA optimize` dipanggil — cron trigger terjadwal, sesudah commit
  ke-N, saat startup Durable Object, atau saat query reporting pertama?
- Berapa sering cukup? Ledger satu user tumbuh pelan; statistik basi yang
  *mendekati* benar jauh lebih baik daripada tidak ada sama sekali.
- Apakah ini perlu jadi ADR, atau cukup catatan operasional? (Ia menyentuh
  jalur tulis, jadi kemungkinan besar ADR.)
- Apakah keputusannya berubah kalau [18](18-revisit-no-orm.md) memilih ORM?
  Riset 14 bilang tidak — ini urusan operasional skema, bukan layer akses data —
  tapi itu asumsi yang belum diuji ke pemilik repo.

Konsekuensinya nyata untuk [16](16-reporting-query-surface.md): mengunci bentuk
query tanpa memutuskan ini berarti mengunci query yang index-nya tidak terpakai
di produksi.

## Catatan

Angka wall-clock pada volume hari ini (~4 ms, tak terasa) menunjukkan ini
**belum** mendesak untuk kenyamanan harian — dampaknya ke rows read yang
ditagih, dan ke perilaku saat ledger sudah besar. Jangan sampai ini
meng-hijack prioritas di atas tiket yang benar-benar menghalangi pemakaian
harian.

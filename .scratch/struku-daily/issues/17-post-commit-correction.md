# 17 — Koreksi transaksi setelah commit: apa arti "salah, benerin dong"

Type: grilling
Status: open
Blocked by: —

## Question

Pemilik repo melaporkan ini **sudah terjadi** — sebuah transaksi masuk ke
kategori yang salah, dan tidak ada cara membenarkannya. Di tracer #1, "edit"
hanya berarti mengubah **draft yang belum di-commit**; begitu terkonfirmasi,
entry-nya beku.

Yang harus diputuskan:

1. **Model koreksinya apa?** ADR-0002 sudah memesan kapasitasnya — kolom `status`
   dan `reverses_entry_id` ada justru untuk ini, dan ledger-nya **append-only**.
   Jadi pertanyaannya bukan "boleh di-UPDATE atau tidak" (jawabannya sudah:
   tidak) — tapi apakah koreksi = membalik + memposting ulang, atau ada bentuk
   lain yang tetap menghormati append-only. Apa yang user lihat setelahnya:
   satu transaksi yang "berubah", atau jejak dua entry?
2. **Bagaimana user menunjuk transaksi yang salah?** Ini bagian yang paling
   tidak jelas dan mungkin yang paling menentukan. "yang tadi", "kopi tadi pagi",
   "yang 25rb". Perhatikan preseden: ADR-0004 §2 mengunci `callback_data` ke
   `confirm`/`edit`/`discard` **tanpa draft id**, sehingga disambiguasi
   multi-draft bersifat **LIFO** — balasan mengenai draft yang paling baru.
   Apakah aturan yang sama masuk akal untuk transaksi terkomit ("yang barusan"),
   atau koreksi butuh cara menunjuk yang lebih eksplisit — dan kalau iya, dari
   mana user melihat pilihannya? **Ini menyentuh [16](16-reporting-query-surface.md)
   secara langsung:** "lihat transaksi terakhir" mungkin adalah prasyarat untuk
   bisa menunjuk mana yang salah.
3. **Sejauh apa yang bisa dikoreksi?** Kategori saja (keluhan nyatanya), atau
   jumlah, tanggal, metode pembayaran, dan penghapusan penuh? Yang paling sempit
   yang menyelesaikan keluhan nyata adalah kandidat yang sah — jangan otomatis
   pilih yang paling lengkap.
4. **Apakah koreksi butuh konfirmasi?** Membalik entry lebih berat daripada
   membuatnya. Timbang terhadap beban konfirmasi yang sudah ada.

**Catatan — jangan salah kejar.** Frasa persis transaksi yang meleset itu **tidak
tercatat**, dan pemilik repo secara sadar memilih tidak mengejarnya (sedang
melihat gambaran besar). Jadi tiket ini adalah tentang **bisa membenarkan**, bukan
tentang memperbaiki akurasi parsing. Kalau ternyata polanya sistematis, itu fog
terpisah yang sudah dicatat di map ("Akurasi kategori pada pemakaian nyata") dan
akan jadi tiket sendiri kalau buktinya terkumpul.

§3.7 (post-commit editing/reklasifikasi/reversal) ada di Out of Scope **spec
tracer #1** — itu benar untuk tracer #1 dan tidak lagi mengikat di sini; map ini
punya destination yang berbeda dan keluhannya sudah nyata.

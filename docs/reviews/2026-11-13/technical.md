Penilaian saya: **ProofBill merupakan MVP testnet yang substansinya bisa diperiksa, dengan kontribusi paling kuat pada NFT yang membawa hak finansial dan pembatasan tindakan agen.** Namun, penerapan agen masih sempit, privasi bergantung pada operator, dan ada celah alur antrean yang berpotensi membuat pass yang belum dipakai tidak dapat menjalankan layanan melalui aplikasi.

Saya menilai fresh clone publik pada **HEAD `c2dc88b50d7cf92b0b57e024578dfe7a0c556b49`**, disimpan terpisah di `[isolated public clone]`. Saya tidak membaca checkout builder, `.env`, kredensial, percakapan lain, atau memory proyek. Penilaian berikut merupakan review terbatas untuk judging, bukan audit keamanan.

**Produk dan pengguna yang saya temukan**

ProofBill menjual satu hak pembelian layanan AI melalui **NFT Purchase Pass**. Pengguna yang dituju adalah developer atau tim kecil yang mengoperasikan agen berbayar dan ingin menghubungkan izin pengeluaran, output layanan, serta pembayaran ke satu catatan yang bisa diperiksa.

Alur yang diimplementasikan adalah:

1. Holder membuat NFT dengan alokasi layanan **0,010 native testnet NEAR**, ditambah **0,030 NEAR untuk storage**, serta expiry.
2. Sebelum order direservasi, holder dapat mentransfer NFT; hak penggunaan dan refund mengikuti holder baru, sedangkan penugasan agen lama dibatalkan.
3. Holder menugaskan akun agen yang dibatasi. Agen mereservasi satu order dengan seller, harga, model, dan commitment yang terikat.
4. Worker memanggil NEAR AI Cloud untuk mengekstrak `item`, `quantity`, dan `requested_by` dari brief. Verifier memeriksa byte respons, signature model, dan beberapa bukti attestation.
5. Historical buyer membaca hasil privat, lalu secara terpisah menyetujui pembayaran melalui wallet.
6. Kontrak mentransfer dana ke seller. Callback yang berhasil mengubah order menjadi Paid dan NFT menjadi Completed. Jika layanan ditolak sebelum pembayaran, alokasi layanan dapat direfund.

Jadi, buyer tidak memberi agen kebebasan membeli apa saja. Ini adalah pembelian satu layanan yang telah ditentukan, dengan konfirmasi pembayaran manusia. Model bisnis dan pain point terlihat dalam [README](https://github.com/EndPx/proofbill/blob/c2dc88b50d7cf92b0b57e024578dfe7a0c556b49/README.md) dan [product specification](https://github.com/EndPx/proofbill/blob/c2dc88b50d7cf92b0b57e024578dfe7a0c556b49/docs/planning/PRODUCT-SPEC.md).

**Apa yang saya verifikasi sendiri**

- `pnpm install --frozen-lockfile`: berhasil.
- `pnpm check`: berhasil untuk seluruh empat package yang diperiksa.
- `pnpm test`: **3/3 berhasil**, mencakup presisi amount, aturan transfer, dan authenticated encryption.
- `pnpm build`: berhasil menghasilkan build Next.js 16.4.6.
- Homepage, `/api/config`, `/api/order/pass-2-order`, dan `/api/pass/pass-2`: HTTP 200.
- Akses anonim ke `/api/private/pass-2-order`: **HTTP 401 `AUTHENTICATION_REQUIRED`**.
- RPC testnet langsung: `pass-2-order` Paid; pass terkait Completed.
- RPC transaksi payout: receipt seller berhasil dan callback mencatat `payment_succeeded` untuk **0,010 NEAR**. [Transaksi payout](https://testnet.nearblocks.io/txns/EKHAhwbEjwJos2sAzc7kxvHAnuA4aYS24H7TmjeeKj5Z).
- RPC transaksi pembayaran ulang: ditolak dengan **`ORDER_NOT_PAYABLE`**. [Transaksi duplikat](https://testnet.nearblocks.io/txns/68kMbxpYj3uxqekXBnJVwWEqATx2MrcTsTf6ENduXJZ1).
- Public key transaksi reservation cocok dengan key yang hanya diizinkan memanggil `reserve_order` pada kontrak ProofBill. Public key transaksi delivery cocok dengan key `publish_delivery` yang juga dibatasi ke kontrak itu. Keduanya berbeda dari FullAccess operator keys yang masih tercatat. [Reservation](https://testnet.nearblocks.io/txns/7L5yX1XcyydLyYdgsApsajWqoPrPUTAjXuCBwv3BusLk), [delivery](https://testnet.nearblocks.io/txns/6yyj4vxrwoWJzr3tkyaA4P5N3G4TgDZ7JzddcVZdDng8).

Saya **tidak** melakukan signing, transaksi, inference berbayar, atau login sebagai buyer. Saya juga tidak menjalankan ulang Rust/Sandbox: toolchain yang terpasang tidak mencakup versi `1.99.1` yang dipin repo. Hasil Rust/Sandbox dan authenticated buyer-versus-nonbuyer test tetap saya perlakukan sebagai **bukti yang disediakan tim**, bukan eksekusi saya. Inference baru juga tidak saya jalankan.

**Scorecard delapan kriteria**

| Kriteria | Nilai | Alasan |
|---|---:|---|
| GitHub — commit history | **C** | Ada tiga commit pada 13 November, dari 01:45 sampai 03:44 WIB. Urutannya masuk akal—perencanaan/probe, implementasi besar, lalu TLS/hosting—tetapi hampir seluruh produk masuk dalam satu commit implementasi. Jejak iterasinya tipis. Ini tidak membuktikan kode disalin atau pekerjaan dilakukan di luar window. |
| GitHub — kualitas kode dan arsitektur | **B** | Pembagian kontrak, worker, verifier, persistence, serta frontend cukup jelas. Amount memakai integer, pembayaran ditentukan callback, private data memakai AES-GCM dengan konteks buyer/order, dan operational keys dibatasi. Ada kelemahan pemulihan antrean ketika ownership/revision berubah sebelum reservation; lihat temuan pertama. |
| GitHub — kelengkapan dokumentasi | **A** | README menjelaskan produk, biaya, scope testnet, setup, source map, transaksi, serta batas publisher dan privasi. Instruksi install/check/test/build dapat saya jalankan dari clone baru. Full flow tetap memerlukan konfigurasi database, operator, dan provider sendiri, yang dijelaskan sebagai prasyarat. |
| Value / problem statement | **B** | Masalah rekonsiliasi izin–hasil–pembayaran cukup spesifik dan masuk akal. Tetapi belum ada bukti bahwa pengguna sasaran mengalami pain ini cukup berat untuk menerima tambahan minting, assignment, login, dan wallet approval bagi ekstraksi tiga field. |
| ICP / audience | **B** | “Developer atau tim kecil yang mengoperasikan paid-API agents” sudah dapat dibayangkan. Belum ada segmentasi workload, volume transaksi, failure cost, atau kebutuhan compliance yang membuat pembelian melalui NFT menjadi kebutuhan yang jelas. |
| Metrics / validation | **B** | Ada validasi teknis nyata, public chain evidence, serta integration records yang konsisten dengan beberapa pemeriksaan independen saya. Belum ada customer testing, benchmark kualitas ekstraksi, perbandingan dengan workflow lain, atau willingness-to-pay. Dua scripted project accounts tidak dihitung sebagai traction. |
| GTM materials | **C** | Ada rencana mengajak developer paid-API agents menguji receipt dan pass, kemudian mengeksplorasi hosted team plan/service fee. Belum ada channel akuisisi, calon pilot bernama, atau urutan distribusi yang konkret. GTM bukan persyaratan resmi yang saya temukan dalam aturan ini. |
| Demo URL / video / deck | **B**, terbatas | App dan API publik hidup; receipt dapat dicocokkan ke chain. Private flow memerlukan wallet dan saya tidak menguji browser signing. Saya tidak menemukan demo-video atau demo-post spesifik dalam bahan yang tersedia. Deck tidak disediakan dan **bukan kewajiban resmi** yang saya tambahkan sendiri. |

Kalibrasi history berasal dari `git log` fresh clone. Untuk persyaratan resmi, [aturan NEAR](https://nearhackathon.com/HACKATHON.md) menyatakan testnet eligible, hosted demo merupakan nilai tambah, dan demo post publik di X perlu disiapkan. Aturan itu tidak menetapkan pitch deck sebagai syarat.

**Kecocokan dan kesiapan empat track**

Skor berikut **bukan skor resmi NEAR**, melainkan penilaian fit/readiness saya dengan bobot sama.

| Track | Skor /10 | Penilaian |
|---|---:|---|
| Agent Economy | **6,0** | Agen benar-benar mereservasi layanan dengan identitas onchain dan menghasilkan proses pembelian. Namun pilihan layanan, seller, harga, serta model semuanya tetap; worker deterministik dan pembayaran tetap memerlukan holder. Kontribusinya adalah bounded agent purchasing, belum pasar atau ekonomi antaragen yang kaya. |
| AI Security & Defense | **7,0** | Fixed payee/amount, restricted function-call keys yang benar-benar digunakan, stale revision/holder checks, single-use order, serta callback-driven settlement adalah kontrol substantif. Coverage failure/recovery dan trusted publisher masih membatasi kedalaman bukti. |
| Privacy & Private AI | **6,0** | Ada jalur actual provider evidence, encrypted artifacts, authenticated private reads, serta pemisahan public receipt dari plaintext. Namun operator memproses plaintext; source/image allowlist dan TLS connection binding belum diperiksa, NRAS JWT chain tidak diverifikasi lokal, dan kontrak percaya publisher offchain. Ini private AI dengan trust boundary yang dijelaskan, bukan sistem operator-blind. |
| NFTs That Do Something | **8,0** | NFT membawa hak penggunaan serta refund yang benar-benar berpindah bersama ownership, assignment lama dibatalkan, active order mengunci transfer, dan state terminal tercermin pada metadata. Ini kontribusi track paling langsung. Race antrean sebelum reservation mengurangi kesiapan penggunaan nyata. |
| **Rata-rata aritmetika** | **6,75 /10** | `(6 + 7 + 6 + 8) / 4` |

**Tiga kelemahan terpenting, berdasarkan dampak**

1. **Job pemilik lama dapat menghalangi holder baru memakai NFT yang masih Available. — Inferred dari kode, belum direproduksi.**

   Trigger konkretnya: Alice mengirim `POST /api/jobs` ketika pass Available; job privat masuk antrean memakai ID tetap `pass-X-order`. Sebelum worker melakukan `reserve_order`, Alice mentransfer NFT ke Bob. Kontrak mengizinkan transfer karena state onchain masih Available, lalu menghapus assignment dan menaikkan revision. Bob melakukan assignment baru. Saat worker memproses job Alice, pemeriksaan owner/revision menolaknya dan row ditandai failed. Ketika Bob mengirim job baru, insert dengan ID order sama terkena conflict dan mengembalikan `ORDER_ALREADY_QUEUED`.

   Bukti:

   - [API route baris 193–206](https://github.com/EndPx/proofbill/blob/c2dc88b50d7cf92b0b57e024578dfe7a0c556b49/apps/web/src/app/api/%5B...path%5D/route.ts#L193): ID order tetap dan `on conflict ... do nothing`.
   - [Worker baris 88–94](https://github.com/EndPx/proofbill/blob/c2dc88b50d7cf92b0b57e024578dfe7a0c556b49/workers/agent/src/index.ts#L88): penolakan owner/revision berubah; [baris 229](https://github.com/EndPx/proofbill/blob/c2dc88b50d7cf92b0b57e024578dfe7a0c556b49/workers/agent/src/index.ts#L229): row tetap ada sebagai failed.
   - [Unique indexes baris 45–46](https://github.com/EndPx/proofbill/blob/c2dc88b50d7cf92b0b57e024578dfe7a0c556b49/packages/server/src/relations.sql#L45).
   - [Kontrak baris 563–575](https://github.com/EndPx/proofbill/blob/c2dc88b50d7cf92b0b57e024578dfe7a0c556b49/contracts/proofbill/src/lib.rs#L563): transfer hanya mengetahui reservation onchain.

   **Efeknya adalah layanan tertahan melalui app, bukan bukti dana pokok hilang.** Holder baru masih memiliki jalur refund di [baris 363–382](https://github.com/EndPx/proofbill/blob/c2dc88b50d7cf92b0b57e024578dfe7a0c556b49/contracts/proofbill/src/lib.rs#L363).

   Perbaikan terkecil: sediakan supersession atomik untuk job stale yang terbukti **belum direservasi dan belum melakukan provider attempt**, terikat pada holder/revision terbaru. Tambahkan satu integration test urutan queue → transfer → reassignment → new job, termasuk proteksi agar pekerjaan yang sudah mulai tidak dieksekusi dua kali.

2. **Bukti private AI belum membentuk jaminan menyeluruh dari input buyer sampai kebijakan kode yang menjalankan model. — Batas desain yang terlihat, bukan exploit yang saya reproduksi.**

   Verifier mengikat signature terhadap exact request/response dan signer attested. Tetapi source/image allowlist belum diperiksa; konfigurasi yang terikat pada quote tidak otomatis membuktikan aplikasi yang dikehendaki buyer. App operator juga dapat membaca plaintext, sedangkan kontrak menerima statement publisher tanpa memverifikasi bukti hardware sendiri. Implementasi dan disclosure konsisten pada [verifier baris 16–45 dan 83–85](https://github.com/EndPx/proofbill/blob/c2dc88b50d7cf92b0b57e024578dfe7a0c556b49/workers/inference/inference.py#L16) serta [publisher gate kontrak](https://github.com/EndPx/proofbill/blob/c2dc88b50d7cf92b0b57e024578dfe7a0c556b49/contracts/proofbill/src/lib.rs#L243).

   Perbaikan terkecil untuk judging: tambahkan satu replay/verifier command tanpa secret yang memeriksa artefak publik lengkap, menampilkan policy yang diterima, dan menolak tampering. Tunjukkan private inference guarantee serta kepercayaan pada operator/publisher sebagai dua hal terpisah. Untuk memperluas jaminan teknis, acceptance policy perlu mengenali source/image yang diizinkan.

3. **Kebutuhan pengguna dan kelayakan layanan berbayar belum tervalidasi. — Observasi bahan publik.**

   Pengguna harus menjalani beberapa langkah wallet untuk layanan ekstraksi sederhana; belum ada pengukuran apakah receipt, transfer right, dan kontrolnya menghemat waktu atau mengurangi kerugian dibanding API key budget dan log biasa. Seller menanggung inference credits terlebih dahulu, sementara buyer boleh melihat hasil lalu meminta refund. Itu tradeoff yang diakui, tetapi belum ada data apakah seller akan menerima model ekonomi ini. Lihat [product specification, bagian customer dan business](https://github.com/EndPx/proofbill/blob/c2dc88b50d7cf92b0b57e024578dfe7a0c556b49/docs/planning/PRODUCT-SPEC.md).

   Perbaikan terkecil: minta **3–5 operator paid-API agents** mencoba satu purchase, catat waktu, titik kebingungan, alasan membutuhkan transfer/refund, dan apakah mereka mau memakai lagi. Pilih satu workload bernilai lebih tinggi sebagai wedge. Ini lebih menaikkan kredibilitas produk daripada menambah seller/model sebelum usefulness terbukti.

**Verdict naratif**

ProofBill cukup menonjol sebagai **demonstrasi hak pembelian NFT yang terhubung ke pembayaran agen**. Saya melihat hubungan nyata antara ownership, otorisasi agen, delivery commitment, payout receipt, dan status NFT; ini lebih kuat daripada NFT yang hanya menempel pada metadata atau dashboard AI yang hanya menampilkan transaksi dummy.

Saya belum menempatkannya sebagai kandidat unggulan yang jelas untuk seluruh empat track. Bukti NFT dan kontrol pengeluaran lebih matang daripada ekonomi agen dan proposisi private AI secara menyeluruh. Hal yang paling menahan penilaian tinggi adalah usefulness yang belum diuji, race antrean pada transfer, serta belum tersedianya bukti presentasi publik yang memperlihatkan satu complete buyer journey tanpa akses builder.

Public demo-post yang diwajibkan aturan **belum dapat saya verifikasi dari bahan yang ditemukan**. Itu merupakan item submission yang perlu dicek, bukan tuduhan bahwa submission pasti tidak memenuhi syarat. Saya tidak menjadikan deck yang tidak tersedia sebagai kegagalan persyaratan resmi.

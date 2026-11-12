# ProofBill — Independent Blind Judge: First-Time Experience

Penilaian cold review: ProofBill adalah MVP testnet yang substansial dan cukup rapi, tetapi pengalaman juri belum memperlihatkan seluruh nilai produknya tanpa akses pembeli. Kontribusi terkuatnya adalah NFT yang membawa hak pembelian/refund dan pembatasan pembayaran agent. Kelemahan terbesar ada pada pembuktian manfaat bagi pengguna, akses ke demonstrasi lengkap, dan sempitnya layanan yang dipakai untuk menunjukkan ide tersebut.

Fresh public clone: [isolated public clone]. Reviewed HEAD: c2dc88b50d7cf92b0b57e024578dfe7a0c556b49. Review tidak memakai memory, checkout builder, .env privat, wallet yang sudah login, atau penjelasan arsitektur dari pembuat. Tidak ada signature, transaksi, inference berbayar, atau perubahan data live yang dilakukan. Laporan ini mempertahankan snapshot serta penilaian semula; tidak menilai HEAD baru.

## Pemahaman produk ketika dibaca pertama kali

ProofBill membantu developer atau tim kecil yang memakai agent berbayar untuk menghubungkan izin pembelian, hasil layanan, dan pembayaran. Pembeli membuat NFT Purchase Pass yang didanai; NFT mengikat satu layanan, seller, model, harga tetap dan expiry. Agent menjalankan layanan ekstraksi brief menjadi item, quantity, dan requested_by. Pembeli melihat hasil privat, meninjau evidence, lalu menyetujui pembayaran tepat kepada seller. Pass menjadi Completed setelah transfer berhasil. Pass yang belum digunakan dapat dipindahkan beserta hak penggunaan/refund kepada holder baru.

Pelanggan awalnya masih berupa hipotesis: developer/tim kecil pengguna paid-API agents. Saya dapat membayangkan pain point rekonsiliasi dan kontrol pengeluaran tersebut, tetapi materi publik belum menunjukkan siapa yang sering mengalaminya, kerugiannya, atau mengapa workflow ini lebih layak daripada approval dan logging biasa. Pengakuan bahwa demand belum tervalidasi justru jelas dan jujur. [README, baris 13–28](https://github.com/EndPx/proofbill/blob/c2dc88b50d7cf92b0b57e024578dfe7a0c556b49/README.md#L13-L28)

## Scorecard

| Kriteria | Nilai A–F | Catatan utama |
|---|---:|---|
| GitHub — Commit History | C | Tiga commit dalam sekitar dua jam pada 13 November WIB; hampir seluruh implementasi masuk satu commit besar. Ada urutan plan → implementasi → TLS fix, tetapi jejak iterasi tipis. |
| GitHub — Code Quality | B | Implementasi nyata, pemisahan contract/API/worker/verifier jelas, pembayaran berbasis callback, integer amounts, buyer-scoped reads dan authenticated encryption. Test coverage lokal masih kecil; UI utama satu file 1.282 baris. |
| GitHub — Docs | B | README, arsitektur, env example, deployment identity, transaksi, evidence dan batas trust sangat membantu. Menjalankan flow lengkap tetap memerlukan provisioning layanan/keys/provider sendiri. |
| Value / Problem Statement | B | Pain point izin–delivery–payment konkret. Urgensi dan keunggulan dibanding approval/logging existing belum dibuktikan. |
| ICP / Audience | B | Developer/tim kecil paid-API agents cukup dapat dibayangkan, tetapi belum ada segmen awal atau workflow operasional yang lebih spesifik. |
| Metrics / Validation | C | Bukti implementasi dan testnet cukup kuat. Belum ditemukan user testing, benchmark manfaat, pelanggan independen, atau willingness-to-pay. |
| GTM Materials | C | Ada rencana meminta developer mencoba receipt/pass dan ide hosted team plan; belum ada kanal akuisisi, calon pilot, atau sequencing yang spesifik. |
| Demo URL / Video + Pitch Deck | C | App hidup, tampil rapi, receipt dan NFT publik bekerja. Hasil/evidence rinci terkunci; tidak ditemukan tautan demo video atau demo post X, maupun deck pada materi publik yang ditautkan. |

Riwayat bukan bukti bahwa proyek dibuat secara tidak sah. Semua commit yang terlihat berada dalam jendela build yang diizinkan. Yang lemah adalah kemampuan history untuk memperlihatkan proses pembangunan: dac19e7 01:45 WIB, 925552f 03:24 WIB, dan c2dc88b 03:44 WIB. Commit implementasi menambah 66 file; angka baris besarnya juga mencakup lockfiles, sehingga tidak saya perlakukan sebagai ukuran kualitas. [History publik](https://github.com/EndPx/proofbill/commits/main/)

## Yang benar-benar diverifikasi

- Browser Edge berhasil membuka landing, purchases workspace, pass creation form, wallet selector, public receipt, serta detail NFT. Kegagalan web reader membuka app bukan dihitung sebagai downtime.
- Wallet selector menampilkan Meteor, Intear, Ledger, Nightly dan NEAR CLI. Review berhenti sebelum login/signature.
- Form menjelaskan alokasi 0,010 testnet NEAR + 0,030 storage budget + gas, termasuk bahwa storage berbeda dari alokasi layanan yang dapat direfund. Ini transparan.
- [Receipt pass-2-order](https://proofbill-two.vercel.app/app/receipts/pass-2-order) menampilkan Paid, seller, jumlah 0,010 NEAR, timeline dan transaction references.
- Pembacaan langsung public NEAR RPC mengonfirmasi pass-2-order.phase = Paid, pass-2.phase = Completed, holder Bob, serta commitments yang sama dengan receipt UI.
- RPC untuk transaksi EKHAhwbEjwJos2sAzc7kxvHAnuA4aYS24H7TmjeeKj5Z mengembalikan successful seller receiver receipt dan callback payment_succeeded. Jadi pembayaran tersebut bukan sekadar badge frontend. [Transaksi pembayaran](https://testnet.nearblocks.io/txns/EKHAhwbEjwJos2sAzc7kxvHAnuA4aYS24H7TmjeeKj5Z)
- Anonymous GET /api/private/pass-2-order menghasilkan 401, sedangkan /api/order/pass-2-order menghasilkan 200 dengan public facts.
- Pada fresh clone, pnpm install --frozen-lockfile, pnpm check, pnpm test, dan pnpm build semuanya lulus. Terdapat 3 TypeScript tests. Working tree tetap bersih sesudah checks, sebelum penambahan laporan scratch ini.

Yang masih team-reported, bukan direproduksi: inference berbayar lengkap, akses Bob berhasil versus Alice ditolak, negative transaction tests, dan Sandbox callback/refund suite. Report serta kode pendukungnya ada, tetapi reviewer tidak masuk ke authenticated buyer view atau menjalankan operator e2e.ts. Rust/Sandbox tests juga tidak dijalankan ulang. [Hosted report](https://github.com/EndPx/proofbill/blob/c2dc88b50d7cf92b0b57e024578dfe7a0c556b49/docs/evidence/hosted-release.md), [integration record](https://github.com/EndPx/proofbill/blob/c2dc88b50d7cf92b0b57e024578dfe7a0c556b49/docs/evidence/integration/pass-2-order.json)

## Empat track — berbobot sama, tidak resmi

| Track | Skor /10 | Alasan |
|---|---:|---|
| Agent Economy (agents) | 7,0 | Agent benar-benar mereservasi order dan menjalankan layanan yang diikuti seller payout. Namun agent saat ini worker satu layanan/model; belum ada pemilihan penjual, negosiasi, atau konteks pembelian yang membuat manfaat ekonominya terasa kuat. |
| AI Security & Defense (security) | 7,5 | Pembatasan seller/harga, agent authorization, revision, one-order pass dan holder-approved payment relevan dengan track. State diubah sebelum transfer dan callback mengecek attempt. Publisher evidence tetap trust boundary aplikasi. |
| Privacy & Private AI (privacy) | 6,5 | Buyer-scoped access, encrypted artifacts dan implementasi verifikasi signature/TEE nyata. Operator memproses plaintext; TLS binding/source allowlist tidak dicek, dan NRAS JWT chain tidak diverifikasi lokal. Klaim dibatasi dengan cukup baik. |
| NFTs That Do Something (nfts) | 8,0 | NFT membawa alokasi layanan serta hak refund yang mengikuti holder, membatalkan assignment lama saat transfer, mengunci active order, dan mencerminkan terminal state. Ini perilaku NFT yang substantif. |

Rata-rata aritmetika tidak resmi: (7,0 + 7,5 + 6,5 + 8,0) / 4 = 7,25/10. Ini bukan formula atau skor resmi penyelenggara. Deskripsi track resmi memang menempatkan spending limits/function-call keys, private AI/TEE, agent commerce, dan NFT ownership-with-behavior sebagai arah yang relevan; protokol yang disebut adalah hints, bukan syarat wajib. [Aturan dan track resmi](https://nearhackathon.com/HACKATHON.md)

## Tiga kelemahan dengan dampak penjurian terbesar

### 1. Juri belum mendapat satu demonstrasi lengkap yang dapat ditonton/diinspeksi tanpa menjadi pembeli — Direproduksi

Trigger: buka [landing](https://proofbill-two.vercel.app/), masuk workspace, lalu buka public receipt. Workspace kosong tanpa wallet; public receipt menampilkan pembayaran, tetapi Your result is private dan individual evidence checks terkunci. Landing tidak menautkan contoh receipt atau walkthrough hasil. Efeknya: juri melihat kontrol keuangan yang masuk akal, tetapi tidak mengalami momen brief masuk → hasil yang berguna → review evidence → payment. Ini tidak berarti privacy harus dibuka; berarti perlu contoh sintetis yang sengaja dipublikasikan. Batas tersebut terlihat di [workspace.tsx, baris 633–775](https://github.com/EndPx/proofbill/blob/c2dc88b50d7cf92b0b57e024578dfe7a0c556b49/apps/web/src/components/workspace.tsx#L633-L775).

Perbaikan minimum: tautkan satu synthetic example lengkap dari landing dan empty state, serta video singkat actual browser flow sampai payment/refund dan perubahan NFT. Tautkan public demo post X di README. Saya tidak menemukan post itu; saya tidak menyimpulkan bahwa submission sudah melanggar aturan atau belum pernah dikirim. Deck opsional yang tidak tersedia bukan disqualification resmi.

### 2. Bukti teknis belum berubah menjadi bukti kebutuhan pengguna — Absennya materi teramati; dampak produk merupakan inferensi

Trigger: baca problem, ICP dan business section. Yang tersedia adalah hipotesis serta rencana validasi; dua project-owned scripted purchases membuktikan integrasi, bukan traction. Efeknya: pertanyaan mengapa developer mau menambah NFT, funding, assignment, signature, dan review untuk ekstraksi tiga field belum terjawab. [Product spec, baris 166–170](https://github.com/EndPx/proofbill/blob/c2dc88b50d7cf92b0b57e024578dfe7a0c556b49/docs/planning/PRODUCT-SPEC.md#L166-L170)

Perbaikan minimum: minta 3–5 developer paid-API agents menyelesaikan satu skenario; catat kebingungan, waktu review, alasan memakai transfer/refund, dan apakah mereka bersedia memakai lagi. Tambahkan satu baseline sederhana terhadap workflow mereka sekarang. Tulis hasil negatif juga.

### 3. Janji budget/agent commerce lebih luas daripada kontrol yang bisa dicoba — Direproduksi pada copy/form, didukung source

Trigger: landing berkata Set the service and spending limit; form hanya menyediakan satu layanan, harga tetap, dan pilihan expiry. Agent menjalankan request extraction yang tetap, bukan memilih pembelian. Efeknya: setelah headline yang luas, juri menemukan prepaid single-service approval flow; nilai NFT transfer/refund jauh lebih kuat daripada demonstrasi agent purchasing-nya. [Landing, baris 60–78](https://github.com/EndPx/proofbill/blob/c2dc88b50d7cf92b0b57e024578dfe7a0c556b49/apps/web/src/app/page.tsx#L60-L78), [form, baris 271–315](https://github.com/EndPx/proofbill/blob/c2dc88b50d7cf92b0b57e024578dfe7a0c556b49/apps/web/src/components/workspace.tsx#L271-L315), [agent request, baris 95–107](https://github.com/EndPx/proofbill/blob/c2dc88b50d7cf92b0b57e024578dfe7a0c556b49/workers/agent/src/index.ts#L95-L107).

Perbaikan minimum: selaraskan copy menjadi satu fixed-price purchase right, lalu demonstrasikan skenario konkret teammate menerima pass, holder lama kehilangan hak, holder baru memakai/refund, dan duplicate payment ditolak. Tidak perlu memperluas marketplace sebelum deadline untuk membuat kontribusi yang ada lebih meyakinkan.

## Narrative Verdict

Layak masuk shortlist pemeriksaan teknis, terutama untuk NFTs dan Security. Ini melewati batas mock UI dengan smart-contract label: ada kode, payment receipt yang dapat dicek, state NFT yang sesuai, build yang lulus, serta disclosure trust yang disiplin.

Namun saya belum akan menempatkannya sebagai kandidat pemenang keseluruhan hanya dari materi saat ini. Banyak kekuatan terbaiknya masih harus dicari di source/evidence, sementara manfaat praktis bagi pembeli belum teruji. Perbaikan paling bernilai sebelum submit adalah membuat satu perjalanan publik yang singkat, lengkap, dan dapat diverifikasi—kemudian mendukungnya dengan respons beberapa calon pengguna, bukan menambah lebih banyak fitur.

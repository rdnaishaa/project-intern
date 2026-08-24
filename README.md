# Approval Transmittal Dokumen HRBP — Local MVP

Prototype Node.js + Express + Tailwind CSS untuk requirement Approval Transmittal Dokumen HRBP.

## Scope
- Pengajuan transmittal
- Upload PDF/DOC/DOCX
- Pemilihan approver berurutan
- Approval / Reject
- Reject wajib catatan
- Signature capture sebagai evidence signed-off pada tahap approval
- Approval history
- Dashboard monitoring
- Simulasi notifikasi Web
- QR dibuat setelah semua approval selesai
- QR membuka halaman verification
- QR dapat di-download/print dan ditempel pada dokumen fisik

## Penting
PRD yang diberikan tidak menjelaskan mekanisme legal/e-signature atau bahwa signature harus otomatis ditanam ke PDF. Prototype ini menyimpan signature evidence per approval, tetapi tidak mengubah file PDF asli.

## Jalankan
```bash
npm install
npm run dev
```
Buka http://localhost:4000

## Demo user
- Faisal — Applicant / HRBP
- Budi — HRBP Manager / Bontang
- Andi — HR Manager / Gresik
- Sari — Head of HR / HO
- Rina — Management / Viewer

## Flow demo
1. Login Faisal.
2. Buat pengajuan dan pilih Budi → Andi → Sari.
3. Login Budi, approve + tanda tangan.
4. Login Andi, approve + tanda tangan.
5. Login Sari, approve + tanda tangan.
6. Login Faisal, buka dokumen, download QR.
7. Buka QR URL / scan QR untuk melihat verification page.

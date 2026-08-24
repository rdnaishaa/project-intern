const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 4000;
const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const UPLOADS = path.join(ROOT, 'uploads');
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

const DB_FILE = path.join(DATA, 'db.json');
const initial = {
  users: [
    { id: 1, name: 'Faisal Kurnia Nugraha', nik: '10160031', role: 'APPLICANT', position: 'HRBP Staff', area: 'HO', department: 'HRBP' },
    { id: 2, name: 'Budi', nik: 'EMP-BUDI', role: 'APPROVER', position: 'HRBP Manager', area: 'Bontang', department: 'HRBP' },
    { id: 3, name: 'Andi', nik: 'EMP-ANDI', role: 'APPROVER', position: 'HR Manager', area: 'Gresik', department: 'HR' },
    { id: 4, name: 'Sari', nik: 'EMP-SARI', role: 'APPROVER', position: 'Head of HR', area: 'HO', department: 'HR' },
    { id: 5, name: 'Rina', nik: 'EMP-RINA', role: 'VIEWER', position: 'Management', area: 'HO', department: 'Management' },
    { id: 6, name: 'IT Admin', nik: 'IT-ADMIN', role: 'ADMIN', position: 'IT Administrator', area: 'HO', department: 'IT' }
  ], documents: [], notifications: []
};
function load() {
  if (!fs.existsSync(DB_FILE)) { fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2)); return structuredClone(initial); }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function save(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
function now() { return new Date().toISOString(); }
function nextNo(db) {
  const year = new Date().getFullYear();
  const nums = db.documents.filter(d => d.submissionNo.startsWith(`TR-${year}-`)).map(d => Number(d.submissionNo.split('-').pop()));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `TR-${year}-${String(next).padStart(3, '0')}`;
}
function publicDoc(doc) { return doc; }
function getDoc(db, id) { return db.documents.find(d => d.id === Number(id)); }
function notify(db, recipientId, documentId, type, message) {
  db.notifications.unshift({ id: crypto.randomUUID(), recipientId, documentId, type, message, createdAt: now(), read: false });
}

app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOADS));
app.use(express.static(path.join(ROOT, 'public')));

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOADS),
  filename: (_, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    cb(null, allowed.includes(file.mimetype));
  }
});

app.get('/api/users', (_, res) => res.json(load().users));

app.get('/api/dashboard/:userId', (req, res) => {
  const db = load();
  const userId = Number(req.params.userId);
  const user = db.users.find(u => u.id === userId);
  const total = db.documents.length;
  const approved = db.documents.filter(d => d.status === 'APPROVED').length;
  const pending = db.documents.filter(d => d.status === 'IN_APPROVAL').length;
  const rejected = db.documents.filter(d => d.status === 'REJECTED').length;
  const myRequests = db.documents.filter(d => d.applicantId === userId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const myApprovals = db.documents.flatMap(d => d.steps.filter(s => s.approverId === userId).map(s => ({...s, documentId:d.id, submissionNo:d.submissionNo, title:d.title, applicantName:db.users.find(u=>u.id===d.applicantId)?.name, documentStatus:d.status}))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  res.json({ user, metrics:{total,approved,pending,rejected}, myRequests, myApprovals });
});

app.get('/api/documents', (req,res)=>{
  const db=load(); const userId=Number(req.query.userId); const role=req.query.role;
  let docs=db.documents;
  if(role==='APPLICANT') docs=docs.filter(d=>d.applicantId===userId);
  if(role==='APPROVER') docs=docs.filter(d=>d.steps.some(s=>s.approverId===userId));
  res.json(docs.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));
});

app.get('/api/documents/:id',(req,res)=>{
  const db=load(); const d=getDoc(db,req.params.id);
  if(!d) return res.status(404).json({message:'Dokumen tidak ditemukan'});
  res.json(d);
});

app.post('/api/documents', upload.single('file'), (req,res)=>{
  try {
    const db=load();
    const applicantId=Number(req.body.applicantId);
    const approverIds=JSON.parse(req.body.approverIds||'[]').map(Number);
    if(!req.file || !applicantId || !req.body.title || !req.body.department || !req.body.area || !approverIds.length) return res.status(400).json({message:'Field wajib belum lengkap.'});
    const id=crypto.randomUUID(); const createdAt=now();
    const doc={
      id, submissionNo:nextNo(db), applicantId, department:req.body.department, area:req.body.area,
      documentType:req.body.documentType||'Transmittal', title:req.body.title, description:req.body.description||'',
      fileName:req.file.originalname, filePath:`/uploads/${path.basename(req.file.path)}`, status:'IN_APPROVAL',
      createdAt, updatedAt:createdAt, submittedAt:createdAt, approvedAt:null, qrToken:null, qrDataUrl:null,
      steps:approverIds.map((approverId,i)=>({ id:crypto.randomUUID(), approverId, order:i+1, status:'WAITING', comment:'', signatureData:null, approvedAt:null, createdAt }))
    };
    db.documents.push(doc);
    notify(db, applicantId, id, 'SUBMITTED', `Pengajuan ${doc.submissionNo} berhasil dibuat dan menunggu proses approval.`);
    notify(db, approverIds[0], id, 'APPROVAL_REQUIRED', `Dokumen ${doc.submissionNo} menunggu persetujuan Anda.`);
    save(db); res.status(201).json(publicDoc(doc));
  } catch(e) { res.status(500).json({message:e.message}); }
});

app.post('/api/approvals/:approvalId/action', async (req,res)=>{
  try {
    const db=load();
    let target=null, doc=null;
    for(const d of db.documents){ const s=d.steps.find(x=>x.id===req.params.approvalId); if(s){target=s;doc=d;break;} }
    if(!target) return res.status(404).json({message:'Approval step tidak ditemukan.'});
    if(Number(target.approverId)!==Number(req.body.approverId)) return res.status(403).json({message:'Anda bukan approver pada tahap ini.'});
    if(target.status!=='WAITING') return res.status(409).json({message:'Approval sudah diproses.'});
    const previous=doc.steps.filter(s=>s.order<target.order).some(s=>s.status!=='APPROVED');
    if(previous) return res.status(409).json({message:'Tahap approval sebelumnya belum selesai.'});
    const action=req.body.action;
    if(action==='REJECT' && !String(req.body.comment||'').trim()) return res.status(400).json({message:'Catatan wajib diisi saat Reject.'});
    if(action==='APPROVE' && !req.body.signatureData) return res.status(400).json({message:'Tanda tangan wajib diisi saat Approve.'});
    target.status=action==='APPROVE'?'APPROVED':'REJECTED'; target.comment=req.body.comment||''; target.signatureData=action==='APPROVE'?req.body.signatureData:null; target.approvedAt=now();
    doc.updatedAt=now();
    const approver=db.users.find(u=>u.id===target.approverId);
    if(action==='REJECT'){
      doc.status='REJECTED'; notify(db,doc.applicantId,doc.id,'REJECTED',`Pengajuan ${doc.submissionNo} ditolak oleh ${approver?.name}.`);
    } else {
      const next=doc.steps.find(s=>s.order===target.order+1);
      if(next){
        notify(db,next.approverId,doc.id,'APPROVAL_REQUIRED',`Dokumen ${doc.submissionNo} telah disetujui pada tahap sebelumnya dan menunggu persetujuan Anda.`);
        notify(db,doc.applicantId,doc.id,'APPROVED_STEP',`Pengajuan ${doc.submissionNo} disetujui oleh ${approver?.name}.`);
      } else {
        doc.status='APPROVED'; doc.approvedAt=now(); doc.qrToken=crypto.randomBytes(18).toString('hex');
        const verifyUrl=`${req.protocol}://${req.get('host')}/verify/${doc.qrToken}`;
        doc.verifyUrl=verifyUrl; doc.qrDataUrl=await QRCode.toDataURL(verifyUrl,{width:420,margin:2});
        notify(db,doc.applicantId,doc.id,'COMPLETED',`Seluruh approval ${doc.submissionNo} telah selesai. QR Code berhasil dibuat.`);
      }
    }
    save(db); res.json(doc);
  } catch(e){res.status(500).json({message:e.message});}
});

app.get('/api/notifications/:userId',(req,res)=>{
  const db=load(); res.json(db.notifications.filter(n=>n.recipientId===Number(req.params.userId)).slice(0,50));
});

app.get('/api/verify/:token',(req,res)=>{
  const db=load(); const doc=db.documents.find(d=>d.qrToken===req.params.token);
  if(!doc) return res.status(404).json({valid:false,message:'QR tidak valid atau dokumen tidak ditemukan.'});
  const approvals=doc.steps.map(s=>{const u=db.users.find(x=>x.id===s.approverId);return {order:s.order,status:s.status,approverName:u?.name,position:u?.position,area:u?.area,approvedAt:s.approvedAt,comment:s.comment};});
  res.json({valid:doc.status==='APPROVED',submissionNo:doc.submissionNo,title:doc.title,status:doc.status,approvedAt:doc.approvedAt,applicantName:db.users.find(u=>u.id===doc.applicantId)?.name,approvals});
});

app.get('/verify/:token', (_,res)=>res.sendFile(path.join(ROOT,'public','verify.html')));
app.get('*', (_,res)=>res.sendFile(path.join(ROOT,'public','index.html')));

app.listen(PORT,()=>console.log(`\nHRBP Transmittal running at http://localhost:${PORT}\n`));

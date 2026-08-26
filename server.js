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
const FRONTEND_DIST = path.join(ROOT, 'approval-transmittal-frontend', 'dist');
const AUTH_SECRET = process.env.AUTH_SECRET || 'replace-this-auth-secret';
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
function publicDoc(db, doc) {
  return {
    ...doc,
    applicantName: db.users.find(user => user.id === doc.applicantId)?.name,
    steps: doc.steps.map(step => {
      const user = db.users.find(candidate => candidate.id === step.approverId);
      return { ...step, approverName: user?.name, position: user?.position, area: user?.area, signedAt: step.approvedAt, signature: step.signatureData };
    })
  };
}
function getDoc(db, id) { return db.documents.find(d => String(d.id) === String(id)); }
function currentStep(doc) {
  return doc.steps.find(step => step.status === 'WAITING');
}
function signAuth(userId) {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
function authUserId(req) {
  const token = String(req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('approval_auth='))?.split('=')[1];
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString()); return data.exp > Date.now() ? Number(data.userId) : null; } catch { return null; }
}
function notify(db, recipientId, documentId, type, message) {
  db.notifications.unshift({ id: crypto.randomUUID(), recipientId, documentId, type, message, createdAt: now(), read: false });
}

app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOADS));
app.use(express.static(FRONTEND_DIST));
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
  res.json(docs.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(doc => publicDoc(db, doc)));
});

app.get('/api/documents/:id',(req,res)=>{
  const db=load(); const d=getDoc(db,req.params.id);
  if(!d) return res.status(404).json({message:'Dokumen tidak ditemukan'});
  res.json(publicDoc(db, d));
});

app.get('/auth/microsoft/start', (req, res) => {
  const approvalId = String(req.query.approvalId || '');
  const db = load();
  if (!db.documents.some(doc => doc.steps.some(step => step.id === approvalId))) return res.status(404).send('Approval step tidak ditemukan.');
  const { MS_CLIENT_ID, MS_TENANT_ID, MS_REDIRECT_URI } = process.env;
  if (!MS_CLIENT_ID || !MS_TENANT_ID || !MS_REDIRECT_URI) return res.status(503).send('Microsoft Login belum dikonfigurasi.');
  const state = Buffer.from(JSON.stringify({ approvalId, exp: Date.now() + 10 * 60 * 1000 })).toString('base64url');
  const params = new URLSearchParams({ client_id: MS_CLIENT_ID, response_type: 'code', redirect_uri: MS_REDIRECT_URI, response_mode: 'query', scope: 'openid profile email User.Read', state });
  res.redirect(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/authorize?${params}`);
});

app.get('/auth/microsoft/callback', async (req, res) => {
  try {
    const state = JSON.parse(Buffer.from(String(req.query.state || ''), 'base64url').toString());
    if (!state.approvalId || state.exp <= Date.now()) return res.status(400).send('Sesi Microsoft Login kedaluwarsa.');
    const { MS_CLIENT_ID, MS_CLIENT_SECRET, MS_TENANT_ID, MS_REDIRECT_URI, MICROSOFT_USER_MAP } = process.env;
    if (!MS_CLIENT_ID || !MS_CLIENT_SECRET || !MS_TENANT_ID || !MS_REDIRECT_URI) return res.status(503).send('Microsoft Login belum dikonfigurasi.');
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: MS_CLIENT_ID, client_secret: MS_CLIENT_SECRET, code: String(req.query.code || ''), redirect_uri: MS_REDIRECT_URI, grant_type: 'authorization_code', scope: 'openid profile email User.Read' }) });
    if (!tokenResponse.ok) return res.status(403).send('Microsoft Login gagal.');
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', { headers: { authorization: `Bearer ${(await tokenResponse.json()).access_token}` } });
    const profile = await profileResponse.json();
    const userMap = JSON.parse(MICROSOFT_USER_MAP || '{}');
    const userId = Number(userMap[profile.mail || profile.userPrincipalName]);
    if (!userId) return res.status(403).send('Access Denied: akun Microsoft tidak terdaftar.');
    const db = load(); const doc = db.documents.find(item => item.steps.some(step => step.id === state.approvalId));
    const step = doc?.steps.find(item => item.id === state.approvalId);
    if (!step || step.approverId !== userId) return res.status(403).send('Access Denied: Anda bukan pihak yang ditugaskan.');
    res.setHeader('Set-Cookie', `approval_auth=${signAuth(userId)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600`);
    res.redirect(`/verify/${doc.qrToken}?approval=${encodeURIComponent(step.id)}`);
  } catch { res.status(400).send('Microsoft Login tidak valid.'); }
});

app.get('/api/approval-auth/:approvalId', (req, res) => {
  const db = load();
  const doc = db.documents.find(item => item.steps.some(step => step.id === req.params.approvalId));
  const step = doc?.steps.find(item => item.id === req.params.approvalId);
  const userId = authUserId(req);
  if (!step || !userId) return res.json({ allowed: false });
  if (step.approverId !== userId) return res.json({ allowed: false, reason: 'Access Denied.' });
  if (step.status !== 'WAITING' || currentStep(doc)?.id !== step.id) return res.json({ allowed: false, reason: 'Approval belum dapat dilakukan. Dokumen masih menunggu approval dari pihak sebelumnya.' });
  res.json({ allowed: true, approvalId: step.id });
});

app.post('/api/documents', upload.single('file'), (req,res)=>{
  try {
    const db=load();
    const applicantId=Number(req.body.applicantId);
    const submittedSteps = JSON.parse(req.body.approvalSteps || '[]');
    const approverIds = JSON.parse(req.body.approverIds || '[]').map(Number);
    const steps = submittedSteps.length ? submittedSteps.map((step, index) => ({
      approverId: Number(step.approverId),
      stage: String(step.stage || step.role || 'APPROVER').toUpperCase(),
      order: index + 1
    })) : approverIds.map((approverId, index) => ({ approverId, stage: 'APPROVER', order: index + 1 }));
    if(!req.file || !applicantId || !req.body.title || !req.body.department || !req.body.area || !steps.length || steps.some(step => !step.approverId)) return res.status(400).json({message:'Field wajib belum lengkap.'});
    const id=crypto.randomUUID(); const createdAt=now(); const qrToken=crypto.randomBytes(18).toString('hex');
    const verifyUrl=`${req.protocol}://${req.get('host')}/verify/${qrToken}`;
    const doc={
      id, submissionNo:nextNo(db), applicantId, department:req.body.department, area:req.body.area,
      documentType:req.body.documentType||'Transmittal', title:req.body.title, description:req.body.description||'',
      fileName:req.file.originalname, filePath:`/uploads/${path.basename(req.file.path)}`, status:'IN_APPROVAL',
      createdAt, updatedAt:createdAt, submittedAt:createdAt, approvedAt:null, qrToken, verifyUrl, qrDataUrl:null,
      steps:steps.map(step=>({ id:crypto.randomUUID(), approverId:step.approverId, stage:step.stage, order:step.order, status:'WAITING', comment:'', signatureData:null, approvedAt:null, createdAt }))
    };
    QRCode.toDataURL(verifyUrl,{width:420,margin:2}).then(qrDataUrl=>{
      doc.qrDataUrl=qrDataUrl;
      db.documents.push(doc);
      notify(db, applicantId, id, 'SUBMITTED', `Pengajuan ${doc.submissionNo} berhasil dibuat dan menunggu proses approval.`);
      notify(db, steps[0].approverId, id, 'APPROVAL_REQUIRED', `Dokumen ${doc.submissionNo} menunggu persetujuan Anda.`);
      save(db); res.status(201).json(publicDoc(db, doc));
    }).catch(e=>res.status(500).json({message:e.message}));
  } catch(e) { res.status(500).json({message:e.message}); }
});

app.post('/api/approvals/:approvalId/action', async (req,res)=>{
  try {
    const db=load();
    const authenticatedUserId = authUserId(req);
    if (!authenticatedUserId) return res.status(401).json({message:'Microsoft Login diperlukan untuk melakukan approval.'});
    let target=null, doc=null;
    for(const d of db.documents){ const s=d.steps.find(x=>x.id===req.params.approvalId); if(s){target=s;doc=d;break;} }
    if(!target) return res.status(404).json({message:'Approval step tidak ditemukan.'});
    if(Number(target.approverId)!==authenticatedUserId) return res.status(403).json({message:'Access Denied: Anda bukan pihak yang ditugaskan.'});
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
        doc.status='APPROVED'; doc.approvedAt=now();
        notify(db,doc.applicantId,doc.id,'COMPLETED',`Seluruh approval ${doc.submissionNo} telah selesai. QR Code berhasil dibuat.`);
      }
    }
    save(db); res.json(publicDoc(db, doc));
  } catch(e){res.status(500).json({message:e.message});}
});

app.get('/api/notifications/:userId',(req,res)=>{
  const db=load(); res.json(db.notifications.filter(n=>n.recipientId===Number(req.params.userId)).slice(0,50));
});

app.get('/api/verify/:token',(req,res)=>{
  const db=load(); const doc=db.documents.find(d=>d.qrToken===req.params.token);
  if(!doc) return res.status(404).json({valid:false,message:'QR tidak valid atau dokumen tidak ditemukan.'});
  const active=currentStep(doc);
  const approvals=doc.steps.map(s=>{const u=db.users.find(x=>x.id===s.approverId);return {id:s.id,order:s.order,stage:s.stage,status:s.status==='WAITING'&&active?.id===s.id?'ACTIVE':s.status,approverName:u?.name,position:u?.position,area:u?.area,approvedAt:s.approvedAt,comment:s.comment};});
  res.json({valid:doc.status==='APPROVED',submissionNo:doc.submissionNo,title:doc.title,status:doc.status,approvedAt:doc.approvedAt,applicantName:db.users.find(u=>u.id===doc.applicantId)?.name,department:doc.department,area:doc.area,submittedAt:doc.submittedAt,fileName:doc.fileName,filePath:doc.filePath,progress:{completed:doc.steps.filter(s=>s.status==='APPROVED').length,total:doc.steps.length},approvals});
});

app.get('/verify/:token', (_,res)=>{
  const frontendIndex = path.join(FRONTEND_DIST, 'index.html');
  res.sendFile(fs.existsSync(frontendIndex) ? frontendIndex : path.join(ROOT,'public','verify.html'));
});
app.get('*', (_,res)=>{
  const frontendIndex = path.join(FRONTEND_DIST, 'index.html');
  res.sendFile(fs.existsSync(frontendIndex) ? frontendIndex : path.join(ROOT,'public','index.html'));
});

app.listen(PORT,()=>console.log(`\nHRBP Transmittal running at http://localhost:${PORT}\n`));

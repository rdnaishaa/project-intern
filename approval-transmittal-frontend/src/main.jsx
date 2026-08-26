import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bell, Check, CheckCircle2, ChevronRight, ClipboardList, Clock3,
  FileCheck2, FileText, LayoutDashboard, LogOut, Menu, QrCode,
  Search, ShieldCheck, Upload, Users, X, XCircle
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import "./index.css";

const seedUsers = [
  { id: 1, name: "Faisal Kurnia Nugraha", nik: "10160031", role: "APPLICANT", position: "HRBP Staff", area: "HO", department: "HRBP" },
  { id: 2, name: "Budi", nik: "EMP-BUDI", role: "APPROVER", position: "HRBP Manager", area: "Bontang", department: "HRBP" },
  { id: 3, name: "Andi", nik: "EMP-ANDI", role: "APPROVER", position: "HR Manager", area: "Gresik", department: "HR" },
  { id: 4, name: "Sari", nik: "EMP-SARI", role: "APPROVER", position: "Head of HR", area: "HO", department: "HR" },
  { id: 5, name: "Rina", nik: "EMP-RINA", role: "VIEWER", position: "Management", area: "HO", department: "Management" }
];

const initialDocs = [
  {
    id: 1, submissionNo: "TR-2026-001", applicantId: 1, applicantName: "Faisal Kurnia Nugraha",
    department: "HRBP", area: "HO", type: "Transmittal", title: "Surat Permohonan ABC",
    description: "Contoh dokumen untuk demo approval.",
    fileName: "Surat-Permohonan-ABC.pdf", status: "IN_APPROVAL",
    createdAt: "2026-08-24T08:15:00",
    approvedAt: null, qr: null,
    steps: [
      { id: 11, order: 1, approverId: 2, approverName: "Budi", position: "HRBP Manager", area: "Bontang", status: "APPROVED", comment: "Disetujui.", signedAt: "2026-08-24T08:30:00", signature: null },
      { id: 12, order: 2, approverId: 3, approverName: "Andi", position: "HR Manager", area: "Gresik", status: "WAITING", comment: "", signedAt: null, signature: null },
      { id: 13, order: 3, approverId: 4, approverName: "Sari", position: "Head of HR", area: "HO", status: "WAITING", comment: "", signedAt: null, signature: null }
    ]
  }
];

function uid() { return Math.random().toString(36).slice(2, 10); }
function fmt(date) { return date ? new Date(date).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-"; }

function Badge({ status }) {
  const map = {
    APPROVED: ["bg-emerald-50 text-emerald-700", "Approved"],
    IN_APPROVAL: ["bg-amber-50 text-amber-700", "Waiting Approval"],
    WAITING: ["bg-amber-50 text-amber-700", "Waiting"],
    REJECTED: ["bg-red-50 text-red-700", "Rejected"],
    APPROVER: ["bg-blue-50 text-blue-700", "Approver"],
    APPLICANT: ["bg-violet-50 text-violet-700", "Applicant"],
    VIEWER: ["bg-slate-100 text-slate-700", "Viewer"]
  };
  const [cls, label] = map[status] || ["bg-slate-100 text-slate-600", status];
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{label}</span>;
}

function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  useEffect(() => {
    const c = canvasRef.current, ctx = c.getContext("2d");
    ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.strokeStyle = "#172033";
    const point = e => { const r=c.getBoundingClientRect(); return {x:e.clientX-r.left,y:e.clientY-r.top}; };
    const down = e => { drawing.current=true; const p=point(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); };
    const move = e => { if(!drawing.current)return; const p=point(e); ctx.lineTo(p.x,p.y); ctx.stroke(); onChange(c.toDataURL("image/png")); };
    const up=()=>drawing.current=false;
    c.addEventListener("pointerdown",down); c.addEventListener("pointermove",move); window.addEventListener("pointerup",up);
    return()=>{c.removeEventListener("pointerdown",down);c.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);}
  },[onChange]);
  return <canvas ref={canvasRef} width="700" height="180" className="h-36 w-full touch-none rounded-xl border-2 border-dashed border-slate-300 bg-slate-50"/>;
}

function App() {
  const [users] = useState(seedUsers);
  const [docs, setDocs] = useState(initialDocs);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("demoUser");
    return saved ? JSON.parse(saved) : null;
  });
  const [page, setPage] = useState("dashboard");
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [verifyId, setVerifyId] = useState(null);
  const [publicDocId, setPublicDocId] = useState(null);
  const [approvalDocId, setApprovalDocId] = useState(null);

  useEffect(()=> {
    if(user) localStorage.setItem("demoUser", JSON.stringify(user));
    else localStorage.removeItem("demoUser");
  },[user]);

  if (verifyId) {
    const doc = docs.find(d=>d.id===verifyId);
    return <Verification doc={doc} onBack={()=>setVerifyId(null)}/>;
  }
  if (!user && approvalDocId) return <Login users={users} onLogin={selectedUser => { setUser(selectedUser); if (approvalDocId === -1) setCreating(true); else { setSelectedId(approvalDocId); setPage("detail"); } setApprovalDocId(null); }}/>;
  if (!user) return publicDocId ? <PublicDocument doc={docs.find(d => d.id === publicDocId)} onBack={() => setPublicDocId(null)} onApprove={() => setApprovalDocId(publicDocId)}/> : <PublicHome docs={docs} onOpen={setPublicDocId} onCreate={() => setApprovalDocId(-1)}/>;

  const open = id => { setSelectedId(id); setPage("detail"); setCreating(false); };
  const go = p => { setPage(p); setSelectedId(null); setCreating(false); };

  function submitRequest(data) {
    const no = `TR-2026-${String(docs.length+1).padStart(3,"0")}`;
    const newDoc = {
      ...data, id: Date.now(), submissionNo:no, applicantId:user.id, applicantName:user.name,
      createdAt:new Date().toISOString(), status:"IN_APPROVAL", approvedAt:null, qr:null,
      steps:data.approverIds.map((id,i)=>{
        const u=users.find(x=>x.id===id);
        return {id:uid(),order:i+1,approverId:id,approverName:u.name,position:u.position,area:u.area,status:"WAITING",comment:"",signedAt:null,signature:null};
      })
    };
    setDocs(d=>[newDoc,...d]); open(newDoc.id);
  }

  function approvalAction(docId, stepId, action, signature, comment) {
    setDocs(prev=>prev.map(doc=>{
      if(doc.id!==docId)return doc;
      const steps=doc.steps.map(s=>{
        if(s.id!==stepId)return s;
        return {...s,status:action==="APPROVE"?"APPROVED":"REJECTED",comment:comment||"",signedAt:action==="APPROVE"?new Date().toISOString():null,signature:action==="APPROVE"?signature:null};
      });
      if(action==="REJECT") return {...doc,steps,status:"REJECTED"};
      const all=steps.every(s=>s.status==="APPROVED");
      return {...doc,steps,status:all?"APPROVED":"IN_APPROVAL",approvedAt:all?new Date().toISOString():null,qr:all?`http://localhost:5173/verify/${doc.id}`:null};
    }));
  }

  const currentDoc = docs.find(d=>d.id===selectedId);
  let content;
  if(creating) content=<CreateRequest users={users} user={user} onSubmit={submitRequest} onCancel={()=>go("requests")}/>;
  else if(page==="dashboard") content=<Dashboard user={user} docs={docs} open={open} go={go}/>;
  else if(page==="requests") content=<Requests user={user} docs={docs} open={open} create={()=>setCreating(true)}/>;
  else if(page==="approvals") content=<Approvals user={user} docs={docs} open={open}/>;
  else if(page==="notifications") content=<Notifications user={user} docs={docs}/>;
  else if(page==="monitoring") content=<Monitoring docs={docs} open={open}/>;
  else if(page==="detail") content=<Detail user={user} doc={currentDoc} onBack={()=>go(user.role==="APPROVER"?"approvals":"requests")} onApprove={approvalAction} verify={()=>setVerifyId(currentDoc?.id)}/>;

  return <Layout user={user} setUser={setUser} page={page} go={go}>{content}</Layout>;
}

function PublicHome({ docs, onOpen, onCreate }) {
  return <div className="min-h-screen bg-slate-50 p-5 md:p-10"><div className="mx-auto max-w-4xl"><div className="mb-8 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#1261A0] text-white"><ShieldCheck/></div><h1 className="mt-4 text-2xl font-extrabold">HRBP Transmittal Approval</h1><p className="mt-1 text-sm text-slate-500">Public Dashboard</p><button onClick={onCreate} className="btn-primary mt-5">+ Buat Pengajuan</button></div><div className="card p-5"><h2 className="font-bold">Daftar Pengajuan</h2><div className="mt-4 space-y-3">{docs.map(doc=><button key={doc.id} onClick={()=>onOpen(doc.id)} className="flex w-full items-center justify-between rounded-xl border p-4 text-left hover:bg-slate-50"><div><b>{doc.title}</b><div className="text-xs text-slate-500">{doc.submissionNo} · {doc.applicantName}</div></div><Badge status={doc.status}/></button>)}</div></div></div></div>;
}

function PublicDocument({ doc, onBack, onApprove }) {
  if (!doc) return <div className="grid min-h-screen place-items-center bg-slate-50">Dokumen tidak ditemukan.</div>;
  const active = doc.steps.find(step => step.status === "WAITING");
  const completed = doc.steps.filter(step => step.status === "APPROVED").length;
  return <div className="min-h-screen bg-slate-50 p-5 md:p-10"><div className="mx-auto max-w-3xl"><button onClick={onBack} className="mb-5 text-sm font-semibold text-[#1261A0]">← Kembali ke Dashboard</button><div className="card p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-bold uppercase text-slate-400">{doc.submissionNo}</div><h1 className="mt-1 text-2xl font-extrabold">{doc.title}</h1></div><Badge status={doc.status}/></div><div className="mt-6 grid gap-4 text-sm sm:grid-cols-2"><div><div className="text-xs text-slate-400">Pemohon</div><b>{doc.applicantName}</b></div><div><div className="text-xs text-slate-400">Departemen</div><b>{doc.department}</b></div><div><div className="text-xs text-slate-400">Tanggal Pengajuan</div><b>{fmt(doc.createdAt)}</b></div><div><div className="text-xs text-slate-400">Dokumen</div><b>{doc.fileName}</b></div></div><div className="mt-6 rounded-xl bg-slate-50 p-4"><div className="flex justify-between text-sm font-bold"><span>Approval Progress</span><span>{completed}/{doc.steps.length}</span></div><div className="mt-4 space-y-3">{doc.steps.map(step=><div key={step.id} className="flex items-center gap-3 rounded-xl border bg-white p-3"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-sm">{step.status==="APPROVED"?<Check size={16}/>:step.order}</div><div className="flex-1"><b>{step.approverName}</b><div className="text-xs text-slate-500">{step.role || "Approver"} · {step.position} · {step.area}</div></div><span className="text-xs text-slate-400">{step.status}{step.signedAt?` · ${fmt(step.signedAt)}`:""}</span></div>)}</div></div>{active&&<button onClick={onApprove} className="btn-primary mt-5">Approve Now <ChevronRight size={17}/></button>}</div></div></div>;
}

function Login({users,onLogin}) {
  const [id,setId]=useState("");
  return <div className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-5">
    <div className="w-full max-w-md">
      <div className="mb-6 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#1261A0] text-white"><ShieldCheck size={32}/></div><h1 className="mt-4 text-2xl font-extrabold">HRBP Transmittal Approval</h1><p className="mt-1 text-sm text-slate-500">Frontend prototype — tanpa backend</p></div>
      <div className="card p-6">
        <label className="label">Login sebagai</label>
        <select className="input" value={id} onChange={e=>setId(e.target.value)}><option value="">Pilih user...</option>{users.map(u=><option key={u.id} value={u.id}>{u.name} — {u.position}</option>)}</select>
        <button disabled={!id} onClick={()=>onLogin(users.find(u=>u.id===Number(id)))} className="btn-primary mt-4 w-full">Masuk <ChevronRight size={17}/></button>
        <p className="mt-4 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-800">Demo utama: Faisal buat pengajuan → Budi → Andi → Sari approve.</p>
      </div>
    </div>
  </div>;
}

function Layout({user,setUser,page,go,children}) {
  const [open,setOpen]=useState(false);
  const nav=[["dashboard","Dashboard",LayoutDashboard],["requests","Pengajuan",ClipboardList],["approvals","Approval Saya",FileCheck2],["notifications","Notifikasi",Bell]];
  if(["VIEWER"].includes(user.role)) nav.push(["monitoring","Monitoring",Users]);
  return <div className="min-h-screen bg-slate-50">
    <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r bg-white p-4 transition-transform md:translate-x-0 ${open?"translate-x-0":"-translate-x-full"}`}>
      <div className="flex items-center gap-3 px-2 py-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#1261A0] text-white"><ShieldCheck/></div><div><b>HRBP Transmittal</b><div className="text-xs text-slate-500">Approval System</div></div></div>
      <nav className="mt-6 space-y-1">{nav.map(([k,l,I])=><button key={k} onClick={()=>{go(k);setOpen(false)}} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${page===k?"bg-blue-50 text-[#1261A0]":"text-slate-600 hover:bg-slate-50"}`}><I size={18}/>{l}</button>)}</nav>
      <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Signed in as</div><div className="mt-1 truncate text-sm font-bold">{user.name}</div><div className="mt-1"><Badge status={user.role}/></div></div>
    </aside>
    {open&&<div className="fixed inset-0 z-30 bg-black/20 md:hidden" onClick={()=>setOpen(false)}/>}
    <main className="md:ml-64"><header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/90 px-4 backdrop-blur md:px-7"><button className="md:hidden" onClick={()=>setOpen(true)}><Menu/></button><span className="hidden text-sm text-slate-500 md:block">HRBP / Transmittal / Approval</span><button className="btn-secondary" onClick={()=>setUser(null)}><LogOut size={16}/>Logout</button></header><div className="p-4 md:p-7">{children}</div></main>
  </div>;
}

function Dashboard({user,docs,open,go}) {
  const mine=docs.filter(d=>d.applicantId===user.id), approvals=docs.filter(d=>d.steps.some(s=>s.approverId===user.id));
  const cards=[["Total Pengajuan",docs.length,ClipboardList],["Menunggu Approval",docs.filter(d=>d.status==="IN_APPROVAL").length,Clock3],["Approved",docs.filter(d=>d.status==="APPROVED").length,CheckCircle2],["Rejected",docs.filter(d=>d.status==="REJECTED").length,XCircle]];
  return <><div className="mb-7"><h1 className="text-2xl font-extrabold">Dashboard</h1><p className="mt-1 text-sm text-slate-500">Ringkasan proses transmittal dokumen.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([l,v,I])=><div className="card p-5" key={l}><div className="flex justify-between text-sm text-slate-500">{l}<I size={19} className="text-[#1261A0]"/></div><div className="mt-4 text-3xl font-extrabold">{v}</div></div>)}</div>
    <div className="mt-6 grid gap-5 lg:grid-cols-2"><ListMini title="Pengajuan Saya" rows={mine} open={open}/><ListMini title="Approval Saya" rows={approvals} open={open}/></div></>;
}
function ListMini({title,rows,open}){return <div className="card p-5"><h2 className="font-bold">{title}</h2><div className="mt-4 space-y-2">{rows.slice(0,5).map(r=><button key={r.id} onClick={()=>open(r.id)} className="flex w-full items-center justify-between rounded-xl border p-3 text-left hover:bg-slate-50"><div><b>{r.title}</b><div className="text-xs text-slate-500">{r.submissionNo}</div></div><Badge status={r.status}/></button>)}{!rows.length&&<p className="text-sm text-slate-500">Belum ada data.</p>}</div></div>}

function Requests({user,docs,open,create}) {
  const rows=docs.filter(d=>user.role==="APPLICANT"?d.applicantId===user.id:true);
  const [q,setQ]=useState("");
  const filtered=rows.filter(r=>`${r.title} ${r.submissionNo}`.toLowerCase().includes(q.toLowerCase()));
  return <><div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-extrabold">Pengajuan</h1><p className="mt-1 text-sm text-slate-500">Daftar transmittal.</p></div>{user.role==="APPLICANT"&&<button onClick={create} className="btn-primary"><FileText size={17}/>Buat Pengajuan</button>}</div><div className="card p-4"><div className="relative mb-4"><Search className="absolute left-3 top-2.5 text-slate-400" size={18}/><input className="input pl-10" placeholder="Cari..." value={q} onChange={e=>setQ(e.target.value)}/></div><Table rows={filtered} open={open}/></div></>;
}
function Table({rows,open}){return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-xs uppercase text-slate-400"><tr><th className="px-3 py-3">No.</th><th className="px-3 py-3">Judul</th><th className="px-3 py-3">Pemohon</th><th className="px-3 py-3">Status</th><th/></tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-b border-slate-50"><td className="px-3 py-3 font-semibold">{r.submissionNo}</td><td className="px-3 py-3">{r.title}</td><td className="px-3 py-3">{r.applicantName}</td><td className="px-3 py-3"><Badge status={r.status}/></td><td className="px-3 py-3 text-right"><button className="btn-secondary px-3 py-1.5" onClick={()=>open(r.id)}>Detail</button></td></tr>)}</tbody></table></div>}

function Approvals({user,docs,open}) {
  const rows=docs.filter(d=>d.steps.some(s=>s.approverId===user.id));
  return <><div className="mb-6"><h1 className="text-2xl font-extrabold">Approval Saya</h1><p className="mt-1 text-sm text-slate-500">Approval yang menjadi tanggung jawabmu.</p></div><div className="card p-4"><Table rows={rows} open={open}/></div></>;
}

function Notifications({user,docs}) {
  const items=docs.flatMap(d=>d.steps.filter(s=>s.approverId===user.id&&s.status==="WAITING").map(s=>({d,s})));
  return <><div className="mb-6"><h1 className="text-2xl font-extrabold">Notifikasi</h1><p className="mt-1 text-sm text-slate-500">Simulasi notifikasi approval. Integrasi WA dilakukan pada fase backend.</p></div><div className="space-y-3">{items.map(({d,s})=><div className="card p-4" key={s.id}><div className="flex gap-3"><Bell className="text-[#1261A0]"/><div><b>Approval diperlukan</b><p className="text-sm text-slate-600">Dokumen {d.submissionNo} — {d.title} menunggu persetujuan kamu.</p></div></div></div>)}{!items.length&&<div className="card p-8 text-center text-sm text-slate-500">Tidak ada approval yang menunggu.</div>}</div></>;
}

function Monitoring({docs,open}){return <><div className="mb-6"><h1 className="text-2xl font-extrabold">Monitoring</h1><p className="mt-1 text-sm text-slate-500">Overview seluruh transmittal.</p></div><div className="card p-4"><Table rows={docs} open={open}/></div></>}

function CreateRequest({users,user,onSubmit,onCancel}) {
  const approvers=users.filter(u=>u.role==="APPROVER"), [form,setForm]=useState({department:user.department,area:user.area,type:"Transmittal",title:"",description:"",fileName:""}),[selected,setSelected]=useState([]);
  const toggle=id=>setSelected(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
  return <form className="space-y-5" onSubmit={e=>{e.preventDefault();if(!form.title||!form.fileName||!selected.length)return alert("Judul, dokumen, dan approver wajib diisi.");onSubmit({...form,approverIds:selected});}}>
    <div><button type="button" onClick={onCancel} className="mb-3 text-sm font-semibold text-[#1261A0]">← Kembali</button><h1 className="text-2xl font-extrabold">Buat Pengajuan</h1><p className="mt-1 text-sm text-slate-500">Prototype alur transmittal.</p></div>
    <div className="card p-5"><h2 className="font-bold">Informasi Pengajuan</h2><div className="mt-5 grid gap-4 md:grid-cols-2">
      <Field label="Nama Pemohon"><input className="input bg-slate-50" value={user.name} disabled/></Field><Field label="NIK"><input className="input bg-slate-50" value={user.nik} disabled/></Field>
      <Field label="Departemen"><input className="input" value={form.department} onChange={e=>setForm({...form,department:e.target.value})}/></Field><Field label="Area/Wilayah"><input className="input" value={form.area} onChange={e=>setForm({...form,area:e.target.value})}/></Field>
      <Field label="Jenis Dokumen"><select className="input" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option>Transmittal</option><option>Surat</option><option>Memo</option></select></Field>
      <Field label="Judul Dokumen"><input className="input" required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></Field>
      <div className="md:col-span-2"><Field label="Keperluan / Deskripsi"><textarea className="input min-h-24" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></Field></div>
    </div></div>
    <div className="card p-5"><h2 className="font-bold">Dokumen</h2><label className="mt-4 flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed border-slate-300 p-5"><Upload className="text-[#1261A0]"/><div><b>{form.fileName||"Pilih file dokumen"}</b><div className="text-xs text-slate-500">Prototype menyimpan nama file saja.</div></div><input className="hidden" type="file" accept=".pdf,.doc,.docx" onChange={e=>setForm({...form,fileName:e.target.files?.[0]?.name||""})}/></label></div>
    <div className="card p-5"><h2 className="font-bold">Approval Chain</h2><p className="mt-1 text-xs text-slate-500">Klik sesuai urutan. Nomor menunjukkan urutan approval.</p><div className="mt-4 space-y-2">{approvers.map(u=>{const n=selected.indexOf(u.id);return <button type="button" key={u.id} onClick={()=>toggle(u.id)} className={`flex w-full items-center justify-between rounded-xl border p-4 text-left ${n>=0?"border-blue-300 bg-blue-50":"border-slate-200"}`}><div><b>{u.name}</b><div className="text-xs text-slate-500">{u.position} · {u.area}</div></div>{n>=0?<span className="grid h-8 w-8 place-items-center rounded-full bg-[#1261A0] text-white">{n+1}</span>:<span className="text-xs text-slate-400">Pilih</span>}</button>})}</div></div>
    <div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="btn-secondary">Batal</button><button className="btn-primary">Submit Pengajuan <ChevronRight size={17}/></button></div>
  </form>
}
function Field({label,children}){return <div><label className="label">{label}</label>{children}</div>}

function Detail({ user, doc, onBack, onApprove, verify }) {
  const [signature, setSignature] = useState("");
  const [comment, setComment] = useState("");
  const [showFinalDocument, setShowFinalDocument] = useState(false);

  if (!doc) {
    return <div>Dokumen tidak ditemukan.</div>;
  }

  const step = doc.steps.find(
    (s) => s.approverId === user.id && s.status === "WAITING"
  );

  const active =
    step &&
    doc.steps
      .filter((s) => s.order < step.order)
      .every((s) => s.status === "APPROVED");

  // ================================
  // FINAL DOCUMENT PREVIEW
  // ================================
  if (showFinalDocument && doc.status === "APPROVED") {
    return (
      <div className="min-h-screen bg-slate-100 p-5">
        {/* HEADER PREVIEW */}
        <div className="mx-auto mb-5 flex max-w-5xl items-center justify-between gap-4">
          <div>
            <button
              onClick={() => setShowFinalDocument(false)}
              className="text-sm font-semibold text-[#1261A0]"
            >
              ← Kembali ke Detail
            </button>

            <h1 className="mt-2 text-xl font-extrabold text-slate-900">
              Final Approved Document
            </h1>

            <p className="text-sm text-slate-500">
              {doc.submissionNo} · {doc.title}
            </p>
          </div>

          <button
            className="btn-primary"
            onClick={() => window.print()}
          >
            <FileText size={16} />
            Print / Save PDF
          </button>
        </div>

        {/* ============================
            A4 DOCUMENT
        ============================ */}
        <div
          id="final-document"
          className="mx-auto bg-white shadow-xl"
          style={{
            width: "210mm",
            minHeight: "297mm",
            padding: "22mm 20mm",
          }}
        >
          {/* DOCUMENT HEADER */}
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-900">
              DOKUMEN TRANSMITTAL
            </h2>

            <div className="mt-2 text-sm text-slate-500">
              {doc.submissionNo}
            </div>
          </div>

          {/* DOCUMENT CONTENT */}
          <div className="mt-12 text-sm leading-7 text-slate-800">
            <p>
              Dengan ini dokumen berikut telah melalui proses persetujuan
              sesuai dengan approval chain yang telah ditentukan.
            </p>

            <div className="mt-8 space-y-4">
              <div>
                <span className="font-semibold">Nomor Pengajuan:</span>{" "}
                {doc.submissionNo}
              </div>

              <div>
                <span className="font-semibold">Judul Dokumen:</span>{" "}
                {doc.title}
              </div>

              <div>
                <span className="font-semibold">Departemen:</span>{" "}
                {doc.department}
              </div>

              <div>
                <span className="font-semibold">Area/Wilayah:</span>{" "}
                {doc.area}
              </div>

              <div>
                <span className="font-semibold">Keperluan:</span>{" "}
                {doc.description || "-"}
              </div>
            </div>
          </div>

          {/* =================================
              SPACE UNTUK ISI SURAT
              ================================= */}
          <div style={{ minHeight: "115mm" }} />

          {/* =================================
              APPROVAL SIGNATURE
              3 TTD HORIZONTAL
              ================================= */}
          <div>
            <div className="mb-5 text-sm text-slate-700">
              Menyetujui,
            </div>

            <div className="grid grid-cols-3 gap-5 text-center">
              {doc.steps.map((step) => (
                <div key={step.id}>
                  {/* SIGNATURE AREA */}
                  <div className="flex h-20 items-center justify-center">
                    {step.signature ? (
                      <img
                        src={step.signature}
                        alt={`Signature ${step.approverName}`}
                        className="h-16 max-w-32 object-contain"
                      />
                    ) : (
                      <span className="text-xs italic text-slate-300">
                        Signature
                      </span>
                    )}
                  </div>

                  {/* GARIS */}
                  <div className="mx-auto w-32 border-b border-slate-700" />

                  {/* NAME */}
                  <div className="mt-2 text-sm font-bold text-slate-900">
                    {step.approverName}
                  </div>

                  {/* POSITION */}
                  <div className="mt-1 text-xs text-slate-500">
                    {step.position}
                  </div>

                  {/* AREA */}
                  <div className="text-xs text-slate-400">
                    {step.area}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* APPROVAL DATE */}
          <div className="mt-8 text-right text-xs text-slate-400">
            Approved: {fmt(doc.approvedAt)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* BACK */}
      <button
        onClick={onBack}
        className="mb-4 text-sm font-semibold text-[#1261A0]"
      >
        ← Kembali
      </button>

      {/* =================================
          DOCUMENT HEADER
          ================================= */}
      <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <div className="text-xs font-bold uppercase text-slate-400">
            {doc.submissionNo}
          </div>

          <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
            {doc.title}
          </h1>

          <p className="text-sm text-slate-500">
            {doc.type} · {doc.department} · {doc.area}
          </p>
        </div>

        <Badge status={doc.status} />
      </div>

      {/* =================================
          MAIN CONTENT
          ================================= */}
      <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">

        {/* =================================
            LEFT SIDE
            ================================= */}
        <div className="space-y-5">

          {/* DOCUMENT INFORMATION */}
          <div className="card p-5">
            <h2 className="font-bold text-slate-900">
              Informasi Dokumen
            </h2>

            <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">

              <div>
                <small className="text-slate-400">
                  Pemohon
                </small>

                <div className="font-semibold">
                  {doc.applicantName}
                </div>
              </div>

              <div>
                <small className="text-slate-400">
                  Tanggal Pengajuan
                </small>

                <div className="font-semibold">
                  {fmt(doc.createdAt)}
                </div>
              </div>

              <div className="sm:col-span-2">
                <small className="text-slate-400">
                  Keperluan
                </small>

                <div>
                  {doc.description || "-"}
                </div>
              </div>
            </div>

            {/* ORIGINAL DOCUMENT */}
            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <FileText
                  size={20}
                  className="text-[#1261A0]"
                />

                <div>
                  <div className="font-semibold">
                    Original Document
                  </div>

                  <div className="text-xs text-slate-500">
                    {doc.fileName}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* =================================
              APPROVAL CHAIN
              ================================= */}
          <div className="card p-5">
            <h2 className="font-bold text-slate-900">
              Approval Chain
            </h2>

            <div className="mt-5 space-y-4">

              {doc.steps.map((s, i) => (
                <div
                  key={s.id}
                  className="relative flex gap-4"
                >

                  {/* CONNECTOR */}
                  {i < doc.steps.length - 1 && (
                    <div className="absolute left-4 top-9 h-full w-px bg-slate-200" />
                  )}

                  {/* STEP ICON */}
                  <div
                    className={`z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                      s.status === "APPROVED"
                        ? "bg-emerald-100 text-emerald-700"
                        : s.status === "REJECTED"
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {s.status === "APPROVED" ? (
                      <Check size={16} />
                    ) : s.status === "REJECTED" ? (
                      <X size={16} />
                    ) : (
                      s.order
                    )}
                  </div>

                  {/* STEP CONTENT */}
                  <div className="flex-1 rounded-xl border border-slate-100 p-3">

                    <div className="flex justify-between gap-2">

                      <div>
                        <b>{s.approverName}</b>

                        <div className="text-xs text-slate-500">
                          {s.position} · {s.area}
                        </div>
                      </div>

                      <Badge status={s.status} />
                    </div>

                    {/* SIGNED TIME */}
                    {s.signedAt && (
                      <div className="mt-2 text-xs text-slate-400">
                        Signed: {fmt(s.signedAt)}
                      </div>
                    )}

                    {/* COMMENT */}
                    {s.comment && (
                      <div className="mt-2 rounded-lg bg-slate-50 p-2 text-sm">
                        <b>Catatan:</b>{" "}
                        {s.comment}
                      </div>
                    )}

                    {/* SIGNATURE EVIDENCE */}
                    {s.signature && (
                      <div className="mt-3">

                        <div className="mb-1 text-xs font-semibold text-slate-500">
                          Signature Evidence
                        </div>

                        <img
                          src={s.signature}
                          alt={`Signature ${s.approverName}`}
                          className="h-14 max-w-32 object-contain"
                        />

                      </div>
                    )}

                  </div>
                </div>
              ))}

            </div>
          </div>
        </div>

        {/* =================================
            RIGHT SIDE
            ================================= */}
        <div className="space-y-5">

          {/* =================================
              APPROVAL ACTION
              ================================= */}
          {active && doc.status === "IN_APPROVAL" && (
            <div className="card border-blue-200 p-5">

              <h2 className="font-bold text-[#1261A0]">
                Tindakan Approval — Step {step.order}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Approve memerlukan signature evidence.
              </p>

              {/* SIGNATURE */}
              <div className="mt-4">
                <label className="label">
                  Tanda Tangan
                </label>

                <SignaturePad
                  onChange={setSignature}
                />
              </div>

              {/* COMMENT */}
              <div className="mt-4">
                <label className="label">
                  Catatan
                </label>

                <textarea
                  className="input min-h-24"
                  value={comment}
                  onChange={(e) =>
                    setComment(e.target.value)
                  }
                  placeholder="Wajib jika Reject"
                />
              </div>

              {/* ACTION BUTTON */}
              <div className="mt-4 grid grid-cols-2 gap-2">

                <button
                  className="btn-danger"
                  onClick={() => {
                    if (!comment.trim()) {
                      return alert(
                        "Catatan wajib untuk Reject."
                      );
                    }

                    onApprove(
                      doc.id,
                      step.id,
                      "REJECT",
                      null,
                      comment
                    );
                  }}
                >
                  Reject
                </button>

                <button
                  className="btn-primary"
                  onClick={() => {
                    if (!signature) {
                      return alert(
                        "Tanda tangan wajib."
                      );
                    }

                    onApprove(
                      doc.id,
                      step.id,
                      "APPROVE",
                      signature,
                      comment
                    );
                  }}
                >
                  Approve
                  <Check size={16} />
                </button>

              </div>
            </div>
          )}

          {/* =================================
              APPROVED
              ================================= */}
          {doc.status === "APPROVED" && (
            <div className="space-y-5">

              {/* FINAL DOCUMENT */}
              <div className="card border-emerald-200 bg-emerald-50/50 p-5">

                <div className="flex items-center gap-2 font-bold text-emerald-700">
                  <CheckCircle2 size={20} />

                  Semua approval selesai
                </div>

                <p className="mt-2 text-sm text-slate-600">
                  Dokumen telah disetujui oleh seluruh
                  approver.
                </p>

                {/* FINAL DOCUMENT BUTTON */}
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">

                  <div className="flex items-center gap-3">

                    <div className="rounded-xl bg-blue-50 p-2 text-[#1261A0]">
                      <FileCheck2 size={20} />
                    </div>

                    <div className="flex-1">
                      <div className="font-semibold text-slate-900">
                        Final Approved Document
                      </div>

                      <div className="text-xs text-slate-500">
                        Dokumen dengan 3 signature approval.
                      </div>
                    </div>

                  </div>

                  <button
                    className="btn-primary mt-4 w-full"
                    onClick={() =>
                      setShowFinalDocument(true)
                    }
                  >
                    <FileText size={16} />
                    Lihat Dokumen Final
                  </button>

                </div>
              </div>

              {/* =================================
                  QR VERIFICATION
                  ================================= */}
              <div className="card border-blue-200 bg-blue-50/40 p-5">

                <div className="flex items-center gap-2 font-bold text-[#1261A0]">
                  <QrCode size={20} />

                  Verification QR
                </div>

                <p className="mt-2 text-sm text-slate-600">
                  QR digunakan untuk membuka halaman
                  verification dan tidak dimasukkan ke
                  dalam surat.
                </p>

                <div className="mt-4 rounded-xl bg-white p-5 text-center">

                  <QRCodeSVG
                    value={doc.qr}
                    size={190}
                    className="mx-auto"
                  />

                  <button
                    className="btn-secondary mt-4 w-full"
                    onClick={verify}
                  >
                    <QrCode size={16} />
                    Buka Verification
                  </button>

                </div>
              </div>

            </div>
          )}

          {/* =================================
              REJECTED
              ================================= */}
          {doc.status === "REJECTED" && (
            <div className="card border-red-200 bg-red-50 p-5">

              <div className="flex items-center gap-2 font-bold text-red-700">
                <XCircle size={20} />
                Pengajuan Ditolak
              </div>

              <p className="mt-2 text-sm text-red-700">
                Periksa approval chain untuk melihat
                catatan penolakan.
              </p>

            </div>
          )}

        </div>
      </div>
    </>
  );
}

function Verification({doc,onBack}) {
  if(!doc)return <div className="grid min-h-screen place-items-center">Dokumen tidak ditemukan.</div>;
  return <div className="min-h-screen bg-slate-50 p-5 md:p-10"><div className="mx-auto max-w-2xl"><div className="mb-6 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-600 text-white"><ShieldCheck/></div><h1 className="mt-4 text-2xl font-extrabold">Dokumen Terverifikasi</h1><p className="text-sm text-slate-500">Approval evidence</p></div><div className="card p-5"><div className="flex justify-between gap-3"><div><div className="text-xs font-bold uppercase text-slate-400">{doc.submissionNo}</div><h2 className="mt-1 text-xl font-bold">{doc.title}</h2></div><Badge status={doc.status}/></div><div className="mt-6"><h3 className="font-bold">Approver</h3><div className="mt-3 space-y-2">{doc.steps.map(s=><div key={s.id} className="flex items-center gap-3 rounded-xl border p-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-50 text-emerald-600"><Check size={17}/></div><div className="flex-1"><b>{s.approverName}</b><div className="text-xs text-slate-500">{s.position} · {s.area}</div></div><div className="text-xs text-slate-400">{fmt(s.signedAt)}</div></div>)}</div></div><button onClick={onBack} className="btn-secondary mt-6 w-full">Kembali</button></div></div></div>;
}

createRoot(document.getElementById("root")).render(<App/>);

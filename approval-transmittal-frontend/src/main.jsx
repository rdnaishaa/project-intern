import React, {
  useEffect,
  useRef,
  useState
} from "react";

import {
  createRoot
} from "react-dom/client";

import {
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  QrCode,
  Search,
  ShieldCheck,
  Upload,
  Users,
  X,
  XCircle
} from "lucide-react";


import {
  QRCodeSVG
} from "qrcode.react";

import "./index.css";


/* =========================================================
   MASTER USER / DATABASE
========================================================= */

const MASTER_USERS = [

  {
    id: 1,
    name: "Faisal Kurnia Nugraha",
    nik: "10160031",
    position: "HRBP Staff",
    area: "HO",
    department: "HRBP",
    role: "APPLICANT"
  },

  {
    id: 2,
    name: "Budi",
    nik: "EMP-BUDI",
    position: "HRBP Manager",
    area: "Bontang",
    department: "HRBP",
    role: "REVIEWER"
  },

  {
    id: 3,
    name: "Andi",
    nik: "EMP-ANDI",
    position: "HR Manager",
    area: "Gresik",
    department: "HR",
    role: "REVIEWER"
  },

  {
    id: 4,
    name: "Sari",
    nik: "EMP-SARI",
    position: "Head of HR",
    area: "HO",
    department: "HR",
    role: "APPROVER"
  },

  {
    id: 5,
    name: "Dimas",
    nik: "EMP-DIMAS",
    position: "Director",
    area: "HO",
    department: "Management",
    role: "APPROVER"
  },

  {
    id: 6,
    name: "Rina",
    nik: "EMP-RINA",
    position: "Management",
    area: "HO",
    department: "Management",
    role: "VIEWER"
  }

];


/* =========================================================
   HELPERS
========================================================= */
/* =========================================================
   DOCUMENT ACCESS CONTROL
========================================================= */

function canAccessDocument(
  doc,
  user
) {

  /*
    Public / belum login
    tidak boleh mengakses file dokumen.
  */

  if (
    !doc ||
    !user
  ) {
    return false;
  }


  /*
    Applicant:
    hanya boleh melihat dokumen
    yang dia ajukan sendiri.
  */

  const isApplicant =
    String(
      doc.applicantId
    ) ===
    String(
      user.id
    );


  if (
    isApplicant
  ) {
    return true;
  }


  /*
    Reviewer / Approver:
    hanya boleh melihat dokumen
    jika user tersebut tercatat
    dalam approval chain.
  */

  const isAssigned =
    Array.isArray(
      doc.steps
    ) &&
    doc.steps.some(
      step =>
        String(
          step.approverId
        ) ===
        String(
          user.id
        )
    );


  if (
    isAssigned
  ) {
    return true;
  }


  return false;
}

function uid() {
  return Math.random()
    .toString(36)
    .slice(2, 10);
}


function verificationUrl(id) {
  return `${window.location.origin}/?verify=${id}`;
}


function fmt(date) {
  if (!date) {
    return "-";
  }

  return new Date(date).toLocaleString(
    "id-ID",
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  );
}

function canAccessFinalDocument(
  doc,
  user
) {

  /*
    Dokumen final hanya tersedia
    setelah seluruh approval selesai.
  */

  if (
    !doc ||
    doc.status !== "APPROVED"
  ) {
    return false;
  }


  return canAccessDocument(
    doc,
    user
  );
}
  /* =========================================================
   DUMMY WHATSAPP NOTIFICATION
========================================================= */

function createWhatsAppNotification({
  doc,
  recipient,
  type,
  step = null
}) {

  const now = new Date().toISOString();

  let title = "";
  let message = "";
  let actionLabel = "";
  let actionType = "";

  if (type === "SUBMITTED") {

    title = "Pengajuan Baru";

    message =
      `Pengajuan ${doc.submissionNo} membutuhkan review Anda.`;

    actionLabel = "Review Now";
    actionType = "REVIEW";

  }

  else if (type === "NEXT_REVIEWER") {

    title = "Menunggu Review Anda";

    message =
      `Dokumen ${doc.submissionNo} telah melewati tahap sebelumnya dan sekarang menunggu review Anda.`;

    actionLabel = "Review Now";
    actionType = "REVIEW";

  }

  else if (type === "NEXT_APPROVER") {

    title = "Menunggu Approval Anda";

    message =
      `Dokumen ${doc.submissionNo} telah melewati seluruh tahap reviewer dan sekarang menunggu persetujuan Anda.`;

    actionLabel = "Approve Now";
    actionType = "APPROVE";

  }

  else if (type === "REJECTED") {

    title = "Dokumen Perlu Revisi";

    message =
      `Pengajuan ${doc.submissionNo} ditolak dan perlu diperbaiki oleh pemohon.`;

    actionLabel = "Lihat Pengajuan";
    actionType = "VIEW";

  }

  else if (type === "COMPLETED") {

    title = "Approval Selesai";

    message =
      `Seluruh tahapan approval ${doc.submissionNo} telah selesai. Dokumen telah disetujui.`;

    actionLabel = "Lihat Dokumen";
    actionType = "VIEW";

  }

  return {

    id: uid(),

    documentId:
      doc.id,

    recipientId:
      recipient?.id || null,

    recipientName:
      recipient?.name || "User",

    recipientPhone:
      recipient?.phone || "08xxxxxxxxxx",

    type,

    title,

    message,

    actionLabel,

    actionType,

    stepId:
      step?.id || null,

    sentAt:
      now,

    status:
      "SENT"

  };
}

/* =========================================================
   GET CURRENT APPROVAL STEP
========================================================= */

function getCurrentStep(doc) {
  if (!doc || !Array.isArray(doc.steps) || doc.steps.length === 0) {
    return null;
  }

  const sortedSteps = [...doc.steps].sort(
    (a, b) => Number(a.order) - Number(b.order)
  );

  // Step WAITING pertama berdasarkan urutan = step aktif
  return (
    sortedSteps.find(
      step => step.status === "WAITING"
    ) || null
  );
}


function isStepActive(doc, stepId) {
  if (!doc || !Array.isArray(doc.steps)) {
    return false;
  }

  const step = doc.steps.find(
    item => String(item.id) === String(stepId)
  );

  if (!step || step.status !== "WAITING") {
    return false;
  }

  const previousSteps = doc.steps.filter(
    item => Number(item.order) < Number(step.order)
  );

  // Kalau step pertama → langsung aktif
  if (previousSteps.length === 0) {
    return true;
  }

  // Step berikutnya hanya aktif kalau SEMUA sebelumnya approved
  return previousSteps.every(
    item => item.status === "APPROVED"
  );
}


/* =========================================================
   INITIAL DOCUMENT
========================================================= */

/*
  Budi dibuat APPROVED untuk demo.
  Tetapi signature dibuat null karena signature lama
  bukan image data.

  Kalau mau mengetes dari awal:
  ubah Budi menjadi WAITING.
*/

const INITIAL_DOCS = [];


/* =========================================================
   BADGE
========================================================= */

function Badge({
  status
}) {

  const map = {

    APPROVED: [
      "bg-emerald-50 text-emerald-700",
      "Approved"
    ],

    IN_APPROVAL: [
      "bg-amber-50 text-amber-700",
      "In Approval"
    ],

    WAITING: [
      "bg-amber-50 text-amber-700",
      "Waiting"
    ],

    REJECTED: [
      "bg-red-50 text-red-700",
      "Rejected"
    ],

    REVIEWER: [
      "bg-violet-50 text-violet-700",
      "Reviewer"
    ],

    APPROVER: [
      "bg-blue-50 text-blue-700",
      "Approver"
    ],

    APPLICANT: [
      "bg-violet-50 text-violet-700",
      "Applicant"
    ],

    VIEWER: [
      "bg-slate-100 text-slate-700",
      "Viewer"
    ]

  };

  const [
    cls,
    label
  ] =
    map[status] ||
    [
      "bg-slate-100 text-slate-600",
      status
    ];

  return (
    <span
      className={
        `rounded-full px-2.5 py-1 ` +
        `text-xs font-semibold ${cls}`
      }
    >
      {label}
    </span>
  );
}


/* =========================================================
   SIGNATURE PAD
========================================================= */

function SignaturePad({
  value,
  onChange
}) {

  const canvasRef =
    useRef(null);

  const drawing =
    useRef(false);

  const hasDrawn =
    useRef(false);


  useEffect(() => {

    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }

    const ctx =
      canvas.getContext(
        "2d"
      );

    ctx.lineWidth = 3;

    ctx.lineCap =
      "round";

    ctx.lineJoin =
      "round";

    ctx.strokeStyle =
      "#172033";

  }, []);


  const getPoint = event => {

    const canvas =
      canvasRef.current;

    const rect =
      canvas.getBoundingClientRect();

    return {

      x:
        (event.clientX -
          rect.left) *
        (canvas.width /
          rect.width),

      y:
        (event.clientY -
          rect.top) *
        (canvas.height /
          rect.height)

    };
  };


  const startDrawing =
    event => {

      event.preventDefault();

      const canvas =
        canvasRef.current;

      const ctx =
        canvas.getContext(
          "2d"
        );

      const point =
        getPoint(event);

      drawing.current =
        true;

      hasDrawn.current =
        true;

      ctx.beginPath();

      ctx.moveTo(
        point.x,
        point.y
      );
    };


  const draw =
    event => {

      event.preventDefault();

      if (
        !drawing.current
      ) {
        return;
      }

      const canvas =
        canvasRef.current;

      const ctx =
        canvas.getContext(
          "2d"
        );

      const point =
        getPoint(event);

      ctx.lineTo(
        point.x,
        point.y
      );

      ctx.stroke();
    };


  const finishDrawing =
    () => {

      if (
        !drawing.current
      ) {
        return;
      }

      drawing.current =
        false;

      const canvas =
        canvasRef.current;

      if (
        hasDrawn.current &&
        canvas
      ) {

        /*
          HASIL:
          data:image/png;base64,...
        */

        const image =
          canvas.toDataURL(
            "image/png"
          );

        onChange(image);
      }
    };


  const clear =
    () => {

      const canvas =
        canvasRef.current;

      if (!canvas) {
        return;
      }

      const ctx =
        canvas.getContext(
          "2d"
        );

      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      drawing.current =
        false;

      hasDrawn.current =
        false;

      onChange("");
    };


  return (

    <div>

      <div
        className="
          rounded-xl
          border-2
          border-dashed
          border-slate-300
          bg-slate-50
          p-2
        "
      >

        <canvas

          ref={
            canvasRef
          }

          width="900"

          height="250"

          className="
            h-40
            w-full
            touch-none
            rounded-lg
            bg-white
          "

          onPointerDown={
            startDrawing
          }

          onPointerMove={
            draw
          }

          onPointerUp={
            finishDrawing
          }

          onPointerLeave={
            finishDrawing
          }

          onPointerCancel={
            finishDrawing
          }

        />

      </div>


      <div
        className="
          mt-2
          flex
          items-center
          justify-between
        "
      >

        <span
          className="
            text-xs
            text-slate-400
          "
        >
          Gambar tanda tangan
          pada area di atas.
        </span>


        <button

          type="button"

          onClick={
            clear
          }

          className="
            text-xs
            font-semibold
            text-red-600
          "
        >
          Hapus &
          Gambar Ulang
        </button>

      </div>


      {value && (

        <div
          className="
            mt-3
            rounded-xl
            border
            border-emerald-200
            bg-emerald-50
            p-3
          "
        >

          <div
            className="
              mb-2
              text-xs
              font-bold
              text-emerald-700
            "
          >
            Signature berhasil
            direkam ✓
          </div>


          <div
            className="
              flex
              h-20
              items-center
              justify-center
              rounded-lg
              bg-white
            "
          >

            <img
              src={value}
              alt="Preview tanda tangan"
              className="
                max-h-16
                max-w-[250px]
                object-contain
              "
            />

          </div>

        </div>

      )}

    </div>
  );
}

function WhatsAppNotifications({
  notifications,
  onOpen
}) {

  return (

    <div className="min-h-screen bg-slate-50 p-5 md:p-10">

      <div className="mx-auto max-w-3xl">

        <div className="mb-6">

          <div className="flex items-center gap-3">

            <div className="rounded-xl border bg-white p-3">

              <MessageCircle
                size={24}
              />

            </div>

            <div>

              <h1 className="text-2xl font-extrabold">

                WhatsApp Notifications

              </h1>

              <p className="text-sm text-slate-500">

                Simulasi notifikasi approval berjenjang

              </p>

            </div>

          </div>

        </div>


        {notifications.length === 0 ? (

          <div className="card p-10 text-center">

            <MessageCircle
              size={40}
              className="mx-auto mb-3 text-slate-300"
            />

            <p className="font-semibold">

              Belum ada notifikasi

            </p>

            <p className="mt-1 text-sm text-slate-400">

              Notifikasi akan muncul ketika
              pengajuan diproses.

            </p>

          </div>

        ) : (

          <div className="space-y-4">

            {notifications.map(
              notification => (

                <div
                  key={
                    notification.id
                  }
                  className="overflow-hidden rounded-2xl border bg-white shadow-sm"
                >

                  {/* HEADER */}

                  <div className="flex items-center gap-3 border-b p-4">

                    <div className="grid h-10 w-10 place-items-center rounded-full border">

                      <MessageCircle
                        size={20}
                      />

                    </div>

                    <div className="flex-1">

                      <div className="text-sm font-bold">

                        WhatsApp

                      </div>

                      <div className="text-xs text-slate-400">

                        Terkirim •{" "}
                        {fmt(
                          notification.sentAt
                        )}

                      </div>

                    </div>

                    <span className="rounded-full border px-2 py-1 text-[10px] font-bold">

                      SENT

                    </span>

                  </div>


                  {/* MESSAGE */}

                  <div className="p-5">

                    <div className="mb-4">

                      <div className="text-xs text-slate-400">

                        Kepada

                      </div>

                      <div className="font-bold">

                        {notification.recipientName}

                      </div>

                      <div className="text-xs text-slate-400">

                        {notification.recipientPhone}

                      </div>

                    </div>


                    <div className="rounded-2xl border p-4">

                      <div className="mb-2 font-bold">

                        {notification.title}

                      </div>

                      <p className="text-sm leading-6 text-slate-600">

                        {notification.message}

                      </p>


                      <button
                        type="button"
                        onClick={() =>
                          onOpen(
                            notification.documentId
                          )
                        }
                        className="btn-primary mt-4 w-full"
                      >

                        {notification.actionLabel}

                        <ChevronRight
                          size={16}
                        />

                      </button>

                    </div>

                  </div>

                </div>

              )
            )}

          </div>

        )}

      </div>

    </div>

  );
}

/* =========================================================
   APP
========================================================= */

/* =========================================================
   APP
========================================================= */

function App() {

  const [
    users
  ] =
    useState(
      MASTER_USERS
    );


  const [
    docs,
    setDocs
  ] =
    useState(
      INITIAL_DOCS
    );


  const [
    whatsappNotifications,
    setWhatsappNotifications
  ] =
    useState([]);


  const [
    user,
    setUser
  ] =
    useState(null);


  const [
    page,
    setPage
  ] =
    useState(
      "dashboard"
    );


  const [
    selectedId,
    setSelectedId
  ] =
    useState(null);


  const [
    creating,
    setCreating
  ] =
    useState(false);


  /*
    LOGIN / AUTHORIZATION MODAL

    Dipakai untuk:
    1. Buat Pengajuan
    2. Review
    3. Approve
  */

  const [
    authRequest,
    setAuthRequest
  ] =
    useState(null);


  const [
    actionContext,
    setActionContext
  ] =
    useState(null);


  const [
    previewFinal,
    setPreviewFinal
  ] =
    useState(false);


  const [
    verifyId,
    setVerifyId
  ] =
    useState(() => {

      const value =
        new URLSearchParams(
          window.location.search
        ).get(
          "verify"
        );

      return value
        ? Number(value)
        : null;

    });


  /* =======================================================
     NAVIGATION
  ======================================================= */

  const open =
    id => {

      setSelectedId(
        id
      );

      setPage(
        "detail"
      );

      setCreating(
        false
      );

      setActionContext(
        null
      );

      setVerifyId(
        null
      );

      window.history.pushState(
        {},
        "",
        `?document=${id}`
      );

    };


  const go =
    target => {

      setPage(
        target
      );

      setSelectedId(
        null
      );

      setCreating(
        false
      );

      setActionContext(
        null
      );

      setAuthRequest(
        null
      );

      window.history.pushState(
        {},
        "",
        "?"
      );

    };


  const openVerification =
    id => {

      setVerifyId(
        id
      );

      setSelectedId(
        null
      );

      setActionContext(
        null
      );

      setAuthRequest(
        null
      );

      window.history.pushState(
        {},
        "",
        `?verify=${id}`
      );

    };


  /* =======================================================
     OPEN CREATE REQUEST
     
     BUAT PENGAJUAN WAJIB LOGIN
  ======================================================= */

  function openCreateRequest() {

    /*
      Jika belum login,
      buka AuthModal.
    */

    if (!user) {

      setAuthRequest({

        action:
          "CREATE"

      });

      return;

    }


    /*
      Jika sudah login,
      langsung masuk form.
    */

    setCreating(
      true
    );

    setPage(
      "create"
    );

  }


  /* =========================================================
     SEND DUMMY WHATSAPP
  ========================================================= */

  function sendWhatsApp({
    doc,
    recipient,
    type,
    step = null
  }) {

    if (
      !doc ||
      !recipient
    ) {

      return;

    }


    const notification =
      createWhatsAppNotification({

        doc,

        recipient,

        type,

        step

      });


    setWhatsappNotifications(
      current => [

        notification,

        ...current

      ]
    );

  }


  /* =======================================================
     CREATE REQUEST
  ======================================================= */

  function submitRequest(
    data
  ) {

    /*
      Safety check.

      Pengajuan tidak boleh dibuat
      tanpa user login.
    */

    if (!user) {

      alert(
        "Silakan login terlebih dahulu untuk membuat pengajuan."
      );


      setAuthRequest({

        action:
          "CREATE"

      });


      return;

    }


    const newId =
      Date.now();


    const now =
      new Date()
        .toISOString();


    const no =
      `TR-2026-${String(
        docs.length + 1
      ).padStart(
        3,
        "0"
      )}`;


    const newDoc = {

      ...data,


      id:
        newId,


      submissionNo:
        no,


      applicantId:
        user.id,


      applicantName:
        user.name,


      createdAt:
        now,


      status:
        "IN_APPROVAL",


      approvedAt:
        null,


      /*
        QR dibuat sejak awal pengajuan.
      */

      qr:
        verificationUrl(
          newId
        ),


      steps:
        data.approvalChain.map(
          (
            item,
            index
          ) => ({

            id:
              uid(),


            order:
              index + 1,


            role:
              item.role,


            approverId:
              Number(
                item.id
              ),


            approverName:
              item.name,


            position:
              item.position,


            area:
              item.area,


            status:
              "WAITING",


            comment:
              "",


            signedAt:
              null,


            signature:
              null

          })
        )

    };


    setDocs(
      current => [

        newDoc,

        ...current

      ]
    );


    /* =====================================================
       WHATSAPP
       KIRIM KE REVIEWER / APPROVER PERTAMA
    ===================================================== */

    const firstStep =
      [
        ...newDoc.steps
      ]
        .sort(
          (
            a,
            b
          ) =>
            Number(a.order) -
            Number(b.order)
        )[0];


    if (
      firstStep
    ) {

      const firstReviewer =
        users.find(
          user =>
            String(user.id) ===
            String(
              firstStep.approverId
            )
        );


      if (
        firstReviewer
      ) {

        sendWhatsApp({

          doc:
            newDoc,


          recipient:
            firstReviewer,


          type:
            firstStep.role ===
            "REVIEWER"

              ? "SUBMITTED"

              : "NEXT_APPROVER",


          step:
            firstStep

        });

      }

    }


    open(
      newId
    );

  }


  /* =======================================================
     REQUEST ACTION
  ======================================================= */

  function requestApprovalAction(
    doc,
    step
  ) {

    if (
      !doc ||
      !step
    ) {

      return;

    }


    setAuthRequest({

      docId:
        doc.id,


      stepId:
        step.id,


      action:
        step.role ===
        "REVIEWER"

          ? "REVIEW"

          : "APPROVE"

    });

  }


  /* =======================================================
     AUTHORIZE ACTION
  ======================================================= */

  function authorizeAction(
    selectedUserId
  ) {

    if (
      !authRequest
    ) {

      return;

    }


    /* =====================================================
       CARI USER DARI DATABASE
    ===================================================== */

    const selectedUser =
      users.find(
        item =>
          String(item.id) ===
          String(selectedUserId)
      );


    if (
      !selectedUser
    ) {

      alert(
        "User tidak ditemukan."
      );

      return;

    }
/* =====================================================
   GENERAL LOGIN
===================================================== */

if (
  authRequest.action ===
  "LOGIN"
) {

  setUser(
    selectedUser
  );


  setAuthRequest(
    null
  );


  return;

}

    /* =====================================================
       CREATE REQUEST
       
       LOGIN UNTUK MEMBUAT PENGAJUAN
    ===================================================== */

    if (
      authRequest.action ===
      "CREATE"
    ) {

      /*
        User berhasil login.
      */

      setUser(
        selectedUser
      );


      /*
        Tutup modal.
      */

      setAuthRequest(
        null
      );


      /*
        Masuk ke form pengajuan.
      */

      setCreating(
        true
      );


      setPage(
        "create"
      );


      return;

    }


    /* =====================================================
       REVIEW / APPROVAL
    ===================================================== */

    const doc =
      docs.find(
        item =>
          String(item.id) ===
          String(
            authRequest.docId
          )
      );


    if (
      !doc
    ) {

      alert(
        "Dokumen tidak ditemukan."
      );

      return;

    }


    /* =====================================================
       AMBIL STEP AKTIF
    ===================================================== */

    const activeStep =
      getCurrentStep(
        doc
      );


    if (
      !activeStep
    ) {

      alert(
        "Tidak ada approval yang sedang menunggu."
      );

      return;

    }


    /* =====================================================
       USER HARUS SESUAI DENGAN ASSIGNEE
    ===================================================== */

    const assignedUserId =
      activeStep.approverId ??
      activeStep.assignedUserId;


    const sameUser =
      String(
        selectedUser.id
      ) ===
      String(
        assignedUserId
      );


    /*
      Fallback nama
      untuk data lama.
    */

    const sameName =
      selectedUser.name
        ?.trim()
        .toLowerCase() ===
      activeStep.approverName
        ?.trim()
        .toLowerCase();


    if (
      !sameUser &&
      !sameName
    ) {

      alert(

        `Access Denied.\n\n` +

        `Dokumen saat ini menunggu:\n` +

        `${activeStep.approverName}\n` +

        `${activeStep.role}\n` +

        `${activeStep.position}\n` +

        `${activeStep.area}`

      );


      return;

    }


    /* =====================================================
       PASTIKAN STEP MEMANG AKTIF
    ===================================================== */

    if (
      String(
        activeStep.id
      ) !==
      String(
        getCurrentStep(
          doc
        )?.id
      )
    ) {

      alert(
        "Approval sebelumnya belum selesai."
      );

      return;

    }


    /* =====================================================
       LOGIN APPROVER / REVIEWER BERHASIL
    ===================================================== */

    setUser(
      selectedUser
    );


    setActionContext({

      docId:
        doc.id,


      stepId:
        activeStep.id

    });


    setAuthRequest(
      null
    );

  }


  /* =======================================================
     APPROVE / REJECT
  ======================================================= */

  function approvalAction(
    docId,
    stepId,
    action,
    signature,
    comment
  ) {

    setDocs(
      currentDocs =>

        currentDocs.map(
          doc => {

            if (
              Number(
                doc.id
              ) !==
              Number(
                docId
              )
            ) {

              return doc;

            }


            const now =
              new Date()
                .toISOString();


            const updatedSteps =
              doc.steps.map(
                step => {

                  if (
                    String(
                      step.id
                    ) !==
                    String(
                      stepId
                    )
                  ) {

                    return step;

                  }


                  return {

                    ...step,


                    status:
                      action ===
                      "APPROVE"

                        ? "APPROVED"

                        : "REJECTED",


                    comment:
                      comment ||
                      "",


                    signedAt:
                      action ===
                      "APPROVE"

                        ? now

                        : null,


                    /*
                      Simpan gambar TTD.
                    */

                    signature:
                      action ===
                      "APPROVE"

                        ? signature

                        : null

                  };

                }

              );


            /* =================================================
               REJECT
            ================================================= */

            if (
              action ===
              "REJECT"
            ) {

              const applicant =
                users.find(
                  user =>
                    String(
                      user.id
                    ) ===
                    String(
                      doc.applicantId
                    )
                );


              if (
                applicant
              ) {

                sendWhatsApp({

                  doc: {

                    ...doc,

                    steps:
                      updatedSteps

                  },


                  recipient:
                    applicant,


                  type:
                    "REJECTED",


                  step:
                    doc.steps.find(
                      step =>
                        String(
                          step.id
                        ) ===
                        String(
                          stepId
                        )
                    )

                });

              }


              return {

                ...doc,

                steps:
                  updatedSteps,

                status:
                  "REJECTED",

                approvedAt:
                  null

              };

            }


            /* =================================================
               CEK APAKAH SEMUA SELESAI
            ================================================= */

            const allApproved =
              updatedSteps.every(
                step =>
                  step.status ===
                  "APPROVED"
              );


            /* =================================================
               WHATSAPP NEXT APPROVAL
            ================================================= */

            if (
              action ===
              "APPROVE"
            ) {

              const nextStep =
                updatedSteps
                  .filter(
                    step =>
                      step.status ===
                      "WAITING"
                  )
                  .sort(
                    (
                      a,
                      b
                    ) =>
                      Number(a.order) -
                      Number(b.order)
                  )[0];


              if (
                nextStep
              ) {

                const nextUser =
                  users.find(
                    user =>
                      String(
                        user.id
                      ) ===
                      String(
                        nextStep.approverId
                      )
                  );


                if (
                  nextUser
                ) {

                  sendWhatsApp({

                    doc: {

                      ...doc,

                      steps:
                        updatedSteps

                    },


                    recipient:
                      nextUser,


                    type:
                      nextStep.role ===
                      "REVIEWER"

                        ? "NEXT_REVIEWER"

                        : "NEXT_APPROVER",


                    step:
                      nextStep

                  });

                }

              }

            }


            /* =================================================
               SEMUA APPROVED
            ================================================= */

            if (
              allApproved
            ) {

              const applicant =
                users.find(
                  user =>
                    String(
                      user.id
                    ) ===
                    String(
                      doc.applicantId
                    )
                );


              if (
                applicant
              ) {

                sendWhatsApp({

                  doc: {

                    ...doc,

                    steps:
                      updatedSteps

                  },


                  recipient:
                    applicant,


                  type:
                    "COMPLETED"

                });

              }

            }


            return {

              ...doc,


              steps:
                updatedSteps,


              status:
                allApproved

                  ? "APPROVED"

                  : "IN_APPROVAL",


              approvedAt:
                allApproved

                  ? now

                  : null,


              /*
                QR tetap ada dari awal.
              */

              qr:
                doc.qr ||
                verificationUrl(
                  doc.id
                )

            };

          }

        )

    );


    setActionContext(
      null
    );

  }


  /* =======================================================
     CURRENT DOCUMENT
  ======================================================= */

  const currentDoc =
    docs.find(
      doc =>
        Number(
          doc.id
        ) ===
        Number(
          selectedId
        )
    );


  const actionDoc =
    actionContext
      ? docs.find(
          doc =>
            Number(
              doc.id
            ) ===
            Number(
              actionContext.docId
            )
        )
      : null;


  const actionStep =
    actionDoc
      ? actionDoc.steps.find(
          step =>
            String(
              step.id
            ) ===
            String(
              actionContext.stepId
            )
        )
      : null;


  /* =======================================================
     PUBLIC VERIFICATION
  ======================================================= */

  if (
    verifyId
  ) {

    const verificationDoc =
      docs.find(
        doc =>
          Number(
            doc.id
          ) ===
          Number(
            verifyId
          )
      );


    return (

      <VerificationPage

        doc={
          verificationDoc
        }


        onBack={() =>
          go(
            "dashboard"
          )
        }


        openDocument={
          open
        }

      />

    );

  }


  /* =======================================================
     FINAL DOCUMENT
  ======================================================= */

  if (
    previewFinal &&
    currentDoc
  ) {

    return (

      <FinalDocumentPreview

        doc={
          currentDoc
        }


        onBack={() =>
          setPreviewFinal(
            false
          )
        }

      />

    );

  }


  /* =======================================================
     CONTENT
  ======================================================= */

  let content;


  /* =======================================================
     CREATE
  ======================================================= */

  if (
    creating
  ) {

    content = (

      <CreateRequest

        users={
          users
        }

        currentUser={
            user
          }

        onSubmit={
          submitRequest
        }


        onCancel={() =>
          go(
            "requests"
          )
        }

      />

    );

  }


  /* =======================================================
     DASHBOARD
  ======================================================= */

  else if (
    page ===
    "dashboard"
  ) {

    content = (

      <Dashboard

        docs={
          docs
        }


        open={
          open
        }

      />

    );

  }


  /* =======================================================
     REQUESTS
  ======================================================= */

  else if (
    page ===
    "requests"
  ) {

    content = (

      <Requests

        docs={
          docs
        }


        open={
          open
        }


        create={
          openCreateRequest
        }

      />

    );

  }


  /* =======================================================
     APPROVALS
  ======================================================= */

  else if (
    page ===
    "approvals"
  ) {

    content = (

      <Approvals

        user={
          user
        }


        docs={
          docs
        }


        open={
          open
        }

      />

    );

  }


  /* =======================================================
     NOTIFICATIONS
  ======================================================= */

  else if (
    page ===
    "notifications"
  ) {

    content = (

      <WhatsAppNotifications

        notifications={
          whatsappNotifications
        }


        onOpen={
          open
        }

      />

    );

  }


  /* =======================================================
     DETAIL
  ======================================================= */

  else {

    content = (

      <Detail

        user={
          user
        }


        doc={
          currentDoc
        }


        actionUser={
          actionContext
            ? user
            : null
        }


        actionStep={
          actionStep
        }


        onBack={() =>
          go(
            "dashboard"
          )
        }


        onRequestAction={
          requestApprovalAction
        }


        onApprove={
          approvalAction
        }


        verify={() =>
          openVerification(
            currentDoc?.id
          )
        }


        onPreviewFinal={() =>
          setPreviewFinal(
            true
          )
        }

      />

    );

  }


  /* =======================================================
     RETURN
  ======================================================= */

  return (

    <>

    <Layout
  user={
    user
  }

  setUser={
    setUser
  }

  page={
    page
  }

  go={
    go
  }

  onLogin={() => {

    setAuthRequest({
      action: "LOGIN"
    });

  }}
>

        {content}

      </Layout>


      {/* =================================================
          AUTH MODAL
      ================================================= */}

      {authRequest && (

        <AuthModal

          users={
            users
          }


          request={
            authRequest
          }


          onClose={() =>
            setAuthRequest(
              null
            )
          }


          onContinue={
            authorizeAction
          }

        />

      )}

    </>

  );

}


/* =========================================================
   LAYOUT
========================================================= */

function Layout({
  user,
  setUser,
  page,
  go,
  onLogin,
  children
}) {

  const [
    mobileOpen,
    setMobileOpen
  ] =
    useState(false);


  const nav = [

    [
      "dashboard",
      "Dashboard",
      LayoutDashboard
    ],

    [
      "requests",
      "Pengajuan",
      ClipboardList
    ],

    [
      "approvals",
      "Approval Saya",
      FileCheck2
    ],

    [
      "notifications",
      "Notifikasi",
      Bell
    ]

  ];


  return (

    <div
      className="
        min-h-screen
        bg-slate-50
      "
    >

      <aside
        className={`
          fixed
          inset-y-0
          left-0
          z-40
          w-64
          border-r
          bg-white
          p-4
          transition-transform
          md:translate-x-0
          ${
            mobileOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }
        `}
      >

        <div
          className="
            flex
            items-center
            gap-3
            px-2
            py-3
          "
        >

          <div
            className="
              grid
              h-10
              w-10
              place-items-center
              rounded-xl
              bg-[#1261A0]
              text-white
            "
          >
            <ShieldCheck />
          </div>


          <div>

            <b>
              HRBP Transmittal
            </b>

            <div
              className="
                text-xs
                text-slate-500
              "
            >
              Approval System
            </div>

          </div>

        </div>


        <nav
          className="
            mt-6
            space-y-1
          "
        >

          {nav.map(
            ([
              key,
              label,
              Icon
            ]) => (

              <button

                key={
                  key
                }

                onClick={() => {

                  go(
                    key
                  );

                  setMobileOpen(
                    false
                  );

                }}

                className={`
                  flex
                  w-full
                  items-center
                  gap-3
                  rounded-xl
                  px-3
                  py-2.5
                  text-sm
                  font-semibold
                  ${
                    page ===
                    key
                      ? "bg-blue-50 text-[#1261A0]"
                      : "text-slate-600 hover:bg-slate-50"
                  }
                `}
              >

                <Icon
                  size={18}
                />

                {label}

              </button>

            )
          )}

        </nav>


        <div
          className="
            absolute
            bottom-4
            left-4
            right-4
            rounded-xl
            bg-slate-50
            p-3
          "
        >

          <div
            className="
              text-xs
              text-slate-500
            "
          >
            Current User
          </div>


          <div
            className="
              mt-1
              truncate
              text-sm
              font-bold
            "
          >
            {user
              ? user.name
              : "Public Viewer"}
          </div>


          <div className="mt-1">

            <Badge
              status={
                user
                  ? user.role
                  : "VIEWER"
              }
            />

          </div>

        </div>

      </aside>


      <main
        className="
          md:ml-64
        "
      >

        <header
          className="
            sticky
            top-0
            z-20
            flex
            h-16
            items-center
            justify-between
            border-b
            bg-white/90
            px-4
            backdrop-blur
            md:px-7
          "
        >

          <button
            className="md:hidden"
            onClick={() =>
              setMobileOpen(
                true
              )
            }
          >
            <Menu />
          </button>


          <span
            className="
              hidden
              text-sm
              text-slate-500
              md:block
            "
          >
            HRBP / Transmittal /
            Approval
          </span>


          {user ? (

  <div className="flex items-center gap-3">

    <div className="hidden text-right sm:block">

      <div className="text-sm font-bold text-slate-800">
        {user.name}
      </div>

      <div className="text-xs text-slate-400">
        {user.role}
      </div>

    </div>


    <button
      type="button"
      className="btn-secondary"
      onClick={() => {

        setUser(null);

      }}
    >

      <LogOut
        size={16}
      />

      Logout

    </button>

  </div>

) : (

  <button
    type="button"
    className="btn-primary"
    onClick={onLogin}
  >

    Login

  </button>

)}

        </header>


        <div
          className="
            p-4
            md:p-7
          "
        >
          {children}
        </div>

      </main>

    </div>
  );
}


/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard({
  docs,
  open
}) {

  const cards = [

    [
      "Total Pengajuan",
      docs.length,
      ClipboardList
    ],

    [
      "Menunggu Approval",
      docs.filter(
        d =>
          d.status ===
          "IN_APPROVAL"
      ).length,
      Clock3
    ],

    [
      "Approved",
      docs.filter(
        d =>
          d.status ===
          "APPROVED"
      ).length,
      CheckCircle2
    ],

    [
      "Rejected",
      docs.filter(
        d =>
          d.status ===
          "REJECTED"
      ).length,
      XCircle
    ]

  ];


  return (

    <>

      <div className="mb-7">

        <h1
          className="
            text-2xl
            font-extrabold
          "
        >
          Dashboard
        </h1>

        <p
          className="
            mt-1
            text-sm
            text-slate-500
          "
        >
          Dashboard public untuk melihat
          pengajuan dan progress approval.
        </p>

      </div>


      <div
        className="
          grid
          gap-4
          sm:grid-cols-2
          xl:grid-cols-4
        "
      >

        {cards.map(
          ([
            label,
            value,
            Icon
          ]) => (

            <div
              key={
                label
              }
              className="
                card
                p-5
              "
            >

              <div
                className="
                  flex
                  justify-between
                  text-sm
                  text-slate-500
                "
              >

                {label}

                <Icon
                  size={19}
                  className="
                    text-[#1261A0]
                  "
                />

              </div>


              <div
                className="
                  mt-4
                  text-3xl
                  font-extrabold
                "
              >
                {value}
              </div>

            </div>

          )
        )}

      </div>


      <div
        className="
          card
          mt-6
          p-5
        "
      >

        <h2
          className="
            font-bold
          "
        >
          Pengajuan Terbaru
        </h2>


        <div
          className="
            mt-4
            space-y-2
          "
        >

          {docs.map(
            doc => (

              <button

                key={
                  doc.id
                }

                onClick={() =>
                  open(
                    doc.id
                  )
                }

                className="
                  flex
                  w-full
                  items-center
                  justify-between
                  rounded-xl
                  border
                  p-3
                  text-left
                  hover:bg-slate-50
                "
              >

                <div>

                  <b>
                    {doc.title}
                  </b>

                  <div
                    className="
                      text-xs
                      text-slate-500
                    "
                  >
                    {
                      doc.submissionNo
                    }
                    {" · "}
                    {
                      doc.applicantName
                    }
                    {" · "}
                    {
                      doc.department
                    }
                  </div>

                </div>


                <Badge
                  status={
                    doc.status
                  }
                />

              </button>

            )
          )}

        </div>

      </div>

    </>
  );
}


/* =========================================================
   REQUESTS
========================================================= */

function Requests({
  docs,
  open,
  create
}) {

  const [
    search,
    setSearch
  ] =
    useState("");


  const filtered =
    docs.filter(
      doc =>
        `${doc.title} ${doc.submissionNo} ${doc.applicantName}`
          .toLowerCase()
          .includes(
            search.toLowerCase()
          )
    );


  return (

    <>

      <div
        className="
          mb-6
          flex
          flex-col
          justify-between
          gap-3
          sm:flex-row
          sm:items-end
        "
      >

        <div>

          <h1
            className="
              text-2xl
              font-extrabold
            "
          >
            Pengajuan
          </h1>

          <p
            className="
              mt-1
              text-sm
              text-slate-500
            "
          >
            Daftar dokumen transmittal.
          </p>

        </div>


        <button
  onClick={create}
  className="btn-primary"
>

          <FileText
            size={17}
          />

          Buat Pengajuan

        </button>

      </div>


      <div
        className="
          card
          p-4
        "
      >

        <div
          className="
            relative
            mb-4
          "
        >

          <Search
            size={18}
            className="
              absolute
              left-3
              top-2.5
              text-slate-400
            "
          />


          <input
            className="
              input
              pl-10
            "
            placeholder="
              Cari dokumen...
            "
            value={
              search
            }
            onChange={
              e =>
                setSearch(
                  e.target.value
                )
            }
          />

        </div>


        <DocumentTable

          rows={
            filtered
          }

          open={
            open
          }

        />

      </div>

    </>
  );
}


/* =========================================================
   DOCUMENT TABLE
========================================================= */

function DocumentTable({
  rows,
  open
}) {

  return (

    <div
      className="
        overflow-x-auto
      "
    >

      <table
        className="
          w-full
          text-left
          text-sm
        "
      >

        <thead
          className="
            border-b
            text-xs
            uppercase
            text-slate-400
          "
        >

          <tr>

            <th
              className="
                px-3
                py-3
              "
            >
              No.
            </th>

            <th
              className="
                px-3
                py-3
              "
            >
              Dokumen
            </th>

            <th
              className="
                px-3
                py-3
              "
            >
              Pemohon
            </th>

            <th
              className="
                px-3
                py-3
              "
            >
              Status
            </th>

            <th />

          </tr>

        </thead>


        <tbody>

          {rows.map(
            row => (

              <tr
                key={
                  row.id
                }
                className="
                  border-b
                  border-slate-50
                "
              >

                <td
                  className="
                    px-3
                    py-3
                    font-semibold
                  "
                >
                  {
                    row.submissionNo
                  }
                </td>


                <td
                  className="
                    px-3
                    py-3
                  "
                >
                  {
                    row.title
                  }
                </td>


                <td
                  className="
                    px-3
                    py-3
                  "
                >
                  {
                    row.applicantName
                  }
                </td>


                <td
                  className="
                    px-3
                    py-3
                  "
                >

                  <Badge
                    status={
                      row.status
                    }
                  />

                </td>


                <td
                  className="
                    px-3
                    py-3
                    text-right
                  "
                >

                  <button

                    className="
                      btn-secondary
                      px-3
                      py-1.5
                    "

                    onClick={() =>
                      open(
                        row.id
                      )
                    }
                  >
                    Detail
                  </button>

                </td>

              </tr>

            )
          )}

        </tbody>

      </table>


      {!rows.length && (

        <div
          className="
            p-8
            text-center
            text-sm
            text-slate-500
          "
        >
          Tidak ada data.
        </div>

      )}

    </div>
  );
}


/* =========================================================
   CREATE REQUEST
========================================================= */

function CreateRequest({
  users,
  currentUser,
  onSubmit,
  onCancel
}) {

  /*
    PEMOHON
    Diambil dari database / MASTER_USERS.
  */


  /*
    REVIEWER
    Hanya user dengan role REVIEWER
    yang muncul di dropdown Reviewer.
  */

  const reviewerUsers =
    users.filter(
      user =>
        user.role === "REVIEWER"
    );


  /*
    APPROVER
    Hanya user dengan role APPROVER
    yang muncul di dropdown Approver.
  */

  const approverUsers =
    users.filter(
      user =>
        user.role === "APPROVER"
    );


  /* =======================================================
     STATE
  ======================================================= */

  const [
    form,
    setForm
  ] = useState({

    type:
      "Transmittal",

    title:
      "",

    description:
      "",

    department:
      "",

    area:
      "",

    fileName:
      "",

    documentLink:
      ""

  });


  const [
    file,
    setFile
  ] = useState(null);


  /*
    Menyimpan ID Reviewer
    sesuai urutan dipilih.
  */

  const [
    reviewerIds,
    setReviewerIds
  ] = useState([]);


  /*
    Menyimpan ID Approver
    sesuai urutan dipilih.
  */

  const [
    approverIds,
    setApproverIds
  ] = useState([]);

  /* =======================================================
     ADD REVIEWER
  ======================================================= */

  const addReviewer =
    id => {

      if (!id) return;

      const numericId =
        Number(id);

      /*
        Jangan duplicate.
      */

      if (
        reviewerIds.includes(
          numericId
        )
      ) {
        return;
      }


      /*
        User yang sudah menjadi Approver
        tidak boleh menjadi Reviewer.
      */

      if (
        approverIds.includes(
          numericId
        )
      ) {

        alert(
          "User ini sudah dipilih sebagai Approver."
        );

        return;
      }


      /*
        Tambahkan ke paling belakang.
        Ini menentukan urutan approval.
      */

      setReviewerIds(
        current => [
          ...current,
          numericId
        ]
      );

    };


  /* =======================================================
     REMOVE REVIEWER
  ======================================================= */

  const removeReviewer =
    id => {

      setReviewerIds(
        current =>
          current.filter(
            item =>
              Number(item) !==
              Number(id)
          )
      );

    };


  /* =======================================================
     ADD APPROVER
  ======================================================= */

  const addApprover =
    id => {

      if (!id) return;

      const numericId =
        Number(id);


      /*
        Jangan duplicate.
      */

      if (
        approverIds.includes(
          numericId
        )
      ) {
        return;
      }


      /*
        User yang sudah menjadi Reviewer
        tidak boleh menjadi Approver.
      */

      if (
        reviewerIds.includes(
          numericId
        )
      ) {

        alert(
          "User ini sudah dipilih sebagai Reviewer."
        );

        return;
      }


      /*
        Tambahkan ke paling belakang.
      */

      setApproverIds(
        current => [
          ...current,
          numericId
        ]
      );

    };


  /* =======================================================
     REMOVE APPROVER
  ======================================================= */

  const removeApprover =
    id => {

      setApproverIds(
        current =>
          current.filter(
            item =>
              Number(item) !==
              Number(id)
          )
      );

    };


  /* =======================================================
     SUBMIT
  ======================================================= */

  const submit =
    event => {

      event.preventDefault();


      /*
        VALIDASI PEMOHON
      */

      if (!currentUser) {
  alert(
    "User belum login. Silakan login terlebih dahulu."
  );

  return;
}


      /*
        VALIDASI JUDUL
      */

      if (
        !form.title.trim()
      ) {

        alert(
          "Nama/judul dokumen wajib diisi."
        );

        return;
      }


      /*
        VALIDASI DOKUMEN
      */

      if (
        !file &&
        !form.documentLink
      ) {

        alert(
          "Upload dokumen atau masukkan link dokumen."
        );

        return;
      }


      /*
        MINIMAL 1 REVIEWER
      */

      if (
        !reviewerIds.length
      ) {

        alert(
          "Minimal pilih satu Reviewer."
        );

        return;
      }


      /*
        MINIMAL 1 APPROVER
      */

      if (
        !approverIds.length
      ) {

        alert(
          "Minimal pilih satu Approver."
        );

        return;
      }


      /*
        BUAT DATA REVIEWER
      */

      const reviewers =
        reviewerIds
          .map(
            id =>
              users.find(
                user =>
                  Number(user.id) ===
                  Number(id)
              )
          )
          .filter(Boolean)
          .map(
            user => ({

              ...user,

              role:
                "REVIEWER"

            })
          );


      /*
        BUAT DATA APPROVER
      */

      const approvers =
        approverIds
          .map(
            id =>
              users.find(
                user =>
                  Number(user.id) ===
                  Number(id)
              )
          )
          .filter(Boolean)
          .map(
            user => ({

              ...user,

              role:
                "APPROVER"

            })
          );


      /*
        URUTAN FINAL:

        REVIEWER 1
        REVIEWER 2
        REVIEWER 3
        ↓
        APPROVER 1
        APPROVER 2
        APPROVER 3

        dst.
      */

      onSubmit({

  ...form,

  applicantId:
    currentUser.id,

  applicantName:
    currentUser.name,

  file,

  approvalChain:
    [
      ...reviewers,
      ...approvers
    ]

});

    };


  /* =======================================================
     RENDER
  ======================================================= */

  return (

    <form
      onSubmit={
        submit
      }
      className="
        space-y-5
      "
    >

      {/* =================================================
          HEADER
      ================================================= */}

      <div>

        <button
          type="button"
          onClick={
            onCancel
          }
          className="
            mb-3
            text-sm
            font-semibold
            text-[#1261A0]
          "
        >
          ← Kembali
        </button>


        <h1
          className="
            text-2xl
            font-extrabold
          "
        >
          Buat Pengajuan
        </h1>


        <p
          className="
            mt-1
            text-sm
            text-slate-500
          "
        >
          Isi dokumen dan tentukan
          urutan Reviewer serta Approver.
        </p>

      </div>


     {/* =================================================
    APPLICANT
================================================= */}

<div
  className="
    card
    p-5
  "
>

  <h2
    className="
      font-bold
    "
  >
    Pemohon
  </h2>


  <div
    className="
      mt-4
    "
  >

    <label
      className="
        label
      "
    >
      Nama Pemohon
    </label>


    {/* =================================================
        NAMA PEMOHON OTOMATIS DARI USER YANG LOGIN
    ================================================= */}

    <div
      className="
        input
        flex
        items-center
        justify-between
        bg-slate-50
      "
    >

      <div>

        <div
          className="
            font-medium
            text-slate-800
          "
        >
          {
            currentUser?.name ||
            "User belum login"
          }
        </div>


        {currentUser && (

          <div
            className="
              mt-1
              text-xs
              text-slate-400
            "
          >

            {
              currentUser.position
            }

            {" · "}

            {
              currentUser.area
            }

          </div>

        )}

      </div>


      {/* Badge login */}

      {currentUser && (

        <span
          className="
            rounded-full
            bg-green-100
            px-3
            py-1
            text-xs
            font-medium
            text-green-700
          "
        >
          Logged in
        </span>

      )}

    </div>

  </div>


  {/* =================================================
      DETAIL USER
  ================================================= */}

  {currentUser && (

    <div
      className="
        mt-4
        grid
        gap-3
        rounded-xl
        bg-slate-50
        p-4
        text-sm
        sm:grid-cols-3
      "
    >

      {/* NIK */}

      <div>

        <div
          className="
            text-xs
            text-slate-400
          "
        >
          NIK
        </div>

        <b>
          {
            currentUser.nik ||
            "-"
          }
        </b>

      </div>


      {/* Department */}

      <div>

        <div
          className="
            text-xs
            text-slate-400
          "
        >
          Department
        </div>

        <b>
          {
            currentUser.department ||
            "-"
          }
        </b>

      </div>


      {/* Area */}

      <div>

        <div
          className="
            text-xs
            text-slate-400
          "
        >
          Area
        </div>

        <b>
          {
            currentUser.area ||
            "-"
          }
        </b>

      </div>

    </div>

  )}

</div>


      {/* =================================================
          DOCUMENT
      ================================================= */}

      <div
        className="
          card
          p-5
        "
      >

        <h2
          className="
            font-bold
          "
        >
          Informasi Dokumen
        </h2>


        <div
          className="
            mt-4
            grid
            gap-4
            md:grid-cols-2
          "
        >

          {/* JENIS DOKUMEN */}

          <div>

            <label
              className="
                label
              "
            >
              Jenis Dokumen
            </label>


            <select
              className="
                input
              "
              value={
                form.type
              }
              onChange={
                e =>
                  setForm(
                    current => ({

                      ...current,

                      type:
                        e.target.value

                    })
                  )
              }
            >

              <option>
                Transmittal
              </option>

              <option>
                Surat
              </option>

              <option>
                Memo
              </option>

            </select>

          </div>


          {/* TITLE */}

          <div>

            <label
              className="
                label
              "
            >
              Judul / Nama Dokumen
            </label>


            <input
              className="
                input
              "
              value={
                form.title
              }
              onChange={
                e =>
                  setForm(
                    current => ({

                      ...current,

                      title:
                        e.target.value

                    })
                  )
              }
            />

          </div>


          {/* DEPARTMENT */}

          <div>

            <label
              className="
                label
              "
            >
              Departemen
            </label>


            <input
              className="
                input
              "
              value={
                form.department
              }
              onChange={
                e =>
                  setForm(
                    current => ({

                      ...current,

                      department:
                        e.target.value

                    })
                  )
              }
            />

          </div>


          {/* AREA */}

          <div>

            <label
              className="
                label
              "
            >
              Area
            </label>


            <input
              className="
                input
              "
              value={
                form.area
              }
              onChange={
                e =>
                  setForm(
                    current => ({

                      ...current,

                      area:
                        e.target.value

                    })
                  )
              }
            />

          </div>


          {/* DESCRIPTION */}

          <div
            className="
              md:col-span-2
            "
          >

            <label
              className="
                label
              "
            >
              Keperluan / Deskripsi
            </label>


            <textarea
              className="
                input
                min-h-24
              "
              value={
                form.description
              }
              onChange={
                e =>
                  setForm(
                    current => ({

                      ...current,

                      description:
                        e.target.value

                    })
                  )
              }
            />

          </div>

        </div>

      </div>


      {/* =================================================
          DOCUMENT FILE
      ================================================= */}

      <div
        className="
          card
          p-5
        "
      >

        <h2
          className="
            font-bold
          "
        >
          Dokumen Attachment
        </h2>


        <div
          className="
            mt-4
            grid
            gap-4
            md:grid-cols-2
          "
        >

          {/* FILE */}

          <label
            className="
              flex
              cursor-pointer
              items-center
              gap-4
              rounded-xl
              border-2
              border-dashed
              border-slate-300
              p-5
            "
          >

            <Upload
              className="
                text-[#1261A0]
              "
            />


            <div>

              <b>
                {
                  file
                    ? file.name
                    : "Pilih file"
                }
              </b>

              <div
                className="
                  text-xs
                  text-slate-500
                "
              >
                PDF / DOC / DOCX
              </div>

            </div>


            <input
              type="file"
              accept="
                .pdf,
                .doc,
                .docx
              "
              className="
                hidden
              "
              onChange={
                e => {

                  const selected =
                    e.target.files?.[0] ||
                    null;

                  setFile(
                    selected
                  );


                  setForm(
                    current => ({

                      ...current,

                      fileName:
                        selected?.name ||
                        ""

                    })
                  );

                }
              }
            />

          </label>


          {/* LINK */}

          <div>

            <label
              className="
                label
              "
            >
              Atau Link Dokumen
            </label>


            <input
              className="
                input
              "
              placeholder="
                https://...
              "
              value={
                form.documentLink
              }
              onChange={
                e =>
                  setForm(
                    current => ({

                      ...current,

                      documentLink:
                        e.target.value

                    })
                  )
              }
            />

          </div>

        </div>

      </div>


      {/* =================================================
          REVIEWER
      ================================================= */}

      <div
        className="
          card
          p-5
        "
      >

        <div
          className="
            flex
            items-center
            justify-between
          "
        >

          <div>

            <h2
              className="
                font-bold
              "
            >
              Reviewer
            </h2>

            <p
              className="
                mt-1
                text-xs
                text-slate-500
              "
            >
              Pilih Reviewer dari database.
              Urutan mengikuti urutan pilihan.
            </p>

          </div>


          <Badge
            status="REVIEWER"
          />

        </div>


        {/* DROPDOWN */}

        <div
          className="
            mt-4
          "
        >

          <select
            className="
              input
            "
            value=""
            onChange={
              e =>
                addReviewer(
                  e.target.value
                )
            }
          >

            <option
              value=""
            >
              + Pilih Reviewer dari database
            </option>


            {reviewerUsers
              .filter(
                reviewer =>
                  !reviewerIds.includes(
                    Number(
                      reviewer.id
                    )
                  )
              )
              .map(
                reviewer => (

                  <option
                    key={
                      reviewer.id
                    }
                    value={
                      reviewer.id
                    }
                  >

                    {
                      reviewer.name
                    }

                    {" — "}

                    {
                      reviewer.position
                    }

                    {" · "}

                    {
                      reviewer.area
                    }

                  </option>

                )
              )}

          </select>

        </div>


        {/* SELECTED REVIEWERS */}

        <div
          className="
            mt-4
            space-y-2
          "
        >

          {reviewerIds.map(
            (
              id,
              index
            ) => {

              const reviewer =
                users.find(
                  user =>
                    Number(
                      user.id
                    ) ===
                    Number(id)
                );


              if (!reviewer)
                return null;


              return (

                <div
                  key={
                    reviewer.id
                  }
                  className="
                    flex
                    items-center
                    gap-3
                    rounded-xl
                    border
                    border-violet-200
                    bg-violet-50
                    p-3
                  "
                >

                  <div
                    className="
                      grid
                      h-8
                      w-8
                      shrink-0
                      place-items-center
                      rounded-full
                      bg-violet-600
                      text-sm
                      font-bold
                      text-white
                    "
                  >
                    {index + 1}
                  </div>


                  <div
                    className="
                      flex-1
                    "
                  >

                    <div
                      className="
                        font-semibold
                      "
                    >
                      {
                        reviewer.name
                      }
                    </div>

                    <div
                      className="
                        text-xs
                        text-slate-500
                      "
                    >
                      Reviewer
                      {" · "}
                      {
                        reviewer.position
                      }
                      {" · "}
                      {
                        reviewer.area
                      }
                    </div>

                  </div>


                  <button
                    type="button"
                    onClick={() =>
                      removeReviewer(
                        reviewer.id
                      )
                    }
                    className="
                      text-xs
                      font-semibold
                      text-red-600
                      hover:text-red-700
                    "
                  >
                    Hapus
                  </button>

                </div>

              );

            }
          )}

        </div>

      </div>


      {/* =================================================
          APPROVER
      ================================================= */}

      <div
        className="
          card
          p-5
        "
      >

        <div
          className="
            flex
            items-center
            justify-between
          "
        >

          <div>

            <h2
              className="
                font-bold
              "
            >
              Approver
            </h2>

            <p
              className="
                mt-1
                text-xs
                text-slate-500
              "
            >
              Approver dimulai setelah seluruh
              Reviewer selesai.
              Urutan mengikuti urutan pilihan.
            </p>

          </div>


          <Badge
            status="APPROVER"
          />

        </div>


        {/* DROPDOWN */}

        <div
          className="
            mt-4
          "
        >

          <select
            className="
              input
            "
            value=""
            onChange={
              e =>
                addApprover(
                  e.target.value
                )
            }
          >

            <option
              value=""
            >
              + Pilih Approver dari database
            </option>


            {approverUsers
              .filter(
                approver =>
                  !approverIds.includes(
                    Number(
                      approver.id
                    )
                  )
              )
              .map(
                approver => (

                  <option
                    key={
                      approver.id
                    }
                    value={
                      approver.id
                    }
                  >

                    {
                      approver.name
                    }

                    {" — "}

                    {
                      approver.position
                    }

                    {" · "}

                    {
                      approver.area
                    }

                  </option>

                )
              )}

          </select>

        </div>


        {/* SELECTED APPROVERS */}

        <div
          className="
            mt-4
            space-y-2
          "
        >

          {approverIds.map(
            (
              id,
              index
            ) => {

              const approver =
                users.find(
                  user =>
                    Number(
                      user.id
                    ) ===
                    Number(id)
                );


              if (!approver)
                return null;


              return (

                <div
                  key={
                    approver.id
                  }
                  className="
                    flex
                    items-center
                    gap-3
                    rounded-xl
                    border
                    border-blue-200
                    bg-blue-50
                    p-3
                  "
                >

                  <div
                    className="
                      grid
                      h-8
                      w-8
                      shrink-0
                      place-items-center
                      rounded-full
                      bg-[#1261A0]
                      text-sm
                      font-bold
                      text-white
                    "
                  >
                    {
                      reviewerIds.length +
                      index +
                      1
                    }
                  </div>


                  <div
                    className="
                      flex-1
                    "
                  >

                    <div
                      className="
                        font-semibold
                      "
                    >
                      {
                        approver.name
                      }
                    </div>

                    <div
                      className="
                        text-xs
                        text-slate-500
                      "
                    >
                      Approver
                      {" · "}
                      {
                        approver.position
                      }
                      {" · "}
                      {
                        approver.area
                      }
                    </div>

                  </div>


                  <button
                    type="button"
                    onClick={() =>
                      removeApprover(
                        approver.id
                      )
                    }
                    className="
                      text-xs
                      font-semibold
                      text-red-600
                      hover:text-red-700
                    "
                  >
                    Hapus
                  </button>

                </div>

              );

            }
          )}

        </div>

      </div>


      {/* =================================================
          FINAL ORDER
      ================================================= */}

      {(reviewerIds.length ||
        approverIds.length) > 0 && (

        <div
          className="
            card
            border-blue-200
            bg-blue-50/40
            p-5
          "
        >

          <h2
            className="
              font-bold
              text-[#1261A0]
            "
          >
            Urutan Approval
          </h2>


          <p
            className="
              mt-1
              text-xs
              text-slate-500
            "
          >
            Reviewer selalu diproses terlebih dahulu,
            kemudian Approver.
          </p>


          <div
            className="
              mt-4
              space-y-2
            "
          >

            {[
              ...reviewerIds,
              ...approverIds
            ].map(
              (
                id,
                index
              ) => {

                const selected =
                  users.find(
                    user =>
                      Number(
                        user.id
                      ) ===
                      Number(id)
                  );


                const stage =
                  index <
                  reviewerIds.length
                    ? "REVIEWER"
                    : "APPROVER";


                return (

                  <div
                    key={
                      `${stage}-${id}`
                    }
                    className="
                      flex
                      items-center
                      gap-3
                      rounded-xl
                      bg-white
                      p-3
                    "
                  >

                    <span
                      className="
                        grid
                        h-8
                        w-8
                        place-items-center
                        rounded-full
                        bg-slate-100
                        text-xs
                        font-bold
                      "
                    >
                      {index + 1}
                    </span>


                    <div
                      className="
                        flex-1
                      "
                    >

                      <b>
                        {
                          selected?.name
                        }
                      </b>

                      <div
                        className="
                          text-xs
                          text-slate-500
                        "
                      >
                        {
                          stage
                        }

                        {" · "}

                        {
                          selected?.position
                        }

                        {" · "}

                        {
                          selected?.area
                        }

                      </div>

                    </div>


                    <Badge
                      status={
                        stage
                      }
                    />

                  </div>

                );

              }
            )}

          </div>

        </div>

      )}


      {/* =================================================
          ACTION BUTTON
      ================================================= */}

      <div
        className="
          flex
          justify-end
          gap-2
        "
      >

        <button
          type="button"
          className="
            btn-secondary
          "
          onClick={
            onCancel
          }
        >
          Batal
        </button>


        <button
          type="submit"
          className="
            btn-primary
          "
        >

          Submit Pengajuan

          <ChevronRight
            size={17}
          />

        </button>

      </div>

    </form>

  );

}


/* =========================================================
   DETAIL
========================================================= */

function Detail({
  user,
  doc,
  actionUser,
  actionStep,
  onBack,
  onRequestAction,
  onApprove,
  verify,
  onPreviewFinal
}) {

  const [
    signature,
    setSignature
  ] =
    useState("");


  const [
    comment,
    setComment
  ] =
    useState("");


  if (!doc) {

    return (

      <div
        className="
          p-5
          text-slate-500
        "
      >
        Dokumen tidak ditemukan.
      </div>

    );
  }


  /*
    ACTION MODE
  */

  if (
    actionUser &&
    actionStep
  ) {

    return (

      <ActionMode

        user={
          actionUser
        }

        doc={
          doc
        }

        step={
          actionStep
        }

        signature={
          signature
        }

        setSignature={
          setSignature
        }

        comment={
          comment
        }

        setComment={
          setComment
        }

        onBack={
          onBack
        }

        onApprove={
          onApprove
        }

      />

    );
  }


  const currentStep =
    getCurrentStep(
      doc
    );


  const completed =
    doc.steps.filter(
      step =>
        step.status ===
        "APPROVED"
    ).length;


  return (

    <>

      <button

        onClick={
          onBack
        }

        className="
          mb-4
          text-sm
          font-semibold
          text-[#1261A0]
        "
      >
        ← Kembali
      </button>


      <div
        className="
          mb-5
          flex
          flex-col
          justify-between
          gap-3
          md:flex-row
          md:items-end
        "
      >

        <div>

          <div
            className="
              text-xs
              font-bold
              uppercase
              text-slate-400
            "
          >
            {
              doc.submissionNo
            }
          </div>


          <h1
            className="
              mt-1
              text-2xl
              font-extrabold
            "
          >
            {
              doc.title
            }
          </h1>


          <p
            className="
              text-sm
              text-slate-500
            "
          >
            {
              doc.type
            }
            {" · "}
            {
              doc.department
            }
            {" · "}
            {
              doc.area
            }
          </p>

        </div>


        <Badge
          status={
            doc.status
          }
        />

      </div>


      <div
        className="
          grid
          gap-5
          xl:grid-cols-[1.25fr_.75fr]
        "
      >

        <div
          className="
            space-y-5
          "
        >

          <DocumentInfo
            doc={
              doc
            }
          />


          <ApprovalChain
            doc={
              doc
            }

            activeStep={
              currentStep
            }

          />

        </div>


        <div
          className="
            space-y-5
          "
        >

          {currentStep &&
            doc.status ===
              "IN_APPROVAL" && (

            <div
              className="
                card
                border-blue-200
                bg-blue-50/40
                p-5
              "
            >

              <div
                className="
                  text-xs
                  font-bold
                  uppercase
                  text-[#1261A0]
                "
              >
                Current Action
              </div>


              <h2
                className="
                  mt-1
                  font-bold
                  text-[#1261A0]
                "
              >
                {currentStep.role ===
                "REVIEWER"
                  ? "Dokumen membutuhkan review"
                  : "Dokumen membutuhkan approval"}
              </h2>


              <div
                className="
                  mt-3
                  rounded-xl
                  bg-white
                  p-3
                "
              >

                <b>
                  {
                    currentStep.approverName
                  }
                </b>

                <div
                  className="
                    text-xs
                    text-slate-500
                  "
                >
                  {
                    currentStep.role
                  }
                  {" · "}
                  {
                    currentStep.position
                  }
                  {" · "}
                  {
                    currentStep.area
                  }
                </div>

              </div>


              <button

                type="button"

                className="
                  btn-primary
                  mt-4
                  w-full
                "

                onClick={() =>
                  onRequestAction(
                    doc,
                    currentStep
                  )
                }
              >

                {currentStep.role ===
                "REVIEWER"
                  ? "Review Now"
                  : "Approve Now"}

                <ChevronRight
                  size={17}
                />

              </button>

            </div>

          )}


          {doc.status ===
            "REJECTED" && (

            <div
              className="
                card
                border-red-200
                bg-red-50
                p-5
              "
            >

              <div
                className="
                  flex
                  items-center
                  gap-2
                  font-bold
                  text-red-700
                "
              >
                <XCircle />

                Pengajuan Ditolak
              </div>


              <p
                className="
                  mt-2
                  text-sm
                  text-red-700
                "
              >
                Pemohon perlu melakukan
                revisi sebelum pengajuan
                diproses kembali.
              </p>

            </div>

          )}


          <div
            className="
              card
              p-5
            "
          >

            <h2
              className="
                font-bold
              "
            >
              Verification QR
            </h2>


            <p
              className="
                mt-1
                text-sm
                text-slate-500
              "
            >
              QR dapat dibuka publik untuk
              melihat progress approval.
            </p>


            <div
              className="
                mt-4
                rounded-xl
                bg-white
                p-4
                text-center
              "
            >

              <QRCodeSVG

                value={
                  doc.qr ||
                  verificationUrl(
                    doc.id
                  )
                }

                size={
                  190
                }

              />


              <div
                className="
                  mt-3
                  text-xs
                  text-slate-500
                "
              >
                {
                  completed
                }
                /
                {
                  doc.steps.length
                }
                approval selesai
              </div>


              <button

                type="button"

                className="
                  btn-secondary
                  mt-3
                "

                onClick={
                  verify
                }
              >

                <QrCode
                  size={16}
                />

                Buka Verification

              </button>

            </div>

          </div>


          {/* =================================================
              FINAL DOCUMENT
          ================================================= */}

          {doc.status === "APPROVED" && (

            <div
              className="
                card
                p-5
              "
            >

              <div>

                <div
                  className="
                    text-xs
                    font-bold
                    uppercase
                    text-emerald-600
                  "
                >
                  Approval Selesai
                </div>

                <h2
                  className="
                    mt-1
                    font-bold
                  "
                >
                  Dokumen Final
                </h2>

                <p
                  className="
                    mt-1
                    text-sm
                    text-slate-500
                  "
                >
                  Seluruh tahapan approval telah selesai.
                  Dokumen final hanya dapat dilihat oleh
                  pengguna yang memiliki hak akses.
                </p>

              </div>


              {/* BELUM LOGIN */}

              {!user && (

                <div
                  className="
                    mt-4
                    rounded-xl
                    border
                    border-slate-200
                    bg-slate-50
                    p-4
                  "
                >

                  <div
                    className="
                      font-semibold
                      text-slate-800
                    "
                  >
                    Dokumen final bersifat privat
                  </div>

                  <p
                    className="
                      mt-1
                      text-sm
                      text-slate-500
                    "
                  >
                    Silakan login sebagai pemohon, reviewer,
                    atau approver yang terkait untuk melihat
                    dokumen final.
                  </p>

                </div>

              )}


              {/* SUDAH LOGIN DAN MEMILIKI AKSES */}

              {user &&
                canAccessFinalDocument(
                  doc,
                  user
                ) && (

                <div
                  className="
                    mt-4
                  "
                >

                  <button
                    type="button"
                    className="
                      btn-primary
                      w-full
                    "
                    onClick={
                      onPreviewFinal
                    }
                  >

                    <FileText
                      size={17}
                    />

                    Lihat Dokumen Final

                    <ChevronRight
                      size={17}
                    />

                  </button>

                </div>

              )}


              {/* SUDAH LOGIN TAPI TIDAK MEMILIKI AKSES */}

              {user &&
                !canAccessFinalDocument(
                  doc,
                  user
                ) && (

                <div
                  className="
                    mt-4
                    rounded-xl
                    border
                    border-red-200
                    bg-red-50
                    p-4
                  "
                >

                  <div
                    className="
                      font-semibold
                      text-red-700
                    "
                  >
                    Access Denied
                  </div>

                  <p
                    className="
                      mt-1
                      text-sm
                      text-red-600
                    "
                  >
                    Akun Anda tidak memiliki hak akses
                    untuk melihat dokumen final ini.
                  </p>

                </div>

              )}

            </div>

          )}

        </div>

      </div>

    </>
  );
}


/* =========================================================
   DOCUMENT INFO
========================================================= */

function DocumentInfo({
  doc
}) {

  return (

    <div
      className="
        card
        p-5
      "
    >

      <h2
        className="
          font-bold
        "
      >
        Informasi Dokumen
      </h2>


      <div
        className="
          mt-4
          grid
          gap-4
          text-sm
          sm:grid-cols-2
        "
      >

        <div>

          <small
            className="
              text-slate-400
            "
          >
            Pemohon
          </small>

          <div
            className="
              font-semibold
            "
          >
            {
              doc.applicantName
            }
          </div>

        </div>


        <div>

          <small
            className="
              text-slate-400
            "
          >
            Departemen
          </small>

          <div
            className="
              font-semibold
            "
          >
            {
              doc.department
            }
          </div>

        </div>


        <div>

          <small
            className="
              text-slate-400
            "
          >
            Area
          </small>

          <div
            className="
              font-semibold
            "
          >
            {
              doc.area
            }
          </div>

        </div>


        <div>

          <small
            className="
              text-slate-400
            "
          >
            Tanggal
          </small>

          <div
            className="
              font-semibold
            "
          >
            {
              fmt(
                doc.createdAt
              )
            }
          </div>

        </div>


        <div
          className="
            sm:col-span-2
          "
        >

          <small
            className="
              text-slate-400
            "
          >
            Keperluan
          </small>

          <div>
            {
              doc.description ||
              "-"
            }
          </div>

        </div>

      </div>


      <div
        className="
          mt-4
          rounded-xl
          bg-slate-50
          p-3
          text-sm
        "
      >

        <FileText
          size={16}
          className="
            mr-2
            inline
          "
        />

        {
          doc.fileName ||
          doc.documentLink ||
          "-"
        }

      </div>

    </div>
  );
}


/* =========================================================
   APPROVAL CHAIN
========================================================= */

function ApprovalChain({
  doc,
  activeStep
}) {

  return (

    <div
      className="
        card
        p-5
      "
    >

      <div
        className="
          flex
          items-center
          justify-between
        "
      >

        <h2
          className="
            font-bold
          "
        >
          Approval Chain
        </h2>


        <span
          className="
            text-sm
            font-semibold
            text-slate-500
          "
        >

          {
            doc.steps.filter(
              step =>
                step.status ===
                "APPROVED"
            ).length
          }
          /
          {
            doc.steps.length
          }

        </span>

      </div>


      <div
        className="
          mt-5
          space-y-4
        "
      >

        {doc.steps.map(
          (
            step,
            index
          ) => (

            <div
              key={
                step.id
              }
              className="
                relative
                flex
                gap-4
              "
            >

              {index <
                doc.steps.length -
                  1 && (

                <div
                  className="
                    absolute
                    left-4
                    top-9
                    h-full
                    w-px
                    bg-slate-200
                  "
                />

              )}


              <div
                className={`
                  z-10
                  grid
                  h-8
                  w-8
                  shrink-0
                  place-items-center
                  rounded-full
                  ${
                    step.status ===
                    "APPROVED"
                      ? "bg-emerald-100 text-emerald-700"
                      : step.status ===
                        "REJECTED"
                      ? "bg-red-100 text-red-700"
                      : activeStep?.id ===
                        step.id
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-500"
                  }
                `}
              >

                {step.status ===
                "APPROVED" ? (

                  <Check
                    size={16}
                  />

                ) : (

                  step.order

                )}

              </div>


              <div
                className="
                  flex-1
                  rounded-xl
                  border
                  p-3
                "
              >

                <div
                  className="
                    flex
                    items-start
                    justify-between
                    gap-3
                  "
                >

                  <div>

                    <b>
                      {
                        step.approverName
                      }
                    </b>


                    <div
                      className="
                        text-xs
                        text-slate-500
                      "
                    >
                      {
                        step.role
                      }
                      {" · "}
                      {
                        step.position
                      }
                      {" · "}
                      {
                        step.area
                      }
                    </div>

                  </div>


                  <Badge
                    status={
                      step.status
                    }
                  />

                </div>


                {step.signedAt && (

                  <div
                    className="
                      mt-2
                      text-xs
                      text-slate-400
                    "
                  >
                    {
                      fmt(
                        step.signedAt
                      )
                    }
                  </div>

                )}


                {step.comment && (

                  <div
                    className="
                      mt-2
                      rounded-lg
                      bg-slate-50
                      p-2
                      text-sm
                    "
                  >

                    <b>
                      Catatan:
                    </b>{" "}

                    {
                      step.comment
                    }

                  </div>

                )}


                {step.status ===
                  "APPROVED" && (

                  <div
                    className="
                      mt-4
                      rounded-xl
                      border
                      border-slate-200
                      bg-white
                      p-3
                    "
                  >

                    <div
                      className="
                        mb-2
                        text-xs
                        font-bold
                        uppercase
                        tracking-wide
                        text-slate-400
                      "
                    >
                      Tanda Tangan
                    </div>


                    {step.signature &&
                    step.signature.startsWith(
                      "data:image/"
                    ) ? (

                      <div
                        className="
                          flex
                          min-h-[90px]
                          items-center
                          justify-center
                          rounded-lg
                          bg-slate-50
                        "
                      >

                        <img

                          src={
                            step.signature
                          }

                          alt={
                            `Tanda tangan ${step.approverName}`
                          }

                          className="
                            max-h-20
                            max-w-[220px]
                            object-contain
                          "

                        />

                      </div>

                    ) : (

                      <div
                        className="
                          flex
                          min-h-[90px]
                          items-center
                          justify-center
                          rounded-lg
                          bg-slate-50
                        "
                      >

                        <div
                          className="
                            text-center
                          "
                        >

                          <div
                            className="
                              text-sm
                              font-semibold
                              text-emerald-700
                            "
                          >
                            ✓ Approved
                          </div>

                          <div
                            className="
                              mt-1
                              text-xs
                              text-slate-400
                            "
                          >
                            Signature belum
                            tersedia pada
                            data approval lama.
                          </div>

                        </div>

                      </div>

                    )}

                  </div>

                )}

              </div>

            </div>

          )
        )}

      </div>

    </div>
  );
}


/* =========================================================
   ACTION MODE
========================================================= */

function ActionMode({
  user,
  doc,
  step,
  signature,
  setSignature,
  comment,
  setComment,
  onBack,
  onApprove
}) {

  return (

    <div
      className="
        min-h-screen
        bg-slate-50
        p-5
        md:p-10
      "
    >

      <div
        className="
          mx-auto
          max-w-3xl
        "
      >

        <button

          onClick={
            onBack
          }

          className="
            mb-5
            text-sm
            font-semibold
            text-[#1261A0]
          "
        >
          ← Kembali ke Detail
        </button>


        <div
          className="
            mb-5
          "
        >

          <div
            className="
              text-xs
              font-bold
              uppercase
              text-slate-400
            "
          >
            {
              doc.submissionNo
            }
          </div>


          <h1
            className="
              mt-1
              text-2xl
              font-extrabold
            "
          >
            {
              step.role ===
              "REVIEWER"
                ? "Review Dokumen"
                : "Approval Dokumen"
            }
          </h1>


          <p
            className="
              mt-1
              text-sm
              text-slate-500
            "
          >
            {
              doc.title
            }
          </p>

        </div>


        <div
          className="
            card
            p-6
          "
        >

          <div
            className="
              rounded-xl
              bg-blue-50
              p-4
            "
          >

            <div
              className="
                text-xs
                font-bold
                uppercase
                text-[#1261A0]
              "
            >
              Logged in as
            </div>


            <div
              className="
                mt-1
                font-bold
              "
            >
              {
                user.name
              }
            </div>


            <div
              className="
                text-xs
                text-slate-500
              "
            >
              {
                user.role
              }
              {" · "}
              {
                user.position
              }
              {" · "}
              {
                user.area
              }
            </div>

          </div>


          <div
            className="
              mt-6
            "
          >

            <h2
              className="
                font-bold
              "
            >
              Dokumen
            </h2>


            <div
              className="
                mt-3
                rounded-xl
                bg-slate-50
                p-4
                text-sm
              "
            >

              <FileText
                size={16}
                className="
                  mr-2
                  inline
                "
              />

              {
                doc.fileName ||
                doc.documentLink ||
                "-"
              }

            </div>

          </div>


          <div
            className="
              mt-6
            "
          >

            <label
              className="
                label
              "
            >
              Tanda Tangan
            </label>


            <SignaturePad

              value={
                signature
              }

              onChange={
                setSignature
              }

            />

          </div>


          <div
            className="
              mt-5
            "
          >

            <label
              className="
                label
              "
            >
              Catatan
            </label>


            <textarea

              className="
                input
                min-h-24
              "

              value={
                comment
              }

              onChange={e =>
                setComment(
                  e.target.value
                )
              }

              placeholder="
                Tambahkan catatan...
              "

            />

          </div>


          <div
            className="
              mt-5
              grid
              grid-cols-2
              gap-3
            "
          >

            <button

              type="button"

              className="
                btn-danger
              "

              onClick={() => {

                if (
                  !comment.trim()
                ) {

                  alert(
                    "Catatan wajib diisi untuk Reject."
                  );

                  return;
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

              type="button"

              className="
                btn-primary
              "

              onClick={() => {

                if (
                  !signature
                ) {

                  alert(
                    "Tanda tangan wajib diisi."
                  );

                  return;
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

              {step.role ===
              "REVIEWER"
                ? "Approve Review"
                : "Approve"}

              <Check
                size={16}
              />

            </button>

          </div>

        </div>

      </div>

    </div>
  );
}


/* =========================================================
   AUTH MODAL
========================================================= */

/* =========================================================
   AUTH MODAL
========================================================= */

function AuthModal({
  users,
  request,
  onClose,
  onContinue
}) {

  const [selectedUserId, setSelectedUserId] =
    useState("");

  /*
   * FILTER USER SESUAI KEBUTUHAN
   *
   * LOGIN   -> Semua user
   * CREATE  -> Applicant
   * REVIEW  -> Reviewer
   * APPROVE -> Approver
   */

/* =========================================================
   AVAILABLE USERS
========================================================= */

const availableUsers =
  users.filter(user => {

    /*
     * LOGIN BIASA
     * Semua user boleh muncul
     *
     * Applicant
     * Reviewer
     * Approver
     * Viewer
     */

    if (
      request?.action === "LOGIN"
    ) {

      return true;

    }


    /*
     * CREATE REQUEST
     * Hanya user yang boleh
     * membuat pengajuan.
     */

    if (
      request?.action === "CREATE"
    ) {

      return (
        user.role === "APPLICANT"
      );

    }


    /*
     * REVIEW
     * Hanya Reviewer.
     */

    if (
      request?.action === "REVIEW"
    ) {

      return (
        user.role === "REVIEWER"
      );

    }


    /*
     * APPROVE
     * Hanya Approver.
     */

    if (
      request?.action === "APPROVE"
    ) {

      return (
        user.role === "APPROVER"
      );

    }


    return false;

  });


  const handleContinue = () => {

    if (!selectedUserId) {
      alert(
        "Silakan pilih nama terlebih dahulu."
      );

      return;
    }

    onContinue(
      Number(selectedUserId)
    );
  };


  const getTitle = () => {

    if (request?.action === "CREATE") {
      return "Login untuk Membuat Pengajuan";
    }

    if (request?.action === "REVIEW") {
      return "Login untuk Review";
    }

    if (request?.action === "APPROVE") {
      return "Login untuk Approval";
    }

    return "Login";
  };


  const getDescription = () => {

    if (request?.action === "CREATE") {
      return "Pilih user yang akan membuat pengajuan.";
    }

    if (request?.action === "REVIEW") {
      return "Pilih reviewer yang ditugaskan pada dokumen.";
    }

    if (request?.action === "APPROVE") {
      return "Pilih approver yang ditugaskan pada dokumen.";
    }

    return "Pilih user untuk melanjutkan.";
  };


  return (

    <div
      className="
        fixed
        inset-0
        z-50
        grid
        place-items-center
        bg-slate-900/40
        p-4
      "
    >

      <div
        className="
          w-full
          max-w-md
          rounded-2xl
          bg-white
          p-6
          shadow-xl
        "
      >

        {/* HEADER */}

        <div className="mb-5">

          <h2
            className="
              text-xl
              font-extrabold
              text-slate-900
            "
          >
            {getTitle()}
          </h2>

          <p
            className="
              mt-1
              text-sm
              text-slate-500
            "
          >
            {getDescription()}
          </p>

        </div>


        {/* USER SELECT */}

        <div>

          <label
            className="
              label
            "
          >
            Nama Pengguna
          </label>


          <select
            className="
              input
              mt-1
            "
            value={
              selectedUserId
            }
            onChange={
              e =>
                setSelectedUserId(
                  e.target.value
                )
            }
          >

            <option value="">
              Pilih nama pengguna...
            </option>


            {availableUsers.map(
              user => (

                <option
                  key={
                    user.id
                  }
                  value={
                    user.id
                  }
                >

                  {user.name}

                  {" — "}

                  {user.position}

                  {" · "}

                  {user.area}

                </option>

              )
            )}

          </select>

        </div>


        {/* INFO USER */}

        {selectedUserId && (

          <div
            className="
              mt-4
              rounded-xl
              bg-slate-50
              p-4
              text-sm
            "
          >

            {(() => {

              const selectedUser =
                users.find(
                  user =>
                    Number(user.id) ===
                    Number(selectedUserId)
                );

              if (!selectedUser) {
                return null;
              }

              return (

                <>

                  <div
                    className="
                      font-bold
                      text-slate-800
                    "
                  >
                    {selectedUser.name}
                  </div>

                  <div
                    className="
                      mt-1
                      text-xs
                      text-slate-500
                    "
                  >
                    NIK:{" "}
                    {selectedUser.nik}
                  </div>

                  <div
                    className="
                      text-xs
                      text-slate-500
                    "
                  >
                    {selectedUser.position}
                    {" · "}
                    {selectedUser.department}
                    {" · "}
                    {selectedUser.area}
                  </div>

                </>

              );

            })()}

          </div>

        )}


        {/* BUTTON */}

        <div
          className="
            mt-6
            flex
            justify-end
            gap-2
          "
        >

          <button
            type="button"
            onClick={
              onClose
            }
            className="
              btn-secondary
            "
          >
            Batal
          </button>


          <button
            type="button"
            onClick={
              handleContinue
            }
            className="
              btn-primary
            "
          >
            Lanjutkan
          </button>

        </div>

      </div>

    </div>

  );
}


/* =========================================================
   APPROVALS
========================================================= */

function Approvals({
  user,
  docs,
  open
}) {

  if (!user) {

    return (

      <div
        className="
          card
          p-8
          text-center
        "
      >

        <ShieldCheck
          className="
            mx-auto
            text-[#1261A0]
          "
          size={40}
        />

        <h2
          className="
            mt-4
            font-bold
          "
        >
          Approval Saya
        </h2>

        <p
          className="
            mt-2
            text-sm
            text-slate-500
          "
        >
          Login dilakukan ketika menekan
          Review Now atau Approve Now.
        </p>

      </div>

    );
  }


  const rows =
    docs.filter(
      doc =>
        doc.steps.some(
          step =>
            Number(
              step.approverId
            ) ===
            Number(
              user.id
            )
        )
    );


  return (

    <>

      <div
        className="
          mb-6
        "
      >

        <h1
          className="
            text-2xl
            font-extrabold
          "
        >
          Approval Saya
        </h1>

        <p
          className="
            mt-1
            text-sm
            text-slate-500
          "
        >
          Dokumen yang ditugaskan
          kepada {
            user.name
          }.
        </p>

      </div>


      <div
        className="
          card
          p-4
        "
      >

        <DocumentTable

          rows={
            rows
          }

          open={
            open
          }

        />

      </div>

    </>
  );
}


/* =========================================================
   NOTIFICATIONS
========================================================= */

function Notifications({
  user,
  docs,
  open
}) {

  if (!user) {

    return (

      <div
        className="
          card
          p-8
          text-center
        "
      >

        <Bell
          className="
            mx-auto
            text-[#1261A0]
          "
          size={40}
        />

        <h2
          className="
            mt-4
            font-bold
          "
        >
          Notifikasi
        </h2>

        <p
          className="
            mt-2
            text-sm
            text-slate-500
          "
        >
          Notifikasi approval akan
          muncul setelah user login.
        </p>

      </div>

    );
  }


  const notifications =
    docs.flatMap(
      doc =>
        doc.steps
          .filter(
            step =>
              Number(
                step.approverId
              ) ===
                Number(
                  user.id
                ) &&
              step.status ===
                "WAITING" &&
              isStepActive(
                doc,
                step.id
              )
          )
          .map(
            step => ({
              doc,
              step
            })
          )
    );


  return (

    <>

      <div
        className="
          mb-6
        "
      >

        <h1
          className="
            text-2xl
            font-extrabold
          "
        >
          Notifikasi
        </h1>

      </div>


      <div
        className="
          space-y-3
        "
      >

        {notifications.map(
          item => (

            <button

              key={
                item.step.id
              }

              onClick={() =>
                open(
                  item.doc.id
                )
              }

              className="
                card
                flex
                w-full
                gap-3
                p-4
                text-left
                hover:bg-slate-50
              "
            >

              <Bell
                className="
                  text-[#1261A0]
                "
              />


              <div>

                <b>
                  Approval diperlukan
                </b>

                <p
                  className="
                    text-sm
                    text-slate-600
                  "
                >
                  {
                    item.doc.title
                  }
                  {" — "}
                  menunggu{" "}
                  {
                    item.step.role
                  }
                  {" "}
                  dari kamu.
                </p>

              </div>

            </button>

          )
        )}


        {!notifications.length && (

          <div
            className="
              card
              p-8
              text-center
              text-sm
              text-slate-500
            "
          >
            Tidak ada approval
            yang menunggu.
          </div>

        )}

      </div>

    </>
  );
}


/* =========================================================
   VERIFICATION PAGE
========================================================= */

function VerificationPage({
  doc,
  onBack,
  openDocument
}) {

  if (!doc) {

    return (

      <div
        className="
          grid
          min-h-screen
          place-items-center
        "
      >
        Dokumen tidak ditemukan.
      </div>

    );
  }


  const approved =
    doc.steps.filter(
      step =>
        step.status ===
        "APPROVED"
    ).length;


  return (

    <div
      className="
        min-h-screen
        bg-slate-50
        p-5
        md:p-10
      "
    >

      <div
        className="
          mx-auto
          max-w-3xl
        "
      >

        <div
          className="
            mb-6
            text-center
          "
        >

          <div
            className="
              mx-auto
              grid
              h-14
              w-14
              place-items-center
              rounded-2xl
              bg-emerald-600
              text-white
            "
          >
            <ShieldCheck />
          </div>


          <h1
            className="
              mt-4
              text-2xl
              font-extrabold
            "
          >
            Document Verification
          </h1>


          <p
            className="
              text-sm
              text-slate-500
            "
          >
            Public approval status
          </p>

        </div>


        <div
          className="
            card
            p-5
            md:p-7
          "
        >

          <div
            className="
              flex
              flex-col
              justify-between
              gap-3
              sm:flex-row
            "
          >

            <div>

              <div
                className="
                  text-xs
                  font-bold
                  uppercase
                  text-slate-400
                "
              >
                {
                  doc.submissionNo
                }
              </div>


              <h2
                className="
                  mt-1
                  text-xl
                  font-bold
                "
              >
                {
                  doc.title
                }
              </h2>

            </div>


            <Badge
              status={
                doc.status
              }
            />

          </div>


          <div
            className="
              mt-6
              grid
              gap-4
              text-sm
              sm:grid-cols-2
            "
          >

            <div>

              <small
                className="
                  text-slate-400
                "
              >
                Pemohon
              </small>

              <div
                className="
                  font-semibold
                "
              >
                {
                  doc.applicantName
                }
              </div>

            </div>


            <div>

              <small
                className="
                  text-slate-400
                "
              >
                Departemen
              </small>

              <div
                className="
                  font-semibold
                "
              >
                {
                  doc.department
                }
              </div>

            </div>


            <div>

              <small
                className="
                  text-slate-400
                "
              >
                Area
              </small>

              <div
                className="
                  font-semibold
                "
              >
                {
                  doc.area
                }
              </div>

            </div>


            <div>

              <small
                className="
                  text-slate-400
                "
              >
                Tanggal
              </small>

              <div
                className="
                  font-semibold
                "
              >
                {
                  fmt(
                    doc.createdAt
                  )
                }
              </div>

            </div>


            <div
              className="
                sm:col-span-2
              "
            >

              <small
                className="
                  text-slate-400
                "
              >
                Link Dokumen
              </small>


              {doc.documentLink &&
              doc.documentLink !==
                "#" ? (

                <a
                  href={
                    doc.documentLink
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="
                    block
                    truncate
                    font-semibold
                    text-[#1261A0]
                  "
                >
                  {
                    doc.documentLink
                  }
                </a>

              ) : (

                <div
                  className="
                    font-semibold
                  "
                >
                  {
                    doc.fileName ||
                    "-"
                  }
                </div>

              )}

            </div>

          </div>


          <div
            className="
              mt-6
              rounded-xl
              bg-slate-50
              p-4
            "
          >

            <div
              className="
                flex
                justify-between
                text-sm
              "
            >

              <b>
                Approval Progress
              </b>

              <b>
                {
                  approved
                }
                /
                {
                  doc.steps.length
                }
              </b>

            </div>


            <div
              className="
                mt-3
                h-2
                overflow-hidden
                rounded-full
                bg-slate-200
              "
            >

              <div
                className="
                  h-full
                  rounded-full
                  bg-[#1261A0]
                "
                style={{
                  width:
                    `${
                      doc.steps.length
                        ? (
                            approved /
                            doc.steps.length
                          ) *
                          100
                        : 0
                    }%`
                }}
              />

            </div>

          </div>


          <div
            className="
              mt-6
            "
          >

            <h3
              className="
                font-bold
              "
            >
              Reviewer & Approver
            </h3>


            <div
              className="
                mt-3
                space-y-3
              "
            >

              {doc.steps.map(
                step => (

                  <div
                    key={
                      step.id
                    }
                    className="
                      flex
                      items-center
                      gap-3
                      rounded-xl
                      border
                      p-3
                    "
                  >

                    <div
                      className={`
                        grid
                        h-9
                        w-9
                        place-items-center
                        rounded-full
                        ${
                          step.status ===
                          "APPROVED"
                            ? "bg-emerald-50 text-emerald-600"
                            : step.status ===
                              "REJECTED"
                            ? "bg-red-50 text-red-600"
                            : "bg-slate-100 text-slate-500"
                        }
                      `}
                    >

                      {step.status ===
                      "APPROVED" ? (

                        <Check
                          size={17}
                        />

                      ) : (

                        step.order

                      )}

                    </div>


                    <div
                      className="
                        flex-1
                      "
                    >

                      <div
                        className="
                          flex
                          flex-wrap
                          items-center
                          gap-2
                        "
                      >

                        <b>
                          {
                            step.approverName
                          }
                        </b>

                        <Badge
                          status={
                            step.role
                          }
                        />

                      </div>


                      <div
                        className="
                          text-xs
                          text-slate-500
                        "
                      >
                        {
                          step.position
                        }
                        {" · "}
                        {
                          step.area
                        }
                      </div>

                    </div>


                    <div
                      className="
                        text-right
                        text-xs
                        text-slate-400
                      "
                    >

                      {
                        step.status ===
                        "APPROVED"
                          ? fmt(
                              step.signedAt
                            )
                          : step.status
                      }

                    </div>

                  </div>

                )
              )}

            </div>

          </div>


          <div
            className="
              mt-6
              grid
              gap-2
              sm:grid-cols-2
            "
          >

            <button

              onClick={() =>
                openDocument(
                  doc.id
                )
              }

              className="
                btn-secondary
              "
            >
              Lihat Detail
            </button>


            <button

              onClick={
                onBack
              }

              className="
                btn-secondary
              "
            >
              Kembali
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}


/* =========================================================
   FINAL DOCUMENT PREVIEW
========================================================= */

function FinalDocumentPreview({
  doc,
  onBack
}) {

  return (

    <div
      className="
        min-h-screen
        bg-slate-100
        p-4
        md:p-8
      "
    >

      <div
        className="
          mx-auto
          max-w-5xl
        "
      >

        <div
          className="
            mb-5
            flex
            items-center
            justify-between
          "
        >

          <div>

            <button
              onClick={
                onBack
              }
              className="
                mb-2
                text-sm
                font-semibold
                text-[#1261A0]
              "
            >
              ← Kembali
            </button>


            <h1
              className="
                text-2xl
                font-extrabold
              "
            >
              Dokumen Final
            </h1>

          </div>


          <Badge
            status={
              doc.status
            }
          />

        </div>


        <div
          className="
            overflow-auto
            rounded-2xl
            bg-slate-300
            p-4
            md:p-8
          "
        >

          <div
            className="
              mx-auto
              min-h-[1123px]
              w-full
              max-w-[794px]
              bg-white
              p-10
              shadow-xl
              md:p-16
            "
          >

            <div
              className="
                border-b-2
                border-slate-800
                pb-5
                text-center
              "
            >

              <div
                className="
                  text-sm
                  font-bold
                  uppercase
                  tracking-widest
                "
              >
                PERUSAHAAN /
                UNIT KERJA
              </div>


              <div
                className="
                  mt-1
                  text-xs
                  text-slate-500
                "
              >
                Dokumen Transmittal
              </div>

            </div>


            <div
              className="
                mt-10
                text-center
              "
            >

              <h2
                className="
                  text-xl
                  font-bold
                  uppercase
                "
              >
                {
                  doc.title
                }
              </h2>


              <p
                className="
                  mt-2
                  text-xs
                  text-slate-500
                "
              >
                {
                  doc.submissionNo
                }
              </p>

            </div>


            <div
              className="
                mt-10
                space-y-4
                text-sm
                leading-7
              "
            >

              <p>
                <b>
                  Pemohon:
                </b>{" "}
                {
                  doc.applicantName
                }
              </p>


              <p>
                <b>
                  Departemen:
                </b>{" "}
                {
                  doc.department
                }
              </p>


              <p>
                <b>
                  Tanggal:
                </b>{" "}
                {
                  fmt(
                    doc.createdAt
                  )
                }
              </p>


              <p>
                {
                  doc.description ||
                  "-"
                }
              </p>

            </div>


            <div
              className="
                mt-[430px]
                border-t
                pt-6
              "
            >

              <div
                className="
                  mb-4
                  text-center
                  text-xs
                  font-semibold
                  text-slate-500
                "
              >
                APPROVAL SIGNATURES
              </div>


              <div
                className="
                  grid
                  grid-cols-1
                  gap-5
                  sm:grid-cols-3
                "
              >

                {doc.steps.map(
                  step => (

                    <div
                      key={
                        step.id
                      }
                      className="
                        text-center
                        text-xs
                      "
                    >

                      <div
                        className="
                          flex
                          h-20
                          items-end
                          justify-center
                        "
                      >

                        {step.signature &&
                        step.signature.startsWith(
                          "data:image/"
                        ) ? (

                          <img

                            src={
                              step.signature
                            }

                            alt={
                              `Tanda tangan ${step.approverName}`
                            }

                            className="
                              max-h-16
                              max-w-[150px]
                              object-contain
                            "

                          />

                        ) : (

                          <span
                            className="
                              text-xs
                              text-slate-400
                            "
                          >
                            Belum ditandatangani
                          </span>

                        )}

                      </div>


                      <div
                        className="
                          border-t
                          border-slate-700
                          pt-2
                        "
                      >

                        <b>
                          {
                            step.approverName
                          }
                        </b>


                        <div>
                          {
                            step.role
                          }
                          {" · "}
                          {
                            step.position
                          }
                        </div>


                        <div>
                          {
                            step.area
                          }
                        </div>


                        <div
                          className="
                            mt-1
                            text-slate-500
                          "
                        >
                          {
                            fmt(
                              step.signedAt
                            )
                          }
                        </div>

                      </div>

                    </div>

                  )
                )}

              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}


/* =========================================================
   ROOT
========================================================= */

createRoot(
  document.getElementById(
    "root"
  )
).render(
  <App />
);

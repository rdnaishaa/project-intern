import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  XCircle
} from "lucide-react";

import { Badge } from "./shared";

export default function DashboardPage({ docs, open }) {
  const cards = [
    ["Total Pengajuan", docs.length, ClipboardList],
    ["Menunggu Approval", docs.filter((d) => d.status === "IN_APPROVAL").length, Clock3],
    ["Approved", docs.filter((d) => d.status === "APPROVED").length, CheckCircle2],
    ["Rejected", docs.filter((d) => d.status === "REJECTED").length, XCircle]
  ];

  return (
    <>
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Dashboard public untuk melihat pengajuan dan progress approval.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, Icon]) => (
          <div key={label} className="card p-5">
            <div className="flex justify-between text-sm text-slate-500">
              {label}
              <Icon size={19} className="text-[#1261A0]" />
            </div>

            <div className="mt-4 text-3xl font-extrabold">{value}</div>
          </div>
        ))}
      </div>

      <div className="card mt-6 p-5">
        <h2 className="font-bold">Pengajuan Terbaru</h2>

        <div className="mt-4 space-y-2">
          {docs.map((doc) => (
            <button
              key={doc.id}
              onClick={() => open(doc.id)}
              className="flex w-full items-center justify-between rounded-xl border p-3 text-left hover:bg-slate-50"
            >
              <div>
                <b>{doc.title}</b>
                <div className="text-xs text-slate-500">
                  {doc.submissionNo} {" · "} {doc.applicantName} {" · "} {doc.department}
                </div>
              </div>

              <Badge status={doc.status} />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

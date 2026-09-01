export function fmt(date) {
  if (!date) return "-";

  return new Date(date).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function Badge({ status }) {
  const map = {
    APPROVED: ["bg-emerald-50 text-emerald-700", "Approved"],
    IN_APPROVAL: ["bg-amber-50 text-amber-700", "In Approval"],
    WAITING: ["bg-amber-50 text-amber-700", "Waiting"],
    REJECTED: ["bg-red-50 text-red-700", "Rejected"],
    REVIEWER: ["bg-violet-50 text-violet-700", "Reviewer"],
    APPROVER: ["bg-blue-50 text-blue-700", "Approver"],
    APPLICANT: ["bg-violet-50 text-violet-700", "Applicant"],
    VIEWER: ["bg-slate-100 text-slate-700", "Viewer"]
  };

  const [cls, label] = map[status] || ["bg-slate-100 text-slate-600", status];

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}

import { FileText, Search } from "lucide-react";

import { Badge } from "./shared";

function DocumentTable({ rows, open }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b text-xs uppercase text-slate-400">
          <tr>
            <th className="px-3 py-3">No.</th>
            <th className="px-3 py-3">Dokumen</th>
            <th className="px-3 py-3">Pemohon</th>
            <th className="px-3 py-3">Status</th>
            <th />
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-50">
              <td className="px-3 py-3 font-semibold">{row.submissionNo}</td>
              <td className="px-3 py-3">{row.title}</td>
              <td className="px-3 py-3">{row.applicantName}</td>
              <td className="px-3 py-3">
                <Badge status={row.status} />
              </td>
              <td className="px-3 py-3 text-right">
                <button className="btn-secondary px-3 py-1.5" onClick={() => open(row.id)}>
                  Detail
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!rows.length && (
        <div className="p-8 text-center text-sm text-slate-500">Tidak ada data.</div>
      )}
    </div>
  );
}

export default function RequestsPage({ docs, open, create }) {
  const [search, setSearch] = React.useState("");

  const filtered = docs.filter((doc) =>
    `${doc.title} ${doc.submissionNo} ${doc.applicantName}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <>
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-extrabold">Pengajuan</h1>
          <p className="mt-1 text-sm text-slate-500">Daftar dokumen transmittal.</p>
        </div>

        <button onClick={create} className="btn-primary">
          <FileText size={17} />
          Buat Pengajuan
        </button>
      </div>

      <div className="card p-4">
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            className="input pl-10"
            placeholder="Cari dokumen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <DocumentTable rows={filtered} open={open} />
      </div>
    </>
  );
}

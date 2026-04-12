import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Customer, Payment, Profile } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronDown, ChevronRight, Copy, Download, History } from "lucide-react"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { toast } from "sonner"

interface PaymentWithDetails extends Payment {
  customer_name: string
  box_number: string
  street: string
  town: string
  collector_name: string
}

function getTodayDate () {
  return new Date().toISOString().split("T")[0]
}

function formatTime (paid_at: string) {
  if (!paid_at) return "-"
  const date = new Date(paid_at)
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

export default function PaidReports () {
  const [payments, setPayments] = useState<PaymentWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState(getTodayDate())
  const [townFilter, setTownFilter] = useState("all")
  const [collectorFilter, setCollectorFilter] = useState("all")
  const [towns, setTowns] = useState<string[]>([])
  const [collectors, setCollectors] = useState<Profile[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const pdfRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchReportData()
  }, [dateFilter, townFilter, collectorFilter])

  async function fetchReportData () {
    setLoading(true)

    const { data: customers } = await supabase.from("customers").select("*")
    const { data: profiles } = await supabase.from("profiles").select("*")
    const { data: paymentsData } = await supabase
      .from("payments")
      .select("*")
      .eq("paid_date", dateFilter)
      .order("paid_at", { ascending: false })

    if (customers && paymentsData && profiles) {
      const uniqueTowns = [...new Set(customers.map((c: Customer) => c.town))]
      setTowns(uniqueTowns)
      setCollectors(profiles)

      const withDetails: PaymentWithDetails[] = paymentsData
        .map((p) => {
          const customer = customers.find((c: Customer) => c.id === p.customer_id)
          const profile = profiles.find((pr: Profile) => pr.id === p.recorded_by)
          return {
            ...p,
            customer_name: customer?.name ?? "Unknown",
            box_number: customer?.box_number ?? "-",
            street: customer?.street ?? "-",
            town: customer?.town ?? "-",
            collector_name: profile?.full_name ?? "Admin",
          }
        })
        .filter((p) => townFilter === "all" || p.town === townFilter)
        .filter((p) => collectorFilter === "all" || p.recorded_by === collectorFilter)

      setPayments(withDetails)

      // Fetch activity logs for this date
      const { data: logsData } = await supabase
        .from("payment_logs")
        .select("*")
        .gte("performed_at", `${dateFilter}T00:00:00`)
        .lte("performed_at", `${dateFilter}T23:59:59`)
        .order("performed_at", { ascending: false })

      if (logsData) {
        const enrichedLogs = logsData.map((log) => {
          const customer = customers.find((c: Customer) => c.id === log.customer_id)
          const profile = profiles.find((pr: Profile) => pr.id === log.performed_by)
          return {
            ...log,
            customer_name: customer?.name ?? "Unknown",
            box_number: customer?.box_number ?? "-",
            performer_name: profile?.full_name ?? "Admin",
          }
        })
        setLogs(enrichedLogs)
      }
    }

    setLoading(false)
  }


  async function handleDownloadPDF () {
    if (!pdfRef.current) return

    const canvas = await html2canvas(pdfRef.current, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    })

    const imgData = canvas.toDataURL("image/png")
    const pdf = new jsPDF("l", "mm", "a4")
    const pageWidth = pdf.internal.pageSize.getWidth()
    const imgHeight = (canvas.height * pageWidth) / canvas.width
    pdf.addImage(imgData, "PNG", 0, 0, pageWidth, imgHeight)
    pdf.save(`Report-${dateFilter}.pdf`)
  }

  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0)
  const cashTotal = payments.filter((p) => p.payment_mode === "cash").reduce((sum, p) => sum + p.amount, 0)
  const gpayTotal = payments.filter((p) => p.payment_mode === "gpay").reduce((sum, p) => sum + p.amount, 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-white text-xl md:text-2xl font-bold">Paid Reports</h1>
          <p className="text-slate-400 text-sm mt-1">Daily collection report</p>
        </div>
        <Button onClick={handleDownloadPDF} className="bg-blue-600 hover:bg-blue-700">
          <Download className="w-4 h-4 mr-1 md:mr-2" />
          <span className="hidden md:inline">Download PDF</span>
          <span className="md:hidden">PDF</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="bg-slate-800 border-slate-700 text-white w-36 md:w-40"
        />
        <Select value={townFilter} onValueChange={setTownFilter}>
          <SelectTrigger className="w-28 md:w-40 bg-slate-800 border-slate-700 text-white">
            <SelectValue placeholder="All Towns" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-white">All Towns</SelectItem>
            {towns.map((town) => (
              <SelectItem key={town} value={town} className="text-white">{town}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={collectorFilter} onValueChange={setCollectorFilter}>
          <SelectTrigger className="w-32 md:w-44 bg-slate-800 border-slate-700 text-white">
            <SelectValue placeholder="All Collectors" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-white">All Collectors</SelectItem>
            {collectors.map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-white">{c.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 md:p-4">
          <p className="text-slate-400 text-xs">Total Collected</p>
          <p className="text-white text-lg md:text-2xl font-bold mt-1">₹{totalCollected}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 md:p-4">
          <p className="text-slate-400 text-xs">Payments</p>
          <p className="text-blue-400 text-lg md:text-2xl font-bold mt-1">{payments.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 md:p-4">
          <p className="text-slate-400 text-xs">Cash</p>
          <p className="text-green-400 text-lg md:text-2xl font-bold mt-1">₹{cashTotal}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 md:p-4">
          <p className="text-slate-400 text-xs">GPay</p>
          <p className="text-purple-400 text-lg md:text-2xl font-bold mt-1">₹{gpayTotal}</p>
        </div>
      </div>

      {/* Mobile: Card View */}
      <div className="md:hidden space-y-2 mb-4">
        {loading ? (
          <p className="text-slate-400">Loading...</p>
        ) : payments.length === 0 ? (
          <p className="text-slate-400 text-center py-6">No payments found for this date.</p>
        ) : (
          payments.map((payment) => (
            <div key={payment.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-white font-medium text-sm">{payment.customer_name}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{payment.street}, {payment.town}</p>
                </div>
                <div className="text-right">
                  <p className="text-green-400 font-bold text-sm">₹{payment.amount}</p>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${payment.payment_mode === "gpay" ? "bg-blue-900 text-blue-300" : "bg-green-900 text-green-300"}`}>
                    {payment.payment_mode === "gpay" ? "GPay" : "Cash"}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 text-xs">Box:</span>
                  <span className="text-white text-xs font-medium">{payment.box_number}</span>
                  <button onClick={() => { navigator.clipboard.writeText(payment.box_number); toast.success(`Copied: ${payment.box_number}`) }} className="text-slate-500 hover:text-blue-400 transition-colors">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <span className="text-slate-400 text-xs">{payment.bill_number}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs">{formatTime(payment.paid_at)}</span>
                <span className="text-slate-400 text-xs">By: {payment.collector_name}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: Table View */}
      <div className="hidden md:block bg-white rounded-lg p-4 overflow-x-auto">
        <div className="text-center border-b pb-3 mb-4">
          <h2 className="text-black font-bold text-lg">R.K.R NET COM — Daily Collection Report</h2>
          <p className="text-gray-600 text-sm">Date: {dateFilter} | Generated: {new Date().toLocaleString()}</p>
          <div className="flex justify-center gap-6 mt-2 text-sm">
            <span className="text-gray-700">Total: <strong>₹{totalCollected}</strong></span>
            <span className="text-gray-700">Cash: <strong>₹{cashTotal}</strong></span>
            <span className="text-gray-700">GPay: <strong>₹{gpayTotal}</strong></span>
            <span className="text-gray-700">Count: <strong>{payments.length}</strong></span>
          </div>
        </div>
        {loading ? (
          <p className="text-gray-400 text-center py-6">Loading...</p>
        ) : payments.length === 0 ? (
          <p className="text-gray-400 text-center py-6">No payments found for this date.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                {["#", "Time", "Bill No", "Customer", "Box No", "Street & Town", "Month", "Amount", "Mode", "Collected By"].map((h) => (
                  <th key={h} className="text-left text-gray-600 px-3 py-2 border border-gray-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((payment, index) => (
                <tr key={payment.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="text-gray-600 px-3 py-2 border border-gray-200">{index + 1}</td>
                  <td className="text-gray-600 px-3 py-2 border border-gray-200">{formatTime(payment.paid_at)}</td>
                  <td className="text-gray-800 px-3 py-2 border border-gray-200 font-medium">{payment.bill_number}</td>
                  <td className="text-gray-800 px-3 py-2 border border-gray-200 font-medium">{payment.customer_name}</td>
                  <td className="text-gray-800 px-3 py-2 border border-gray-200">
                    <div className="flex items-center gap-1">
                      <span>{payment.box_number}</span>
                      <button onClick={() => { navigator.clipboard.writeText(payment.box_number); toast.success(`Copied: ${payment.box_number}`) }} className="text-gray-400 hover:text-blue-600" title="Copy">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="text-gray-600 px-3 py-2 border border-gray-200">{payment.street}, {payment.town}</td>
                  <td className="text-gray-600 px-3 py-2 border border-gray-200">{payment.month}</td>
                  <td className="text-gray-800 px-3 py-2 border border-gray-200 font-bold">₹{payment.amount}</td>
                  <td className="px-3 py-2 border border-gray-200">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${payment.payment_mode === "gpay" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                      {payment.payment_mode === "gpay" ? "GPay" : "Cash"}
                    </span>
                  </td>
                  <td className="text-gray-600 px-3 py-2 border border-gray-200">{payment.collector_name}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold">
                <td colSpan={7} className="text-right text-gray-700 px-3 py-2 border border-gray-200">Total</td>
                <td className="text-gray-800 px-3 py-2 border border-gray-200">₹{totalCollected}</td>
                <td colSpan={2} className="border border-gray-200"></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Activity Log */}
      <div className="mt-6">
        <Button
          onClick={() => setShowLogs(!showLogs)}
          className="flex items-center gap-2 text-slate-300 font-medium mb-3 hover:text-blue-400 transition-all duration-200"
        >
          {/* Toggle icon */}
          {showLogs ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}

          {/* Label with icon */}
          <div className="flex items-center gap-1">
            <History className="w-4 h-4 text-slate-400" />
            <span>Activity Log</span>
          </div>

          {/* Undo badge */}
          {logs.filter(l => l.action === "undo").length > 0 && (
            <span className="ml-1 bg-red-900/40 text-red-400 text-xs px-2 py-0.5 rounded-full border border-red-700">
              {logs.filter(l => l.action === "undo").length} undo
            </span>
          )}
        </Button>

        {showLogs && (
          <div className="space-y-2">
            {logs.length === 0 ? (
              <p className="text-slate-400 text-sm">No activity for this date.</p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={`flex items-center justify-between rounded-lg px-4 py-3 border ${log.action === "undo"
                    ? "bg-red-900/20 border-red-800"
                    : "bg-green-900/20 border-green-800"
                    }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${log.action === "undo"
                        ? "bg-red-600 text-white"
                        : "bg-green-600 text-white"
                        }`}>
                        {log.action === "undo" ? "UNDO" : "PAID"}
                      </span>
                      <span className="text-white font-medium text-sm">{log.customer_name}</span>
                    </div>
                    <p className="text-slate-400 text-xs mt-1">
                      Box: {log.box_number} · {log.bill_number ?? "-"} · By: {log.performer_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${log.action === "undo" ? "text-red-400" : "text-green-400"}`}>
                      {log.action === "undo" ? "-" : "+"}₹{log.amount}
                    </p>
                    <p className="text-slate-400 text-xs">{formatTime(log.performed_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Hidden PDF div — always off screen, used for PDF capture on both mobile and desktop */}
      <div
        ref={pdfRef}
        style={{ position: "absolute", left: "-9999px", top: 0, width: "1100px", background: "white", padding: "24px" }}
      >
        <div style={{ textAlign: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "12px", marginBottom: "16px" }}>
          <h2 style={{ fontWeight: "bold", fontSize: "18px", margin: 0 }}>R.K.R NET COM — Daily Collection Report</h2>
          <p style={{ color: "#6b7280", fontSize: "13px", margin: "4px 0" }}>Date: {dateFilter} | Generated: {new Date().toLocaleString()}</p>
          <div style={{ display: "flex", justifyContent: "center", gap: "24px", marginTop: "8px", fontSize: "13px" }}>
            <span>Total: <strong>₹{totalCollected}</strong></span>
            <span>Cash: <strong>₹{cashTotal}</strong></span>
            <span>GPay: <strong>₹{gpayTotal}</strong></span>
            <span>Count: <strong>{payments.length}</strong></span>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ background: "#f3f4f6" }}>
              {["#", "Time", "Bill No", "Customer", "Box No", "Street & Town", "Month", "Amount", "Mode", "Collected By"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 12px", border: "1px solid #e5e7eb", color: "#4b5563" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payments.map((payment, index) => (
              <tr key={payment.id} style={{ background: index % 2 === 0 ? "#ffffff" : "#f9fafb" }}>
                <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", color: "#6b7280" }}>{index + 1}</td>
                <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", color: "#6b7280" }}>{formatTime(payment.paid_at)}</td>
                <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", fontWeight: 600 }}>{payment.bill_number}</td>
                <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", fontWeight: 600 }}>{payment.customer_name}</td>
                <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{payment.box_number}</td>
                <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", color: "#6b7280" }}>{payment.street}, {payment.town}</td>
                <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", color: "#6b7280" }}>{payment.month}</td>
                <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", fontWeight: "bold" }}>₹{payment.amount}</td>
                <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>
                  <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, background: payment.payment_mode === "gpay" ? "#dbeafe" : "#dcfce7", color: payment.payment_mode === "gpay" ? "#1d4ed8" : "#15803d" }}>
                    {payment.payment_mode === "gpay" ? "GPay" : "Cash"}
                  </span>
                </td>
                <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", color: "#6b7280" }}>{payment.collector_name}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#f3f4f6", fontWeight: "bold" }}>
              <td colSpan={7} style={{ textAlign: "right", padding: "8px 12px", border: "1px solid #e5e7eb", color: "#374151" }}>Total</td>
              <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>₹{totalCollected}</td>
              <td colSpan={2} style={{ border: "1px solid #e5e7eb" }}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

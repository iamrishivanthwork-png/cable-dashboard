import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Customer, Payment, PendingPayment } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Users, CheckCircle, XCircle, Clock, IndianRupee } from "lucide-react"

function getCurrentMonth () {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function formatMonth (month: string) {
  const [year, m] = month.split("-")
  const date = new Date(Number(year), Number(m) - 1)
  return date.toLocaleString("default", { month: "long", year: "numeric" })
}

interface TownSummary {
  town: string
  total: number
  paid: number
  unpaid: number
  pending: number
  collected: number
}

export default function Dashboard () {
  const [loading, setLoading] = useState(true)
  const [month] = useState(getCurrentMonth())
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [paidCount, setPaidCount] = useState(0)
  const [unpaidCount, setUnpaidCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [totalCollected, setTotalCollected] = useState(0)
  const [townSummaries, setTownSummaries] = useState<TownSummary[]>([])
  const [recentPayments, setRecentPayments] = useState<(Payment & { customer_name: string })[]>([])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData () {
    setLoading(true)

    const { data: customers } = await supabase
      .from("customers")
      .select("*")

    const { data: payments } = await supabase
      .from("payments")
      .select("*")
      .eq("month", month)
      .order("paid_date", { ascending: false })
      .limit(10)

    const { data: pending } = await supabase
      .from("pending_payments")
      .select("*")
      .eq("month", month)

    if (customers) {
      setTotalCustomers(customers.length)

      const paid = payments?.length ?? 0
      const pend = pending?.length ?? 0
      const unpaid = customers.length - paid - pend

      setPaidCount(paid)
      setPendingCount(pend)
      setUnpaidCount(unpaid < 0 ? 0 : unpaid)
      setTotalCollected(payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0)

      // Town summaries
      const towns = [...new Set(customers.map((c: Customer) => c.town))]
      const summaries: TownSummary[] = towns.map((town) => {
        const townCustomers = customers.filter((c: Customer) => c.town === town)
        const townPaid = payments?.filter((p) =>
          townCustomers.find((c: Customer) => c.id === p.customer_id)
        ) ?? []
        const townPending = pending?.filter((p) =>
          townCustomers.find((c: Customer) => c.id === p.customer_id)
        ) ?? []
        return {
          town,
          total: townCustomers.length,
          paid: townPaid.length,
          pending: townPending.length,
          unpaid: townCustomers.length - townPaid.length - townPending.length,
          collected: townPaid.reduce((sum, p) => sum + p.amount, 0),
        }
      })
      setTownSummaries(summaries)

      // Recent payments with customer name
      if (payments) {
        const withNames = payments.map((p) => ({
          ...p,
          customer_name:
            customers.find((c: Customer) => c.id === p.customer_id)?.name ?? "Unknown",
        }))
        setRecentPayments(withNames)
      }
    }

    setLoading(false)
  }

  if (loading) {
    return <p className="text-slate-400">Loading...</p>
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">{formatMonth(month)} overview</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-center gap-3">
          <div className="bg-slate-800 p-2 rounded-md">
            <Users className="w-5 h-5 text-slate-300" />
          </div>
          <div>
            <p className="text-slate-400 text-xs">Total</p>
            <p className="text-white text-xl font-bold">{totalCustomers}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-center gap-3">
          <div className="bg-green-900 p-2 rounded-md">
            <CheckCircle className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="text-slate-400 text-xs">Paid</p>
            <p className="text-green-400 text-xl font-bold">{paidCount}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-center gap-3">
          <div className="bg-red-900 p-2 rounded-md">
            <XCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-slate-400 text-xs">Unpaid</p>
            <p className="text-red-400 text-xl font-bold">{unpaidCount}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-center gap-3">
          <div className="bg-yellow-900 p-2 rounded-md">
            <Clock className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <p className="text-slate-400 text-xs">Pending</p>
            <p className="text-yellow-400 text-xl font-bold">{pendingCount}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-center gap-3">
          <div className="bg-blue-900 p-2 rounded-md">
            <IndianRupee className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-slate-400 text-xs">Collected</p>
            <p className="text-blue-400 text-xl font-bold">₹{totalCollected}</p>
          </div>
        </div>
      </div>

      {/* Town Summaries */}
      <h2 className="text-white font-semibold mb-3">Town Breakdown</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {townSummaries.map((summary) => (
          <div key={summary.town} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">{summary.town}</h3>
              <span className="text-slate-400 text-sm">{summary.total} customers</span>
            </div>
            <div className="flex gap-2 mb-3">
              <Badge className="bg-green-600 text-white">{summary.paid} Paid</Badge>
              <Badge className="bg-red-600 text-white">{summary.unpaid} Unpaid</Badge>
              <Badge className="bg-yellow-600 text-white">{summary.pending} Pending</Badge>
            </div>
            <p className="text-slate-400 text-sm">
              Collected: <span className="text-white font-semibold">₹{summary.collected}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Recent Payments */}
      <h2 className="text-white font-semibold mb-3">Recent Payments</h2>
      <div className="rounded-lg border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800">
            <tr>
              <th className="text-left text-slate-400 px-4 py-3">Customer</th>
              <th className="text-left text-slate-400 px-4 py-3">Amount</th>
              <th className="text-left text-slate-400 px-4 py-3">Mode</th>
              <th className="text-left text-slate-400 px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {recentPayments.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-slate-400 px-4 py-6 text-center">
                  No payments recorded this month yet.
                </td>
              </tr>
            ) : (
              recentPayments.map((payment, index) => (
                <tr key={payment.id} className={index % 2 === 0 ? "bg-slate-900" : "bg-slate-950"}>
                  <td className="text-white px-4 py-3">{payment.customer_name}</td>
                  <td className="text-green-400 px-4 py-3 font-medium">₹{payment.amount}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`text-xs ${payment.payment_mode === "gpay" ? "border-blue-500 text-blue-400" : "border-slate-600 text-slate-300"}`}>
                      {payment.payment_mode === "gpay" ? "GPay" : "Cash"}
                    </Badge>
                  </td>
                  <td className="text-slate-300 px-4 py-3">{payment.paid_date}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

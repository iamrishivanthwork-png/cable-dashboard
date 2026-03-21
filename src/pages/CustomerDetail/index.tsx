import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { Customer, Payment, PendingPayment } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, IndianRupee, CheckCircle, XCircle, Clock } from "lucide-react"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

interface MonthData {
  month: string
  label: string
  payment?: Payment
  pending?: PendingPayment
}

export default function CustomerDetail () {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [monthData, setMonthData] = useState<MonthData[]>([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) fetchCustomer()
  }, [id])

  useEffect(() => {
    if (id) fetchYearData()
  }, [id, year])

  async function fetchCustomer () {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .single()
    if (data) setCustomer(data)
  }

  async function fetchYearData () {
    setLoading(true)

    const months = MONTHS.map((_, i) => {
      const m = String(i + 1).padStart(2, "0")
      return `${year}-${m}`
    })

    const { data: payments } = await supabase
      .from("payments")
      .select("*")
      .eq("customer_id", id)
      .in("month", months)

    const { data: pending } = await supabase
      .from("pending_payments")
      .select("*")
      .eq("customer_id", id)
      .in("month", months)

    const data: MonthData[] = MONTHS.map((label, i) => {
      const month = `${year}-${String(i + 1).padStart(2, "0")}`
      return {
        month,
        label,
        payment: payments?.find((p) => p.month === month),
        pending: pending?.find((p) => p.month === month),
      }
    })

    setMonthData(data)
    setLoading(false)
  }

  const paidMonths = monthData.filter((m) => m.payment).length
  const pendingMonths = monthData.filter((m) => m.pending).length
  const unpaidMonths = monthData.filter((m) => !m.payment && !m.pending).length
  const totalAmount = monthData.reduce((sum, m) => sum + (m.payment?.amount ?? 0), 0)
  const cashCount = monthData.filter((m) => m.payment?.payment_mode === "cash").length
  const gpayCount = monthData.filter((m) => m.payment?.payment_mode === "gpay").length

  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`

  return (
    <div>
      {/* Back Button */}
      <button
        onClick={() => navigate("/customers")}
        className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Customers
      </button>

      {/* Customer Info */}
      {customer && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-white text-2xl font-bold">{customer.name}</h1>
              <p className="text-slate-400 text-sm mt-1">
                {customer.street}, {customer.town}
              </p>
            </div>
            <Badge variant="outline" className="text-slate-300 border-slate-600 text-sm">
              Box: {customer.box_number}
            </Badge>
          </div>
        </div>
      )}

      {/* Year Switcher */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setYear(y => y - 1)}
          className="border-slate-700 text-slate-300"
        >
          ← {year - 1}
        </Button>
        <span className="text-white font-bold text-lg">{year}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setYear(y => y + 1)}
          className="border-slate-700 text-slate-300"
          disabled={year >= new Date().getFullYear()}
        >
          {year + 1} →
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-xs">Paid Months</p>
          <p className="text-green-400 text-2xl font-bold mt-1">{paidMonths}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-xs">Unpaid Months</p>
          <p className="text-red-400 text-2xl font-bold mt-1">{unpaidMonths}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-xs">Pending Months</p>
          <p className="text-yellow-400 text-2xl font-bold mt-1">{pendingMonths}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-xs">Total Collected</p>
          <div className="flex items-center gap-1 mt-1">
            <IndianRupee className="w-4 h-4 text-blue-400" />
            <p className="text-blue-400 text-2xl font-bold">{totalAmount}</p>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-xs">Payment Mode</p>
          <div className="flex gap-2 mt-2">
            <Badge className="bg-slate-700 text-white text-xs">Cash: {cashCount}</Badge>
            <Badge className="bg-blue-700 text-white text-xs">GPay: {gpayCount}</Badge>
          </div>
        </div>
      </div>

      {/* Month Grid */}
      <h2 className="text-white font-semibold mb-3">Monthly Payment History</h2>
      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {monthData.map((m) => {
            const isFuture = m.month > currentMonth
            const isPaid = !!m.payment
            const isPending = !!m.pending

            return (
              <div
                key={m.month}
                className={`rounded-lg border p-4 transition-all ${isPaid
                    ? "bg-green-900/30 border-green-700"
                    : isPending
                      ? "bg-yellow-900/30 border-yellow-700"
                      : isFuture
                        ? "bg-slate-900/50 border-slate-800 opacity-40"
                        : "bg-red-900/20 border-red-900"
                  }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium text-sm">{m.label}</span>
                  {isPaid ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : isPending ? (
                    <Clock className="w-4 h-4 text-yellow-400" />
                  ) : !isFuture ? (
                    <XCircle className="w-4 h-4 text-red-400" />
                  ) : null}
                </div>

                {isPaid && (
                  <>
                    <p className="text-green-400 font-bold">₹{m.payment!.amount}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-slate-400 text-xs">{m.payment!.paid_date}</p>
                      <Badge
                        className={`text-xs ${m.payment!.payment_mode === "gpay"
                            ? "bg-blue-700 text-white"
                            : "bg-slate-700 text-white"
                          }`}
                      >
                        {m.payment!.payment_mode === "gpay" ? "GPay" : "Cash"}
                      </Badge>
                    </div>
                  </>
                )}

                {isPending && (
                  <p className="text-yellow-400 text-xs mt-1">Box on, payment due</p>
                )}

                {!isPaid && !isPending && !isFuture && (
                  <p className="text-red-400 text-xs mt-1">Not paid</p>
                )}

                {isFuture && (
                  <p className="text-slate-500 text-xs mt-1">Upcoming</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

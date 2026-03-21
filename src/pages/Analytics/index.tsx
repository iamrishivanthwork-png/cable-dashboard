import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Customer } from "@/types"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js"
import { Bar, Line, Pie } from "react-chartjs-2"

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

function getCurrentMonth () {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function getCurrentYear () {
  return new Date().getFullYear()
}

// Returns the month string N months ago
function getMonthsAgo (n: number) {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

// New 5-tier classification
function classifyPayment (paidDate: string, paymentMonth: string): "early" | "ontime" | "late" | "monthend" | "irregular" {
  const paid = new Date(paidDate)
  const paidDay = paid.getDate()

  // Parse payment month (YYYY-MM)
  const [pymYear, pymMonth] = paymentMonth.split("-").map(Number)
  const paidYear = paid.getFullYear()
  const paidMonthNum = paid.getMonth() + 1

  // If paid in the next month (1-10), it's irregular
  if (
    (paidYear === pymYear && paidMonthNum === pymMonth + 1 && paidDay <= 10) ||
    (pymMonth === 12 && paidYear === pymYear + 1 && paidMonthNum === 1 && paidDay <= 10)
  ) {
    return "irregular"
  }

  if (paidDay <= 11) return "early"
  if (paidDay <= 13) return "ontime"
  if (paidDay <= 18) return "late"
  return "monthend"
}

interface LatePayer {
  customer_id: string
  name: string
  box_number: string
  town: string
  late_count: number
  total_months: number
}

interface InactiveCustomer {
  id: string
  name: string
  box_number: string
  town: string
  street: string
  last_paid_month: string | null
  months_inactive: number
}

export default function Analytics () {
  const [loading, setLoading] = useState(true)
  const [month] = useState(getCurrentMonth())
  const [year] = useState(getCurrentYear())

  const [timingData, setTimingData] = useState<number[]>(Array(31).fill(0))
  const [earlyCount, setEarlyCount] = useState(0)
  const [ontimeCount, setOntimeCount] = useState(0)
  const [lateCount, setLateCount] = useState(0)
  const [monthendCount, setMonthendCount] = useState(0)
  const [irregularCount, setIrregularCount] = useState(0)
  const [monthlyTotals, setMonthlyTotals] = useState<number[]>(Array(12).fill(0))
  const [latePayers, setLatePayers] = useState<LatePayer[]>([])
  const [townData, setTownData] = useState<{ towns: string[], collected: number[], customers: number[] }>({ towns: [], collected: [], customers: [] })

  // Inactive buckets
  const [inactive2, setInactive2] = useState<InactiveCustomer[]>([])
  const [inactive3, setInactive3] = useState<InactiveCustomer[]>([])
  const [inactive6, setInactive6] = useState<InactiveCustomer[]>([])
  const [inactive10, setInactive10] = useState<InactiveCustomer[]>([])
  const [inactiveYear, setInactiveYear] = useState<InactiveCustomer[]>([])

  const [activeInactiveBucket, setActiveInactiveBucket] = useState<"2" | "3" | "6" | "10" | "year">("2")

  useEffect(() => {
    fetchAnalyticsData()
  }, [])

  async function fetchAnalyticsData () {
    setLoading(true)

    const { data: customers } = await supabase.from("customers").select("*")
    const { data: currentPayments } = await supabase.from("payments").select("*").eq("month", month)
    const { data: yearPayments } = await supabase.from("payments").select("*").gte("paid_date", `${year}-01-01`).lte("paid_date", `${year}-12-31`)
    const { data: allPayments } = await supabase.from("payments").select("*").order("paid_date", { ascending: false })
    const { data: recentPayments } = await supabase.from("payments").select("*").gte("paid_date", `${getMonthsAgo(6)}-01`)

    if (customers) {
      // 1. Payment timing by day
      const timing = Array(31).fill(0)
      currentPayments?.forEach((p) => {
        const day = new Date(p.paid_date).getDate()
        if (day >= 1 && day <= 31) timing[day - 1]++
      })
      setTimingData(timing)

      // 2. New 5-tier pie
      let early = 0, ontime = 0, late = 0, monthend = 0, irregular = 0
      currentPayments?.forEach((p) => {
        const type = classifyPayment(p.paid_date, p.month)
        if (type === "early") early++
        else if (type === "ontime") ontime++
        else if (type === "late") late++
        else if (type === "monthend") monthend++
        else irregular++
      })
      setEarlyCount(early)
      setOntimeCount(ontime)
      setLateCount(late)
      setMonthendCount(monthend)
      setIrregularCount(irregular)

      // 3. Monthly trend
      const totals = Array(12).fill(0)
      yearPayments?.forEach((p) => {
        const monthIndex = new Date(p.paid_date).getMonth()
        totals[monthIndex] += p.amount
      })
      setMonthlyTotals(totals)

      // 4. Habitual late payers
      const latePayerMap: Record<string, { count: number, total: number }> = {}
      recentPayments?.forEach((p) => {
        const type = classifyPayment(p.paid_date, p.month)
        if (!latePayerMap[p.customer_id]) latePayerMap[p.customer_id] = { count: 0, total: 0 }
        if (type === "late" || type === "monthend" || type === "irregular") {
          latePayerMap[p.customer_id].count++
        }
        latePayerMap[p.customer_id].total++
      })
      const lateList: LatePayer[] = Object.entries(latePayerMap)
        .filter(([, v]) => v.count >= 2)
        .map(([customerId, v]) => {
          const customer = customers.find((c: Customer) => c.id === customerId)
          return {
            customer_id: customerId,
            name: customer?.name ?? "Unknown",
            box_number: customer?.box_number ?? "-",
            town: customer?.town ?? "-",
            late_count: v.count,
            total_months: v.total,
          }
        })
        .sort((a, b) => b.late_count - a.late_count)
      setLatePayers(lateList)

      // 5. Town-wise
      const towns = [...new Set(customers.map((c: Customer) => c.town))]
      const townCollected = towns.map((town) => {
        const tc = customers.filter((c: Customer) => c.town === town)
        const tp = currentPayments?.filter((p) => tc.find((c: Customer) => c.id === p.customer_id)) ?? []
        return tp.reduce((sum, p) => sum + p.amount, 0)
      })
      const townCustomerCount = towns.map((town) => customers.filter((c: Customer) => c.town === town).length)
      setTownData({ towns, collected: townCollected, customers: townCustomerCount })

      // 6. Inactive customers
      // Build last payment month per customer
      const lastPaymentMap: Record<string, string> = {}
      allPayments?.forEach((p) => {
        if (!lastPaymentMap[p.customer_id]) {
          lastPaymentMap[p.customer_id] = p.month
        }
      })

      function monthDiff (monthStr: string) {
        const [y, m] = monthStr.split("-").map(Number)
        const now = new Date()
        return (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m)
      }

      const inactiveList: InactiveCustomer[] = customers.map((c: Customer) => {
        const lastMonth = lastPaymentMap[c.id] ?? null
        const inactive = lastMonth ? monthDiff(lastMonth) : 999
        return {
          id: c.id,
          name: c.name,
          box_number: c.box_number,
          town: c.town,
          street: c.street,
          last_paid_month: lastMonth,
          months_inactive: inactive,
        }
      }).filter((c: InactiveCustomer) => c.months_inactive >= 2)
        .sort((a: InactiveCustomer, b: InactiveCustomer) => b.months_inactive - a.months_inactive)

      setInactive2(inactiveList.filter((c) => c.months_inactive >= 2 && c.months_inactive < 3))
      setInactive3(inactiveList.filter((c) => c.months_inactive >= 3 && c.months_inactive < 6))
      setInactive6(inactiveList.filter((c) => c.months_inactive >= 6 && c.months_inactive < 10))
      setInactive10(inactiveList.filter((c) => c.months_inactive >= 10 && c.months_inactive < 12))
      setInactiveYear(inactiveList.filter((c) => c.months_inactive >= 12))
    }

    setLoading(false)
  }

  const chartOptions = {
    responsive: true,
    plugins: { legend: { labels: { color: "#94a3b8" } } },
    scales: {
      x: { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
      y: { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
    },
  }

  const pieOptions = {
    responsive: true,
    plugins: { legend: { labels: { color: "#94a3b8" } } },
  }

  const inactiveBuckets = [
    { key: "2", label: "2 Months", count: inactive2.length, color: "text-yellow-400", data: inactive2 },
    { key: "3", label: "3 Months", count: inactive3.length, color: "text-orange-400", data: inactive3 },
    { key: "6", label: "6 Months", count: inactive6.length, color: "text-red-400", data: inactive6 },
    { key: "10", label: "10+ Months", count: inactive10.length, color: "text-red-600", data: inactive10 },
    { key: "year", label: "1+ Year", count: inactiveYear.length, color: "text-purple-400", data: inactiveYear },
  ]

  const activeInactiveData = inactiveBuckets.find((b) => b.key === activeInactiveBucket)?.data ?? []

  if (loading) return <p className="text-slate-400">Loading analytics...</p>

  return (
    <div>
      <div className="md:hidden flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 max-w-sm">
          <div className="text-4xl mb-4">📊</div>
          <h2 className="text-white font-bold text-lg mb-2">Analytics not available on mobile</h2>
          <p className="text-slate-400 text-sm">Please open the dashboard on a desktop or laptop to view analytics charts and reports.</p>
        </div>
      </div>

      <div className="hidden md:block">

        <div className="mb-6">
          <h1 className="text-white text-xl md:text-2xl font-bold">Analytics</h1>
          <p className="text-slate-400 text-sm mt-1">Payment patterns and insights</p>
        </div>

        {/* Row 1 — Pie + Town Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* 5-tier Pie */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <h2 className="text-white font-semibold mb-1">Payment Timing Breakdown</h2>
            <p className="text-slate-400 text-xs mb-4">Current month — 5 tier classification</p>
            {earlyCount + ontimeCount + lateCount + monthendCount + irregularCount === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No payments this month yet</p>
            ) : (
              <div className="max-w-xs mx-auto">
                <Pie
                  data={{
                    labels: ["Early (1-11)", "On Time (12-13)", "Late Payers (14-18)", "Month End (19-30)", "Irregular (next month 1-10)"],
                    datasets: [{
                      data: [earlyCount, ontimeCount, lateCount, monthendCount, irregularCount],
                      backgroundColor: ["#16a34a", "#2563eb", "#f59e0b", "#dc2626", "#7c3aed"],
                      borderWidth: 1,
                    }],
                  }}
                  options={pieOptions}
                />
              </div>
            )}
            <div className="grid grid-cols-5 gap-1 mt-4">
              {[
                { label: "Early", value: earlyCount, color: "text-green-400" },
                { label: "On Time", value: ontimeCount, color: "text-blue-400" },
                { label: "Late", value: lateCount, color: "text-amber-400" },
                { label: "Month End", value: monthendCount, color: "text-red-400" },
                { label: "Irregular", value: irregularCount, color: "text-purple-400" },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <p className={`${item.color} font-bold text-lg`}>{item.value}</p>
                  <p className="text-slate-400 text-xs">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Town-wise Collection Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <h2 className="text-white font-semibold mb-1">Town-wise Collection</h2>
            <p className="text-slate-400 text-xs mb-4">Current month — Amount collected per town</p>
            <Bar
              data={{
                labels: townData.towns,
                datasets: [
                  { label: "Amount Collected (₹)", data: townData.collected, backgroundColor: "#2563eb", borderRadius: 4 },
                  { label: "Total Customers", data: townData.customers, backgroundColor: "#7c3aed", borderRadius: 4 },
                ],
              }}
              options={chartOptions}
            />
          </div>
        </div>

        {/* Row 2 — Payment Day Distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6">
          <h2 className="text-white font-semibold mb-1">Payment Day Distribution</h2>
          <p className="text-slate-400 text-xs mb-4">Current month — Which day customers paid</p>
          <Bar
            data={{
              labels: Array.from({ length: 31 }, (_, i) => `${i + 1}`),
              datasets: [{
                label: "Payments",
                data: timingData,
                backgroundColor: timingData.map((_, i) => {
                  const day = i + 1
                  if (day <= 11) return "#16a34a"
                  if (day <= 13) return "#2563eb"
                  if (day <= 18) return "#f59e0b"
                  return "#dc2626"
                }),
                borderRadius: 4,
              }],
            }}
            options={{
              ...chartOptions,
              plugins: {
                ...chartOptions.plugins,
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    title: (items) => `Day ${items[0].label}`,
                    label: (item) => `${item.raw} payments`,
                  }
                }
              },
            }}
          />
          <div className="flex gap-3 mt-3 justify-center flex-wrap">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-600" /><span className="text-slate-400 text-xs">Early (1-11)</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-600" /><span className="text-slate-400 text-xs">On Time (12-13)</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-500" /><span className="text-slate-400 text-xs">Late (14-18)</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-600" /><span className="text-slate-400 text-xs">Month End (19-30)</span></div>
          </div>
        </div>

        {/* Row 3 — Monthly Trend */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6">
          <h2 className="text-white font-semibold mb-1">Monthly Collection Trend</h2>
          <p className="text-slate-400 text-xs mb-4">{year} — Total amount collected each month</p>
          <Line
            data={{
              labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
              datasets: [{
                label: "Amount Collected (₹)",
                data: monthlyTotals,
                borderColor: "#2563eb",
                backgroundColor: "rgba(37, 99, 235, 0.1)",
                pointBackgroundColor: "#2563eb",
                pointRadius: 5,
                fill: true,
                tension: 0.4,
              }],
            }}
            options={chartOptions}
          />
        </div>

        {/* Row 4 — Inactive Customers */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6">
          <h2 className="text-white font-semibold mb-1">Inactive Customers</h2>
          <p className="text-slate-400 text-xs mb-4">Customers who haven't paid — grouped by how long</p>

          {/* Bucket tabs */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {inactiveBuckets.map((bucket) => (
              <button
                key={bucket.key}
                onClick={() => setActiveInactiveBucket(bucket.key as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeInactiveBucket === bucket.key
                  ? "bg-slate-700 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
              >
                {bucket.label}
                <span className={`ml-1.5 font-bold ${bucket.color}`}>{bucket.count}</span>
              </button>
            ))}
          </div>

          {/* Inactive list */}
          {activeInactiveData.length === 0 ? (
            <p className="text-green-400 text-sm text-center py-4">No customers in this category! 🎉</p>
          ) : (
            <div className="space-y-2">
              {activeInactiveData.map((c) => (
                <div key={c.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-white font-medium text-sm">{c.name}</p>
                    <p className="text-slate-400 text-xs">{c.box_number} · {c.street}, {c.town}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-red-400 font-bold text-sm">{c.months_inactive} months</p>
                    <p className="text-slate-400 text-xs">
                      Last: {c.last_paid_month ?? "Never"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Row 5 — Habitual Late Payers */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <h2 className="text-white font-semibold mb-1">Habitual Late Payers</h2>
          <p className="text-slate-400 text-xs mb-4">Customers who paid late 2+ times in last 6 months</p>
          {latePayers.length === 0 ? (
            <p className="text-green-400 text-sm text-center py-4">No habitual late payers! 🎉</p>
          ) : (
            <div className="space-y-2">
              {latePayers.map((lp) => (
                <div key={lp.customer_id} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-white font-medium text-sm">{lp.name}</p>
                    <p className="text-slate-400 text-xs">{lp.box_number} · {lp.town}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-red-400 font-bold text-sm">{lp.late_count} late</p>
                    <p className="text-slate-400 text-xs">in {lp.total_months} months</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

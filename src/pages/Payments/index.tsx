import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Customer, Payment, PendingPayment } from "@/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle, XCircle, Clock } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"

const paymentSchema = z.object({
  amount: z.coerce.number().min(1, "Amount is required"),
  payment_mode: z.enum(["cash", "gpay"]),
  paid_date: z.string().min(1, "Date is required"),
})

type PaymentFormData = z.infer<typeof paymentSchema>

interface CustomerWithStatus extends Customer {
  payment?: Payment
  pending?: PendingPayment
}

function getCurrentMonth () {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function formatMonth (month: string) {
  const [year, m] = month.split("-")
  const date = new Date(Number(year), Number(m) - 1)
  return date.toLocaleString("default", { month: "long", year: "numeric" })
}

function getTodayDate () {
  const now = new Date()
  return now.toISOString().split("T")[0]
}

export default function Payments () {
  const [customers, setCustomers] = useState<CustomerWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(getCurrentMonth())
  const [townFilter, setTownFilter] = useState("all")
  const [streetFilter, setStreetFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [towns, setTowns] = useState<string[]>([])
  const [streets, setStreets] = useState<string[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithStatus | null>(null)
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false)
  const [formLoading, setFormLoading] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: 260,
      payment_mode: "cash",
      paid_date: getTodayDate(),
    },
  })

  useEffect(() => {
    fetchData()
  }, [month])

  useEffect(() => {
    setStreetFilter("all")
    if (townFilter === "all") {
      setStreets([])
    } else {
      const townCustomers = customers.filter((c) => c.town === townFilter)
      const uniqueStreets = [...new Set(townCustomers.map((c) => c.street))]
      setStreets(uniqueStreets)
    }
  }, [townFilter, customers])

  async function fetchData () {
    setLoading(true)

    const { data: customerData } = await supabase
      .from("customers")
      .select("*")
      .order("name")

    const { data: paymentData } = await supabase
      .from("payments")
      .select("*")
      .eq("month", month)

    const { data: pendingData } = await supabase
      .from("pending_payments")
      .select("*")
      .eq("month", month)

    if (customerData) {
      const uniqueTowns = [...new Set(customerData.map((c) => c.town))]
      setTowns(uniqueTowns)

      const merged: CustomerWithStatus[] = customerData.map((customer) => ({
        ...customer,
        payment: paymentData?.find((p) => p.customer_id === customer.id),
        pending: pendingData?.find((p) => p.customer_id === customer.id),
      }))
      setCustomers(merged)
    }

    setLoading(false)
  }

  async function handleMarkPaid (data: PaymentFormData) {
    if (!selectedCustomer) return
    setFormLoading(true)

    // Remove pending if exists
    if (selectedCustomer.pending) {
      await supabase
        .from("pending_payments")
        .delete()
        .eq("id", selectedCustomer.pending.id)
    }

    const { error } = await supabase.from("payments").insert([{
      customer_id: selectedCustomer.id,
      month,
      amount: data.amount,
      payment_mode: data.payment_mode,
      paid_date: data.paid_date,
    }])

    if (!error) {
      await fetchData()
      setIsPayDialogOpen(false)
      reset({
        amount: 260,
        payment_mode: "cash",
        paid_date: getTodayDate(),
      })
    }

    setFormLoading(false)
  }

  async function handleUnmarkPaid (customer: CustomerWithStatus) {
    if (!customer.payment) return
    if (!confirm("Remove payment for this customer?")) return
    const { error } = await supabase
      .from("payments")
      .delete()
      .eq("id", customer.payment.id)
    if (!error) await fetchData()
  }

  async function handleTogglePending (customer: CustomerWithStatus) {
    if (customer.payment) return

    if (customer.pending) {
      await supabase
        .from("pending_payments")
        .delete()
        .eq("id", customer.pending.id)
    } else {
      await supabase.from("pending_payments").insert([{
        customer_id: customer.id,
        month,
        note: "Box on, payment due",
      }])
    }
    await fetchData()
  }

  function handleMonthChange (direction: "prev" | "next") {
    const [year, m] = month.split("-").map(Number)
    const date = new Date(year, m - 1)
    direction === "prev"
      ? date.setMonth(date.getMonth() - 1)
      : date.setMonth(date.getMonth() + 1)
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    setMonth(newMonth)
  }

  const filtered = customers.filter((c) => {
    const townMatch = townFilter === "all" || c.town === townFilter
    const streetMatch = streetFilter === "all" || c.street === streetFilter
    const statusMatch =
      statusFilter === "all" ||
      (statusFilter === "paid" && c.payment) ||
      (statusFilter === "unpaid" && !c.payment && !c.pending) ||
      (statusFilter === "pending" && c.pending)
    return townMatch && streetMatch && statusMatch
  })

  const paidCount = customers.filter((c) => c.payment).length
  const unpaidCount = customers.filter((c) => !c.payment && !c.pending).length
  const pendingCount = customers.filter((c) => c.pending).length
  const totalCollected = customers.reduce((sum, c) => sum + (c.payment?.amount ?? 0), 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Payments</h1>
          <p className="text-slate-400 text-sm mt-1">{formatMonth(month)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleMonthChange("prev")} className="border-slate-700 text-slate-300">
            ← Prev
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(getCurrentMonth())} className="border-slate-700 text-slate-300">
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleMonthChange("next")} className="border-slate-700 text-slate-300">
            Next →
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Total Collected</p>
          <p className="text-white text-2xl font-bold mt-1">₹{totalCollected}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Paid</p>
          <p className="text-green-400 text-2xl font-bold mt-1">{paidCount}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Unpaid</p>
          <p className="text-red-400 text-2xl font-bold mt-1">{unpaidCount}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Pending</p>
          <p className="text-yellow-400 text-2xl font-bold mt-1">{pendingCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <Select value={townFilter} onValueChange={setTownFilter}>
          <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-white">
            <SelectValue placeholder="All Towns" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-white">All Towns</SelectItem>
            {towns.map((town) => (
              <SelectItem key={town} value={town} className="text-white">{town}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-white">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-white">All Status</SelectItem>
            <SelectItem value="paid" className="text-white">Paid</SelectItem>
            <SelectItem value="unpaid" className="text-white">Unpaid</SelectItem>
            <SelectItem value="pending" className="text-white">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Street Tabs — only shows when a town is selected */}
      {townFilter !== "all" && streets.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setStreetFilter("all")}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${streetFilter === "all"
              ? "bg-blue-600 text-white"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
          >
            All Streets
          </button>
          {streets.map((street) => (
            <button
              key={street}
              onClick={() => setStreetFilter(street)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${streetFilter === street
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
            >
              {street}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : (
        <div className="rounded-lg border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800">
              <tr>
                <th className="text-left text-slate-400 px-4 py-3">Name</th>
                <th className="text-left text-slate-400 px-4 py-3">Box Number</th>
                <th className="text-left text-slate-400 px-4 py-3">Town</th>
                <th className="text-left text-slate-400 px-4 py-3">Street</th>
                <th className="text-left text-slate-400 px-4 py-3">Status</th>
                <th className="text-left text-slate-400 px-4 py-3">Amount</th>
                <th className="text-left text-slate-400 px-4 py-3">Mode</th>
                <th className="text-left text-slate-400 px-4 py-3">Paid Date</th>
                <th className="text-left text-slate-400 px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer, index) => (
                <tr
                  key={customer.id}
                  className={index % 2 === 0 ? "bg-slate-900" : "bg-slate-950"}
                >
                  <td className="text-white px-4 py-3">{customer.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-slate-300 border-slate-600">
                      {customer.box_number}
                    </Badge>
                  </td>
                  <td className="text-slate-300 px-4 py-3">{customer.town}</td>
                  <td className="text-slate-300 px-4 py-3">{customer.street}</td>
                  <td className="px-4 py-3">
                    {customer.payment ? (
                      <Badge className="bg-green-600 text-white">Paid</Badge>
                    ) : customer.pending ? (
                      <Badge className="bg-yellow-600 text-white">Pending</Badge>
                    ) : (
                      <Badge variant="destructive">Unpaid</Badge>
                    )}
                  </td>
                  <td className="text-slate-300 px-4 py-3">
                    {customer.payment ? `₹${customer.payment.amount}` : "-"}
                  </td>
                  <td className="text-slate-300 px-4 py-3">
                    {customer.payment ? (
                      <Badge variant="outline" className={`text-xs ${customer.payment.payment_mode === "gpay" ? "border-blue-500 text-blue-400" : "border-slate-600 text-slate-300"}`}>
                        {customer.payment.payment_mode === "gpay" ? "GPay" : "Cash"}
                      </Badge>
                    ) : "-"}
                  </td>
                  <td className="text-slate-300 px-4 py-3">
                    {customer.payment?.paid_date ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {customer.payment ? (
                        <Button size="sm" variant="ghost" onClick={() => handleUnmarkPaid(customer)} className="text-red-400 hover:text-red-300 text-xs">
                          <XCircle className="w-4 h-4 mr-1" />
                          Undo
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedCustomer(customer)
                              setIsPayDialogOpen(true)
                            }}
                            className="bg-green-600 hover:bg-green-700 text-xs"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Paid
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleTogglePending(customer)}
                            className={`text-xs ${customer.pending ? "text-yellow-300" : "text-yellow-600 hover:text-yellow-400"}`}
                          >
                            <Clock className="w-4 h-4 mr-1" />
                            {customer.pending ? "Clear" : "Pending"}
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mark Paid Dialog */}
      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">
              Mark as Paid — {selectedCustomer?.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleMarkPaid)} className="space-y-4">
            <div>
              <label className="text-sm text-slate-300 mb-1 block">Amount (₹)</label>
              <Input
                {...register("amount")}
                type="number"
                className="bg-slate-800 border-slate-700 text-white"
              />
              {errors.amount && <p className="text-red-400 text-xs mt-1">{errors.amount.message}</p>}
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-1 block">Payment Mode</label>
              <Select
                defaultValue="cash"
                onValueChange={(val) => {
                  const event = { target: { value: val } }
                  register("payment_mode").onChange(event as any)
                }}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="cash" className="text-white">Cash (In Hand)</SelectItem>
                  <SelectItem value="gpay" className="text-white">GPay</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-1 block">Paid Date</label>
              <Input
                {...register("paid_date")}
                type="date"
                className="bg-slate-800 border-slate-700 text-white"
              />
              {errors.paid_date && <p className="text-red-400 text-xs mt-1">{errors.paid_date.message}</p>}
            </div>

            <Button type="submit" disabled={formLoading} className="w-full bg-green-600 hover:bg-green-700">
              {formLoading ? "Saving..." : "Confirm Payment"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

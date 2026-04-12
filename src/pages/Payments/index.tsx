import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Customer, Payment, PendingPayment } from "@/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle, XCircle, Clock, FileText, Copy, Eye, Printer, IndianRupee, ChevronLeft, CalendarDays, ChevronRight } from "lucide-react"
import { useForm, Controller } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import Receipt from "./Receipt"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useNavigate } from "react-router-dom"

const paymentSchema = z.object({
  amount: z.number().min(1, "Amount is required"),
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
  const navigate = useNavigate()
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
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [receiptCustomer, setReceiptCustomer] = useState<CustomerWithStatus | null>(null)
  const [billSearch, setBillSearch] = useState("")
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
  const [customerToRemove, setCustomerToRemove] = useState<CustomerWithStatus | null>(null)
  const [printCustomer, setPrintCustomer] = useState<CustomerWithStatus | null>(null)
  const [isPrintOpen, setIsPrintOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: 260, payment_mode: "cash", paid_date: getTodayDate() },
  })

  useEffect(() => { fetchData() }, [month])

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

  useEffect(() => {
    setCurrentPage(1)
  }, [month, townFilter, streetFilter, statusFilter, billSearch])

  async function fetchData () {
    setLoading(true)
    const { data: customerData } = await supabase.from("customers").select("*").order("name")
    const { data: paymentData } = await supabase.from("payments").select("*").eq("month", month)
    const { data: pendingData } = await supabase.from("pending_payments").select("*").eq("month", month)

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

    try {
      // Remove pending if exists
      if (selectedCustomer.pending) {
        await supabase
          .from("pending_payments")
          .delete()
          .eq("id", selectedCustomer.pending.id)
      }

      const { data: userData } = await supabase.auth.getUser()

      // ✅ STEP 1: Insert into payments
      const { data: paymentInsert, error: paymentError } = await supabase
        .from("payments")
        .insert([{
          customer_id: selectedCustomer.id,
          month,
          amount: data.amount,
          payment_mode: data.payment_mode,
          paid_date: data.paid_date,
          recorded_by: userData.user?.id ?? null,
        }])
        .select()
        .single()

      if (paymentError) throw paymentError

      // ✅ STEP 2: Insert log (after payment success)
      await supabase.from("payment_logs").insert([{
        payment_id: paymentInsert.id,
        customer_id: selectedCustomer.id,
        action: "paid",
        amount: data.amount,
        payment_mode: data.payment_mode,
        month,
        bill_number: paymentInsert.bill_number ?? null,
        performed_by: userData.user?.id ?? null,
      }])

      // ✅ UI updates
      await fetchData()
      setIsPayDialogOpen(false)
      reset({ amount: 260, payment_mode: "cash", paid_date: getTodayDate() })

      toast.success(`Payment recorded for ${selectedCustomer.name}!`)
    } catch (err) {
      console.error(err)
      toast.error("Failed to record payment")
    }

    setFormLoading(false)
  }

  async function handleUnmarkPaid (customer: CustomerWithStatus) {
    setCustomerToRemove(customer)
    setIsRemoveDialogOpen(true)
  }

  async function confirmUnmarkPaid () {
    if (!customerToRemove?.payment) return

    const { data: userData } = await supabase.auth.getUser()

    const { error } = await supabase
      .from("payments")
      .delete()
      .eq("id", customerToRemove.payment.id)

    if (!error) {
      // Log the undo action
      await supabase.from("payment_logs").insert([{
        payment_id: customerToRemove.payment.id,
        customer_id: customerToRemove.id,
        action: "undo",
        amount: customerToRemove.payment.amount,
        payment_mode: customerToRemove.payment.payment_mode,
        month: customerToRemove.payment.month,
        bill_number: customerToRemove.payment.bill_number,
        performed_by: userData.user?.id ?? null,
      }])
      await fetchData()
      toast.success("Payment removed")
    } else {
      toast.error("Failed to remove payment")
    }
    setIsRemoveDialogOpen(false)
    setCustomerToRemove(null)
  }

  async function handleTogglePending (customer: CustomerWithStatus) {
    if (customer.payment) return
    if (customer.pending) {
      const { error } = await supabase.from("pending_payments").delete().eq("id", customer.pending.id)
      if (!error) toast.success("Pending status cleared")
      else toast.error("Failed to clear pending")
    } else {
      const { error } = await supabase.from("pending_payments").insert([{
        customer_id: customer.id, month, note: "Box on, payment due",
      }])
      if (!error) toast.success(`${customer.name} marked as pending`)
      else toast.error("Failed to mark as pending")
    }
    await fetchData()
  }

  function handleMonthChange (direction: "prev" | "next") {
    const [year, m] = month.split("-").map(Number)
    const date = new Date(year, m - 1)
    direction === "prev" ? date.setMonth(date.getMonth() - 1) : date.setMonth(date.getMonth() + 1)
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`)
  }

  const filtered = customers.filter((c) => {
    const townMatch = townFilter === "all" || c.town === townFilter
    const streetMatch = streetFilter === "all" || c.street === streetFilter
    const statusMatch = statusFilter === "all" ||
      (statusFilter === "paid" && c.payment) ||
      (statusFilter === "unpaid" && !c.payment && !c.pending) ||
      (statusFilter === "pending" && c.pending)
    const billMatch = billSearch === "" ||
      c.payment?.bill_number?.toLowerCase().includes(billSearch.toLowerCase())
    return townMatch && streetMatch && statusMatch && billMatch
  })

  const totalPages = Math.ceil(filtered.length / itemsPerPage)

  const paginatedData = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const paidCount = customers.filter((c) => c.payment).length
  const unpaidCount = customers.filter((c) => !c.payment && !c.pending).length
  const pendingCount = customers.filter((c) => c.pending).length
  const totalCollected = customers.reduce((sum, c) => sum + (c.payment?.amount ?? 0), 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-white text-xl md:text-2xl font-bold">Payments</h1>
          <div className="mt-2 inline-block bg-slate-800 border border-slate-700 rounded-md px-3 py-1">
            <p className="text-white text-sm md:text-base font-medium">
              {formatMonth(month)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          {/* Previous Month */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleMonthChange("prev")}
            className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 px-2 md:px-3"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          {/* Today */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMonth(getCurrentMonth())}
            className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 flex items-center gap-1 px-3 border border-blue-700"
          >
            <CalendarDays className="w-4 h-4" />
            <span className="hidden md:inline">Today</span>
          </Button>

          {/* Next Month */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleMonthChange("next")}
            className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 px-2 md:px-3"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards — 2 cols mobile, 4 desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 md:p-4">
          <p className="text-slate-400 text-xs">Collected</p>
          <p className="text-white text-lg md:text-2xl font-bold mt-1">₹{totalCollected}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 md:p-4">
          <p className="text-slate-400 text-xs">Paid</p>
          <p className="text-green-400 text-lg md:text-2xl font-bold mt-1">{paidCount}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 md:p-4">
          <p className="text-slate-400 text-xs">Unpaid</p>
          <p className="text-red-400 text-lg md:text-2xl font-bold mt-1">{unpaidCount}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 md:p-4">
          <p className="text-slate-400 text-xs">Pending</p>
          <p className="text-yellow-400 text-lg md:text-2xl font-bold mt-1">{pendingCount}</p>
        </div>
      </div>

      {/* Bill Search */}
      <div className="mb-3">
        <Input
          type="text"
          placeholder="Search by bill number..."
          value={billSearch}
          onChange={(e) => setBillSearch(e.target.value)}
          className="bg-slate-800 border-slate-700 text-white w-full md:max-w-sm"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <Select value={townFilter} onValueChange={setTownFilter}>
          <SelectTrigger className="w-32 md:w-40 bg-slate-800 border-slate-700 text-white">
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
          <SelectTrigger className="w-32 md:w-40 bg-slate-800 border-slate-700 text-white">
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

      {/* Street Tabs */}
      {townFilter !== "all" && streets.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          <button onClick={() => setStreetFilter("all")} className={`px-3 py-1 rounded-full text-xs md:text-sm transition-colors ${streetFilter === "all" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
            All Streets
          </button>
          {streets.map((street) => (
            <button key={street} onClick={() => setStreetFilter(street)} className={`px-3 py-1 rounded-full text-xs md:text-sm transition-colors ${streetFilter === street ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
              {street}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : (
        <>
          {/* Mobile: Card View */}
          <div className="md:hidden space-y-2">
            {paginatedData?.map((customer) => (
              <div key={customer.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                {/* Top row */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-white font-medium text-sm">{customer.name}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{customer.street}, {customer.town}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {customer.payment ? (
                      <Badge className="bg-green-600 text-white text-xs">Paid</Badge>
                    ) : customer.pending ? (
                      <Badge className="bg-yellow-600 text-white text-xs">Pending</Badge>
                    ) : (
                      <Badge className="bg-red-600 text-white text-xs">Unpaid</Badge>
                    )}
                  </div>
                </div>

                {/* Middle row - box number + payment info */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-slate-300 border-slate-600 text-xs">
                      {customer.box_number}
                    </Badge>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(customer.box_number)
                        toast.success(`Copied: ${customer.box_number}`)
                      }}
                      className="text-slate-500 hover:text-white"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  {customer.payment && (
                    <div className="flex items-center gap-2">
                      <span className="text-green-400 text-sm font-bold">₹{customer.payment.amount}</span>
                      <Badge variant="outline" className={`text-xs ${customer.payment.payment_mode === "gpay" ? "border-blue-500 text-blue-400" : "border-slate-600 text-slate-300"}`}>
                        {customer.payment.payment_mode === "gpay" ? "GPay" : "Cash"}
                      </Badge>
                      <span className="text-slate-400 text-xs">{customer.payment.paid_date}</span>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-1 flex-wrap">
                  {customer.payment ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => { setReceiptCustomer(customer); setIsReceiptOpen(true) }} className="text-blue-400 hover:text-blue-300 h-7 px-2 text-xs">
                        <FileText className="w-3 h-3 mr-1" />Receipt
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setPrintCustomer(customer); setIsPrintOpen(true) }} className="text-green-400 hover:text-green-300 h-7 px-2 text-xs">
                        <Printer className="w-3 h-3 mr-1" />Print
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleUnmarkPaid(customer)} className="text-red-400 hover:text-red-300 h-7 px-2 text-xs">
                        <XCircle className="w-3 h-3 mr-1" />Undo
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/customers/${customer.id}`)} className="text-slate-400 hover:text-blue-400 h-7 px-2">
                        <Eye className="w-3 h-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" onClick={() => {
                        if (month > getCurrentMonth()) { toast.error("Cannot record payment for a future month!"); return }
                        setSelectedCustomer(customer); setIsPayDialogOpen(true)
                      }} className="bg-green-600 hover:bg-green-700 h-7 px-2 text-xs">
                        <CheckCircle className="w-3 h-3 mr-1" />Paid
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        if (month > getCurrentMonth()) { toast.error("Cannot set pending for a future month!"); return }
                        handleTogglePending(customer)
                      }} className={`h-7 px-2 text-xs ${customer.pending ? "text-yellow-300" : "text-yellow-600 hover:text-yellow-400"}`}>
                        <Clock className="w-3 h-3 mr-1" />{customer.pending ? "Clear" : "Pending"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/customers/${customer.id}`)} className="text-slate-400 hover:text-blue-400 h-7 px-2">
                        <Eye className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: Table View */}
          <div className="hidden md:block rounded-lg border border-slate-800 overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
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
                {paginatedData?.map((customer, index) => (
                  <tr key={customer.id} className={index % 2 === 0 ? "bg-slate-900" : "bg-slate-950"}>
                    <td className="text-white px-4 py-3">{customer.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-slate-300 border-slate-600">{customer.box_number}</Badge>
                        <button onClick={() => { navigator.clipboard.writeText(customer.box_number); toast.success(`Copied: ${customer.box_number}`) }} className="text-slate-500 hover:text-white">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="text-slate-300 px-4 py-3">{customer.town}</td>
                    <td className="text-slate-300 px-4 py-3">{customer.street}</td>
                    <td className="px-4 py-3">
                      {customer.payment ? <Badge className="bg-green-600 text-white">  <CheckCircle className="w-4 h-4 mr-1" />  Paid</Badge>
                        : customer.pending ? <Badge className="bg-yellow-600 text-white">Pending</Badge>
                          : <Badge className="bg-red-600 text-white">Unpaid</Badge>}
                    </td>
                    <td className="text-slate-300 px-4 py-3">{customer.payment ? `₹${customer.payment.amount}` : "-"}</td>
                    <td className="px-4 py-3">
                      {customer.payment ? (
                        <Badge variant="outline" className={`text-xs ${customer.payment.payment_mode === "gpay" ? "border-blue-500 text-blue-400" : "border-slate-600 text-slate-300"}`}>
                          {customer.payment.payment_mode === "gpay" ? "GPay" : "Cash"}
                        </Badge>
                      ) : "-"}
                    </td>
                    <td className="text-slate-300 px-4 py-3">{customer.payment?.paid_date ?? "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {customer.payment ? (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => { setReceiptCustomer(customer); setIsReceiptOpen(true) }} className="text-blue-400 hover:text-blue-300 text-xs">
                              <FileText className="w-4 h-4 mr-1" />Receipt
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setPrintCustomer(customer); setIsPrintOpen(true) }} className="text-green-400 hover:text-green-300 text-xs">
                              <Printer className="w-4 h-4 mr-1" />Print
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleUnmarkPaid(customer)} className="text-red-400 hover:text-red-300 text-xs">
                              <XCircle className="w-4 h-4 mr-1" />Undo
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => navigate(`/customers/${customer.id}`)} className="text-slate-400 hover:text-blue-400 text-xs">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" onClick={() => {
                              if (month > getCurrentMonth()) { toast.error("Cannot record payment for a future month!"); return }
                              setSelectedCustomer(customer); setIsPayDialogOpen(true)
                            }} className="bg-violet-600 hover:bg-violet-700 text-xs">
                              <IndianRupee className="w-4 h-4 mr-1" /> Quick pay
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => {
                              if (month > getCurrentMonth()) { toast.error("Cannot set pending for a future month!"); return }
                              handleTogglePending(customer)
                            }} className={`text-xs ${customer.pending ? "text-yellow-300" : "text-yellow-600 hover:text-yellow-400"}`}>
                              <Clock className="w-4 h-4 mr-1" />{customer.pending ? "Clear" : "Pending"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => navigate(`/customers/${customer.id}`)} className="text-slate-400 hover:text-blue-400 text-xs">
                              <Eye className="w-4 h-4" />
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-2">

              {/* Page Info */}
              <p className="text-slate-400 text-sm">
                Page {currentPage} of {totalPages}
              </p>

              {/* Controls */}
              <div className="flex items-center gap-2 flex-wrap">

                {/* Prev */}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="text-slate-400 hover:text-white disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                {/* Page Numbers */}
                {[...Array(totalPages)].map((_, i) => {
                  const page = i + 1
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-2 py-1 text-xs rounded-md transition ${currentPage === page
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                        }`}
                    >
                      {page}
                    </button>
                  )
                })}

                {/* Next */}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="text-slate-400 hover:text-white disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>

              </div>
            </div>
          )}
        </>
      )}

      {/* Mark Paid Dialog */}
      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 w-full max-w-md mx-auto">
          <DialogHeader className="">
            <DialogTitle className="text-white">Mark as Paid — {selectedCustomer?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleMarkPaid)} className="space-y-4">
            <div>
              <label className="text-sm text-slate-300 mb-1 block">Amount (₹)</label>
              <Input {...register("amount", { valueAsNumber: true })} type="number" className="bg-slate-800 border-slate-700 text-white" />
              {errors.amount && <p className="text-red-400 text-xs mt-1">{errors.amount.message}</p>}
            </div>
            <div>
              <label className="text-sm text-slate-300 mb-1 block">Payment Mode</label>
              <Controller name="payment_mode" control={control} defaultValue="cash" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="cash" className="text-white">Cash (In Hand)</SelectItem>
                    <SelectItem value="gpay" className="text-white">GPay</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div>
              <label className="text-sm text-slate-300 mb-1 block">Paid Date</label>
              <Input {...register("paid_date")} type="date" className="bg-slate-800 border-slate-700 text-white" />
              {errors.paid_date && <p className="text-red-400 text-xs mt-1">{errors.paid_date.message}</p>}
            </div>
            <Button type="submit" disabled={formLoading} className="w-full bg-green-600 hover:bg-green-700">
              {formLoading ? "Saving..." : "Confirm Payment"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 w-full max-w-md mx-auto">
          <DialogHeader className=""><DialogTitle className="text-white">Payment Receipt</DialogTitle></DialogHeader>
          {receiptCustomer && receiptCustomer.payment && (
            <Receipt customer={receiptCustomer} payment={receiptCustomer.payment} onClose={() => setIsReceiptOpen(false)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Print Dialog */}
      <Dialog open={isPrintOpen} onOpenChange={setIsPrintOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 w-full max-w-md mx-auto">
          <DialogHeader className=""><DialogTitle className="text-white">Print Receipt</DialogTitle></DialogHeader>
          {printCustomer && printCustomer.payment && (
            <Receipt customer={printCustomer} payment={printCustomer.payment} onClose={() => setIsPrintOpen(false)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Remove Payment Dialog */}
      <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 w-full max-w-sm mx-auto">
          <AlertDialogHeader className="">
            <AlertDialogTitle className="text-white">Remove Payment?</AlertDialogTitle>
            <AlertDialogDescription className="" asChild>
              <div className="space-y-3">
                <p className="text-slate-400">This will remove the payment record for:</p>
                {customerToRemove && (
                  <div className="bg-slate-800 rounded-lg p-3 space-y-1">
                    <div className="flex justify-between text-sm"><span className="text-slate-400">Name</span><span className="text-white font-medium">{customerToRemove.name}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-400">Box Number</span><span className="text-white font-medium">{customerToRemove.box_number}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-400">Amount</span><span className="text-white font-medium">₹{customerToRemove.payment?.amount}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-400">Paid Date</span><span className="text-white font-medium">{customerToRemove.payment?.paid_date}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-400">Mode</span><span className="text-white font-medium">{customerToRemove.payment?.payment_mode === "gpay" ? "GPay" : "Cash"}</span></div>
                  </div>
                )}
                <p className="text-red-400 text-sm">This action cannot be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="">
            <AlertDialogCancel className="border-slate-700 text-slate-300 hover:bg-slate-800">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnmarkPaid} className="bg-red-600 hover:bg-red-700 text-white">Yes, Remove Payment</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

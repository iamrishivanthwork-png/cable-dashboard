import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Customer, Payment } from "@/types"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { toast } from "sonner"
import { Printer } from "lucide-react"

interface ReceiptProps {
  customer: Customer
  payment: Payment
  onClose: () => void
}

export default function Receipt ({ customer, payment, onClose }: ReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null)

  async function handleDownloadPDF () {
    if (!receiptRef.current) return

    const canvas = await html2canvas(receiptRef.current, {
      scale: 3,
      backgroundColor: "#ffffff",
      useCORS: true,
    })

    const imgData = canvas.toDataURL("image/png")

    const pageWidth = 58
    const imgHeight = (canvas.height * pageWidth) / canvas.width

    // Create PDF with exact content height — no extra space
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [pageWidth, imgHeight],
    })

    pdf.addImage(imgData, "PNG", 0, 0, pageWidth, imgHeight)
    pdf.save(`Receipt-${payment.bill_number}.pdf`)
  }

  async function handlePrintBluetooth () {
    if (!receiptRef.current) return

    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
      })

      const imgData = canvas.toDataURL("image/png")
      // RawBT URL scheme — opens RawBT app and prints
      window.location.href = `rawbt:base64,${imgData.split(",")[1]}`
      toast.success("Sending to RawBT printer...")
    } catch (err) {
      toast.error("Failed to send to printer")
    }
  }

  return (
    <div className="space-y-4">
      {/* Receipt Preview */}
      <div
        ref={receiptRef}
        className="bg-white text-black p-3 rounded-lg mx-auto"
        style={{
          fontFamily: "monospace",
          width: "220px", // Approx 58mm on screen
          fontSize: "11px",
        }}
      >
        {/* Header */}
        <div className="text-center border-b border-dashed border-black pb-2 mb-2">
          <p className="font-bold text-sm uppercase tracking-wide">R.K.R NET COM</p>
          <p className="text-xs">Digital Cable Tv & Broad Band</p>
          <p className="text-xs">Kasukkadai St, Thiruthuraipoondi</p>
          <p className="text-xs">Thiruvarur District</p>
        </div>

        {/* Bill Info */}
        <div className="flex justify-between mb-1">
          <span className="text-xs">Bill No:</span>
          <span className="text-xs font-bold">{payment.bill_number}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-xs">Date:</span>
          <span className="text-xs font-bold">{payment.paid_date}</span>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-black mb-2" />

        {/* Customer Details */}
        <p className="text-xs font-bold uppercase mb-1">Customer</p>
        <div className="flex justify-between mb-1">
          <span className="text-xs text-gray-600">Name</span>
          <span className="text-xs font-medium">{customer.name}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span className="text-xs text-gray-600">Box No</span>
          <span className="text-xs font-medium">{customer.box_number}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span className="text-xs text-gray-600">Street</span>
          <span className="text-xs font-medium">{customer.street}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-xs text-gray-600">Town</span>
          <span className="text-xs font-medium">{customer.town}</span>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-black mb-2" />

        {/* Payment Details */}
        <p className="text-xs font-bold uppercase mb-1">Payment</p>
        <div className="flex justify-between mb-1">
          <span className="text-xs text-gray-600">Month</span>
          <span className="text-xs font-medium">{payment.month}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-xs text-gray-600">Mode</span>
          <span className="text-xs font-medium">
            {payment.payment_mode === "gpay" ? "GPay" : "Cash"}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-black mb-2" />

        {/* Total */}
        <div className="flex justify-between mb-2">
          <span className="text-sm font-bold">TOTAL</span>
          <span className="text-sm font-bold">Rs.{payment.amount}/-</span>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-black mb-2" />

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs">Thank you!</p>
          <p className="text-xs text-gray-500">Computer generated receipt</p>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handlePrintBluetooth}
          className="bg-green-600 hover:bg-green-700"
        >
          <Printer />
        </Button>
        <Button
          onClick={handleDownloadPDF}
          className="flex-1 bg-blue-600 hover:bg-blue-700"
        >
          Download & Print
        </Button>
        <Button
          variant="outline"
          onClick={onClose}
          className="flex-1 border-slate-700 text-slate-300"
        >
          Close
        </Button>
      </div>
    </div>
  )
}

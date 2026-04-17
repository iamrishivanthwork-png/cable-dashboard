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

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [pageWidth, imgHeight], // exact content height
    })

    pdf.addImage(imgData, "PNG", 0, 0, pageWidth, imgHeight)
    pdf.save(`Receipt-${payment.bill_number}.pdf`)
  }

  async function handlePrintBluetooth () {
    if (!receiptRef.current) return

    try {
      toast.success("Generating receipt...")

      const canvas = await html2canvas(receiptRef.current, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
      })

      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error("Failed to generate receipt")
          return
        }

        // Try POS Printer app URL scheme
        const url = URL.createObjectURL(blob)

        // Create a temporary download link and share
        const a = document.createElement("a")
        a.href = url
        a.download = `receipt-${payment.bill_number}.png`

        // Use Web Share API if available (shows share sheet on Android)
        if (navigator.share) {
          const file = new File([blob], `receipt-${payment.bill_number}.png`, { type: "image/png" })
          navigator.share({
            title: `Receipt ${payment.bill_number}`,
            files: [file],
          }).then(() => {
            toast.success("Share sheet opened — select your printer app!")
          }).catch(() => {
            // Fallback to download
            a.click()
            toast.success("Receipt saved — open it to print!")
          })
        } else {
          // Fallback — just download the image
          a.click()
          toast.success("Receipt downloaded — open with your printer app!")
        }

        setTimeout(() => URL.revokeObjectURL(url), 30000)
      }, "image/png")

    } catch (err: any) {
      toast.error("Failed: " + err.message)
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
        <div className="text-center border-b border-dashed border-black pb-2 mb-2 leading-tight">
          <p className="font-bold text-sm uppercase tracking-wide">R.K.R NET COM</p>
          <p className="text-[10px]">Digital Cable Tv & Broad Band</p>
          <p className="text-[10px]">Kasukkadai St, Thiruthuraipoondi</p>
          <p className="text-[10px]">Thiruvarur District 614713</p>
        </div>

        {/* Bill Info */}
        <div className="flex justify-between mb-1">
          <span className="text-xs font-bold">Bill No:</span>
          <span className="text-xs font-bold">{payment.bill_number}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-xs font-bold">Date:</span>
          <span className="text-xs font-bold">{payment.paid_date}</span>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-black mb-2" />

        {/* Customer Details */}
        <p className="text-xs font-bold uppercase mb-1">Customer</p>
        <div className="flex justify-between mb-1">
          <span className="text-xs font-bold ">Name</span>
          <span className="text-xs font-bold">{customer.name}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span className="text-xs  font-bold">Box No</span>
          <span className="text-xs font-bold">{customer.box_number}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span className="text-xs  font-bold">Street</span>
          <span className="text-xs font-bold">{customer.street}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-xs  font-bold">Town</span>
          <span className="text-xs font-bold">{customer.town}</span>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-black mb-2" />

        {/* Payment Details */}
        <p className="text-xs font-bold uppercase mb-1">Payment</p>
        <div className="flex justify-between mb-1">
          <span className="text-xs font-bold">Month</span>
          <span className="text-xs font-bold">{payment.month}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-xs font-bold">Mode</span>
          <span className="text-xs font-bold">
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
          <p className="text-xs font-bold">Thank you!</p>
          <p className="text-xs text-gray-500 font-bold">Computer generated receipt</p>
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

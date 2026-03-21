import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Customer, Payment } from "@/types"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"

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
    const pdf = new jsPDF("p", "mm", "a5")

    const pageWidth = 148  // A5 width in mm
    const pageHeight = 210 // A5 height in mm

    const imgWidth = pageWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    // If content is taller than A5, scale it down to fit
    if (imgHeight > pageHeight) {
      const scaleFactor = pageHeight / imgHeight
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth * scaleFactor, pageHeight)
    } else {
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight)
    }

    pdf.save(`Receipt-${payment.bill_number}.pdf`)
  }



  return (
    <div className="space-y-4">
      {/* Receipt Preview */}
      <div
        ref={receiptRef}
        className="bg-white text-black p-6 rounded-lg"
        style={{ fontFamily: "Arial, sans-serif", minWidth: "320px" }}
      >
        {/* Header */}
        <div className="text-center border-b-2 border-black pb-4 mb-4">
          <h1 className="text-xl font-bold uppercase">R.K.R NET COM</h1>
          <p className="text-sm text-gray-600">Digital Cable Tv & Broad Band</p>
          <p className="text-xs text-gray-500 mt-1">Kasukkadai Street, Thiruthuraipoondi, Thiruvarur District.</p>
          <p className="text-xs text-gray-500">Phone: +91 XXXXX XXXXX</p>
        </div>

        {/* Bill Info */}
        <div className="flex justify-between mb-4">
          <div>
            <p className="text-xs text-gray-500">Bill Number</p>
            <p className="font-bold text-sm">{payment.bill_number}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Date</p>
            <p className="font-bold text-sm">{payment.paid_date}</p>
          </div>
        </div>

        {/* Customer Details */}
        <div className="bg-gray-50 rounded p-3 mb-4">
          <p className="text-xs text-gray-500 mb-2 font-semibold uppercase">Customer Details</p>
          <div className="grid grid-cols-2 gap-1 text-sm">
            <p className="text-gray-500">Name</p>
            <p className="font-medium">{customer.name}</p>
            <p className="text-gray-500">Box Number</p>
            <p className="font-medium">{customer.box_number}</p>
            <p className="text-gray-500">Street</p>
            <p className="font-medium">{customer.street}</p>
            <p className="text-gray-500">Town</p>
            <p className="font-medium">{customer.town}</p>
          </div>
        </div>

        {/* Payment Details */}
        <div className="border-t border-b border-gray-200 py-3 mb-4">
          <p className="text-xs text-gray-500 mb-2 font-semibold uppercase">Payment Details</p>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Month</span>
            <span className="font-medium">{payment.month}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Payment Mode</span>
            <span className="font-medium capitalize">
              {payment.payment_mode === "gpay" ? "GPay" : "Cash"}
            </span>
          </div>
          <div className="flex justify-between text-lg font-bold mt-2">
            <span>Total Amount</span>
            <span>₹{payment.amount}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400">
          <p>Thank you for your payment!</p>
          <p className="mt-1">This is a computer generated receipt.</p>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleDownloadPDF}
          className="flex-1 bg-blue-600 hover:bg-blue-700"
        >
          Download PDF
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

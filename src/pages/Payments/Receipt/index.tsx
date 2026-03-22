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
      // Request Bluetooth device
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { services: ["000018f0-0000-1000-8000-00805f9b34fb"] },
        ],
        optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb"],
      })

      toast.success("Connecting to printer...")

      const server = await device.gatt.connect()
      const service = await server.getPrimaryService("000018f0-0000-1000-8000-00805f9b34fb")
      const characteristic = await service.getCharacteristic("00002af1-0000-1000-8000-00805f9b34fb")

      // Generate receipt image
      const canvas = await html2canvas(receiptRef.current, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
      })

      // ESC/POS commands
      const ESC = 0x1b
      const GS = 0x1d

      // Initialize printer
      const init = new Uint8Array([ESC, 0x40])

      // Center align
      const center = new Uint8Array([ESC, 0x61, 0x01])

      // Print image using canvas
      const width = canvas.width
      const height = canvas.height
      const ctx = canvas.getContext("2d")!
      const imageData = ctx.getImageData(0, 0, width, height)

      // Convert to printer bitmap
      const widthBytes = Math.ceil(width / 8)
      const imgCmd = new Uint8Array(8 + widthBytes * height)
      imgCmd[0] = GS
      imgCmd[1] = 0x76
      imgCmd[2] = 0x30
      imgCmd[3] = 0x00
      imgCmd[4] = widthBytes & 0xff
      imgCmd[5] = (widthBytes >> 8) & 0xff
      imgCmd[6] = height & 0xff
      imgCmd[7] = (height >> 8) & 0xff

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < widthBytes; x++) {
          let byte = 0
          for (let bit = 0; bit < 8; bit++) {
            const px = (y * width + x * 8 + bit) * 4
            const r = imageData.data[px]
            const g = imageData.data[px + 1]
            const b = imageData.data[px + 2]
            const brightness = (r + g + b) / 3
            if (brightness < 128) byte |= (0x80 >> bit)
          }
          imgCmd[8 + y * widthBytes + x] = byte
        }
      }

      // Feed and cut
      const feed = new Uint8Array([ESC, 0x64, 0x05])
      const cut = new Uint8Array([GS, 0x56, 0x42, 0x00])

      // Send in chunks (BLE has 512 byte limit per write)
      async function sendChunked (data: Uint8Array) {
        const chunkSize = 512
        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize)
          await characteristic.writeValueWithoutResponse(chunk)
          await new Promise((r) => setTimeout(r, 50))
        }
      }

      await sendChunked(init)
      await sendChunked(center)
      await sendChunked(imgCmd)
      await sendChunked(feed)
      await sendChunked(cut)

      toast.success("Printed successfully!")
      device.gatt.disconnect()

    } catch (err: any) {
      if (err.name === "NotFoundError") {
        toast.error("No printer selected")
      } else {
        toast.error("Print failed: " + err.message)
      }
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

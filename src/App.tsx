import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

function App() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center gap-4">
      <Button>Mark as Paid</Button>
      <Badge variant="destructive">Unpaid</Badge>
      <Badge className="bg-green-600">Paid</Badge>
    </div>
  )
}

export default App

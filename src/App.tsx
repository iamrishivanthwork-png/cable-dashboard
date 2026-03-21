import { BrowserRouter, Routes, Route } from "react-router-dom"
import Sidebar from "@/components/layout/index"
import Customers from "@/pages/Customers"
import Payments from "@/pages/Payments"
import Dashboard from "./pages/dashboard"

function App () {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-slate-950">
        <Sidebar />
        <main className="flex-1 p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/payments" element={<Payments />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App

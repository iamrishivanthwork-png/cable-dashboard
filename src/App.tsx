import { useEffect, useState } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { Toaster } from "sonner"
import Sidebar from "@/components/layout/index"
import Customers from "@/pages/Customers"
import Payments from "@/pages/Payments"
import Dashboard from "@/pages/dashboard"
import Login from "@/pages/Login"
import CustomerDetail from "./pages/CustomerDetail"
import PaidReports from "./pages/PaidReports"
import Analytics from "./pages/Analytics"

function App () {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Loading...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <BrowserRouter>
        <Toaster richColors position="top-right" />
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
      </BrowserRouter>
    )
  }

  return (
    <BrowserRouter>
      <Toaster richColors position="top-right" />
      <div className="flex min-h-screen bg-slate-950">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/reports" element={<PaidReports />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App

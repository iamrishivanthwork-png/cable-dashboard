import { LayoutDashboard, Users, CreditCard } from "lucide-react"
import { Link, useLocation } from "react-router-dom"

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Users, label: "Customers", href: "/customers" },
  { icon: CreditCard, label: "Payments", href: "/payments" },
]

export default function Sidebar () {
  const location = useLocation()

  return (
    <aside className="w-64 min-h-screen bg-slate-900 border-r border-slate-800 p-4">
      <div className="mb-8">
        <h1 className="text-white font-bold text-xl">Cable Manager</h1>
        <p className="text-slate-400 text-sm">Payment Tracker</p>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${location.pathname === item.href
              ? "bg-slate-700 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}

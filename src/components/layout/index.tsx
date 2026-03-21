import { LayoutDashboard, Users, CreditCard, LogOut } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { signOut } from "@/lib/auth"

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Users, label: "Customers", href: "/customers" },
  { icon: CreditCard, label: "Payments", href: "/payments" },
]

export default function Sidebar () {
  const location = useLocation()

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 min-h-screen bg-slate-900 border-r border-slate-800 p-4 flex-col">
        <div className="mb-8">
          <h1 className="text-white font-bold text-xl">Cable Manager</h1>
          <p className="text-slate-400 text-sm">Payment Tracker</p>
        </div>
        <nav className="space-y-1 flex-1">
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
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors mt-4"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 flex items-center justify-around px-2 py-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={`flex flex-col items-center gap-1 px-4 py-1 rounded-md transition-colors ${location.pathname === item.href
                ? "text-blue-400"
                : "text-slate-400 hover:text-white"
              }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-xs">{item.label}</span>
          </Link>
        ))}
        <button
          onClick={signOut}
          className="flex flex-col items-center gap-1 px-4 py-1 rounded-md text-slate-400 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-xs">Logout</span>
        </button>
      </nav>
    </>
  )
}

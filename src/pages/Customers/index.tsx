import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Customer } from "@/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Pencil, Trash2, Copy } from "lucide-react"
import { toast } from "sonner"
import CustomerForm, { CustomerFormData } from "./CustomerForm"

export default function Customers () {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [townFilter, setTownFilter] = useState("all")
  const [streetFilter, setStreetFilter] = useState("all")
  const [towns, setTowns] = useState<string[]>([])
  const [streets, setStreets] = useState<string[]>([])
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
  const [formLoading, setFormLoading] = useState(false)

  useEffect(() => {
    fetchCustomers()
  }, [])

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

  async function fetchCustomers () {
    setLoading(true)
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false })

    if (!error && data) {
      setCustomers(data)
      const uniqueTowns = [...new Set(data.map((c) => c.town))]
      setTowns(uniqueTowns)
    }
    setLoading(false)
  }

  async function handleAdd (data: CustomerFormData) {
    setFormLoading(true)
    const { error } = await supabase.from("customers").insert([data])
    if (!error) {
      await fetchCustomers()
      setIsAddOpen(false)
      toast.success("Customer added successfully!")
    } else {
      toast.error("Failed to add customer")
    }
    setFormLoading(false)
  }

  async function handleEdit (data: CustomerFormData) {
    if (!selectedCustomer) return
    setFormLoading(true)
    const { error } = await supabase
      .from("customers")
      .update(data)
      .eq("id", selectedCustomer.id)
    if (!error) {
      await fetchCustomers()
      setIsEditOpen(false)
      toast.success("Customer updated!")
    } else {
      toast.error("Failed to update customer")
    }
    setFormLoading(false)
  }

  async function confirmDelete () {
    if (!customerToDelete) return
    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", customerToDelete.id)
    if (!error) {
      await fetchCustomers()
      toast.success("Customer deleted")
    } else {
      toast.error("Failed to delete customer")
    }
    setIsDeleteOpen(false)
    setCustomerToDelete(null)
  }

  const filtered = customers.filter((c) => {
    const townMatch = townFilter === "all" || c.town === townFilter
    const streetMatch = streetFilter === "all" || c.street === streetFilter
    const searchMatch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.box_number.toLowerCase().includes(search.toLowerCase())
    return townMatch && streetMatch && searchMatch
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Customers</h1>
          <p className="text-slate-400 text-sm mt-1">{customers.length} total customers</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Search + Town Filter */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <Input
          type="text"
          placeholder="Search by name or box number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-slate-800 border-slate-700 text-white max-w-sm"
        />
        <Select value={townFilter} onValueChange={setTownFilter}>
          <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-white">
            <SelectValue placeholder="All Towns" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-white">All Towns</SelectItem>
            {towns.map((town) => (
              <SelectItem key={town} value={town} className="text-white">{town}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Street Tabs */}
      {townFilter !== "all" && streets.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setStreetFilter("all")}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${streetFilter === "all" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
          >
            All Streets
          </button>
          {streets.map((street) => (
            <button
              key={street}
              onClick={() => setStreetFilter(street)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${streetFilter === street ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
            >
              {street}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-slate-400">No customers found.</p>
      ) : (
        <div className="rounded-lg border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800">
              <tr>
                <th className="text-left text-slate-400 px-4 py-3">Name</th>
                <th className="text-left text-slate-400 px-4 py-3">Box Number</th>
                <th className="text-left text-slate-400 px-4 py-3">Street</th>
                <th className="text-left text-slate-400 px-4 py-3">Town</th>
                <th className="text-left text-slate-400 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer, index) => (
                <tr key={customer.id} className={index % 2 === 0 ? "bg-slate-900" : "bg-slate-950"}>
                  <td className="text-white px-4 py-3">{customer.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-slate-300 border-slate-600">
                        {customer.box_number}
                      </Badge>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(customer.box_number)
                          toast.success(`Copied: ${customer.box_number}`)
                        }}
                        className="text-slate-500 hover:text-white transition-colors"
                        title="Copy box number"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="text-slate-300 px-4 py-3">{customer.street}</td>
                  <td className="text-slate-300 px-4 py-3">{customer.town}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedCustomer(customer)
                          setIsEditOpen(true)
                        }}
                        className="text-slate-400 hover:text-white"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setCustomerToDelete(customer)
                          setIsDeleteOpen(true)
                        }}
                        className="text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Customer Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader className={"add-new-header"}>
            <DialogTitle className="text-white">Add New Customer</DialogTitle>
          </DialogHeader>
          <CustomerForm onSubmit={handleAdd} isLoading={formLoading} />
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader className={"edit-header"}>
            <DialogTitle className="text-white">Edit Customer</DialogTitle>
          </DialogHeader>
          <CustomerForm
            onSubmit={handleEdit}
            defaultValues={selectedCustomer ?? undefined}
            isLoading={formLoading}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader className={"delete-header"}>
            <AlertDialogTitle className="text-white">Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription className={"child-data"} asChild>
              <div className="space-y-3">
                <p className="text-slate-400">This will permanently delete:</p>
                {customerToDelete && (
                  <div className="bg-slate-800 rounded-lg p-3 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Name</span>
                      <span className="text-white font-medium">{customerToDelete.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Box Number</span>
                      <span className="text-white font-medium">{customerToDelete.box_number}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Street</span>
                      <span className="text-white font-medium">{customerToDelete.street}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Town</span>
                      <span className="text-white font-medium">{customerToDelete.town}</span>
                    </div>
                  </div>
                )}
                <p className="text-red-400 text-sm">This action cannot be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={"footer"}>
            <AlertDialogCancel className="border-slate-700 text-slate-300 hover:bg-slate-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

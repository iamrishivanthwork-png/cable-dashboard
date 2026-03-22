import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Customer } from "@/types"

const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  box_number: z.string().min(1, "Box number is required"),
  street: z.string().min(1, "Street is required"),
  town: z.string().min(1, "Town is required"),
  mobile: z.string().length(10, "Mobile must be 10 digits").or(z.literal("")).optional(),
})

export type CustomerFormData = z.infer<typeof customerSchema>

interface CustomerFormProps {
  onSubmit: (data: CustomerFormData) => void
  defaultValues?: Partial<Customer>
  isLoading?: boolean
}

export default function CustomerForm ({ onSubmit, defaultValues, isLoading }: CustomerFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      box_number: defaultValues?.box_number ?? "",
      street: defaultValues?.street ?? "",
      town: defaultValues?.town ?? "",
      mobile: defaultValues?.mobile ?? "",
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
      <div>
        <label className="text-sm text-slate-300 mb-1 block">Customer Name</label>
        <Input
          type="text"
          {...register("name")}
          placeholder="Ex: Ravi Kumar"
          className="bg-slate-800 border-slate-700 text-white"
        />
        {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <label className="text-sm text-slate-300 mb-1 block">
          Mobile Number <span className="text-slate-500">(optional)</span>
        </label>
        <Input
          type="tel"
          {...register("mobile")}
          placeholder="Ex: 9876543210"
          className="bg-slate-800 border-slate-700 text-white"
          maxLength={10}
        />
        {errors.mobile && <p className="text-red-400 text-xs mt-1">{errors.mobile.message}</p>}
      </div>

      <div>
        <label className="text-sm text-slate-300 mb-1 block">Box Number (GTPL ID)</label>
        <Input
          type="text"
          {...register("box_number")}
          placeholder="Ex: GTPL-1234"
          className="bg-slate-800 border-slate-700 text-white"
        />
        {errors.box_number && <p className="text-red-400 text-xs mt-1">{errors.box_number.message}</p>}
      </div>

      <div>
        <label className="text-sm text-slate-300 mb-1 block">Street</label>
        <Input
          type="text"
          {...register("street")}
          placeholder="Ex: Gandhi Street"
          className="bg-slate-800 border-slate-700 text-white"
        />
        {errors.street && <p className="text-red-400 text-xs mt-1">{errors.street.message}</p>}
      </div>

      <div>
        <label className="text-sm text-slate-300 mb-1 block">Town</label>
        <Input
          type="text"
          {...register("town")}
          placeholder="Ex: Rajkot"
          className="bg-slate-800 border-slate-700 text-white"
        />
        {errors.town && <p className="text-red-400 text-xs mt-1">{errors.town.message}</p>}
      </div>

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        {isLoading ? "Saving..." : "Save Customer"}
      </Button>
    </form>
  )
}

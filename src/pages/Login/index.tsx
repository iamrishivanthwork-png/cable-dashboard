import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { signIn } from "@/lib/auth"
import { toast } from "sonner"

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function Login () {
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit (data: LoginFormData) {
    setLoading(true)
    const { error } = await signIn(data.email, data.password)
    if (error) {
      toast.error("Invalid email or password")
    } else {
      toast.success("Welcome back!")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-white text-2xl font-bold">Cable Manager</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to your dashboard</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm text-slate-300 mb-1 block">Email</label>
            <Input
              {...register("email")}
              type="email"
              placeholder="your@email.com"
              className="bg-slate-800 border-slate-700 text-white"
            />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="text-sm text-slate-300 mb-1 block">Password</label>
            <Input
              {...register("password")}
              type="password"
              placeholder="••••••••"
              className="bg-slate-800 border-slate-700 text-white"
            />
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  )
}

export interface Customer {
  id: string
  name: string
  box_number: string
  street: string
  town: string
  mobile: string | null
  created_at: string
}

export interface Payment {
  id: string
  customer_id: string
  month: string
  paid_at: string
  paid_date: string
  amount: number
  payment_mode: "cash" | "gpay"
  bill_number: string
  recorded_by: string | null
}

export interface Profile {
  id: string
  full_name: string
  role: string
}

export interface PendingPayment {
  id: string
  customer_id: string
  month: string
  note: string
  created_at: string
}


export interface PaymentLog {
  id: string
  payment_id: string | null
  customer_id: string
  action: "paid" | "undo"
  amount: number | null
  payment_mode: string | null
  month: string | null
  bill_number: string | null
  performed_by: string | null
  performed_at: string
}

export interface Customer {
  id: string
  name: string
  box_number: string
  street: string
  town: string
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
}

export interface PendingPayment {
  id: string
  customer_id: string
  month: string
  note: string
  created_at: string
}

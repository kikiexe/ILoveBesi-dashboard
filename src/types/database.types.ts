export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      cashier_shifts: {
        Row: {
          cashier_name: string
          closed_at: string | null
          created_at: string
          id: string
          opened_at: string
          opening_cash: number
          owner_id: string
          status: "OPEN" | "CLOSED"
          total_kredit: number
          total_qris: number
          total_sales: number
          total_tunai: number
        }
        Insert: {
          cashier_name: string
          closed_at?: string | null
          created_at?: string
          id?: string
          opened_at?: string
          opening_cash?: number
          owner_id?: string
          status?: "OPEN" | "CLOSED"
          total_kredit?: number
          total_qris?: number
          total_sales?: number
          total_tunai?: number
        }
        Update: {
          cashier_name?: string
          closed_at?: string | null
          created_at?: string
          id?: string
          opened_at?: string
          opening_cash?: number
          owner_id?: string
          status?: "OPEN" | "CLOSED"
          total_kredit?: number
          total_qris?: number
          total_sales?: number
          total_tunai?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          code: string
          created_at: string
          credit_limit: number
          id: string
          name: string
          owner_id: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          credit_limit?: number
          id?: string
          name: string
          owner_id?: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          credit_limit?: number
          id?: string
          name?: string
          owner_id?: string
          phone?: string | null
        }
        Relationships: []
      }
      operational_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string
          expense_date: string
          id: string
          notes: string | null
          owner_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by: string
          expense_date?: string
          id?: string
          notes?: string | null
          owner_id?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string
          expense_date?: string
          id?: string
          notes?: string | null
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          avg_cost_price: number
          created_at: string
          dimension: string
          id: string
          is_active: boolean
          name: string
          owner_id: string
          sell_price: number
          sku: string
          stock_qty: number
          thickness_mm: number
          unit: string
          include_ppn?: boolean
          updated_at: string
        }
        Insert: {
          avg_cost_price?: number
          created_at?: string
          dimension?: string
          id?: string
          is_active?: boolean
          name: string
          owner_id?: string
          sell_price?: number
          sku: string
          stock_qty?: number
          thickness_mm?: number
          unit?: string
          include_ppn?: boolean
          updated_at?: string
        }
        Update: {
          avg_cost_price?: number
          created_at?: string
          dimension?: string
          id?: string
          is_active?: boolean
          name?: string
          owner_id?: string
          sell_price?: number
          sku?: string
          stock_qty?: number
          thickness_mm?: number
          unit?: string
          include_ppn?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          role: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          buy_price: number
          id: string
          product_id: string
          purchase_id: string
          qty: number
          subtotal: number
        }
        Insert: {
          buy_price: number
          id?: string
          product_id: string
          purchase_id: string
          qty: number
          subtotal: number
        }
        Update: {
          buy_price?: number
          id?: string
          product_id?: string
          purchase_id?: string
          qty?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_cashier_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invoice_number: string
          notes: string | null
          owner_id: string
          purchase_date: string
          supplier_id: string | null
          total_amount: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          invoice_number: string
          notes?: string | null
          owner_id?: string
          purchase_date?: string
          supplier_id?: string | null
          total_amount: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invoice_number?: string
          notes?: string | null
          owner_id?: string
          purchase_date?: string
          supplier_id?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      receivable_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          received_by: string
          sale_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          received_by: string
          sale_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          received_by?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivable_payments_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivable_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          cost_price_at_sale: number
          discount_pct: number
          id: string
          product_id: string
          qty: number
          sale_id: string
          subtotal: number
          tax_pct: number
          unit_price: number
        }
        Insert: {
          cost_price_at_sale: number
          discount_pct?: number
          id?: string
          product_id: string
          qty: number
          sale_id: string
          subtotal: number
          tax_pct?: number
          unit_price: number
        }
        Update: {
          cost_price_at_sale?: number
          discount_pct?: number
          id?: string
          product_id?: string
          qty?: number
          sale_id?: string
          subtotal?: number
          tax_pct?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_cashier_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cashier_id: string
          cashier_name: string | null
          created_at: string
          customer_id: string | null
          discount_amount: number
          due_date: string | null
          grand_total: number
          id: string
          invoice_number: string
          notes: string | null
          owner_id: string
          paid_amount: number
          payment_status: string
          payment_type: string
          remaining_debt: number
          sale_date: string
          shift_id: string | null
          subtotal_amount: number
          tax_amount: number
        }
        Insert: {
          cashier_id: string
          cashier_name?: string | null
          created_at?: string
          customer_id?: string | null
          discount_amount?: number
          due_date?: string | null
          grand_total: number
          id?: string
          invoice_number: string
          notes?: string | null
          owner_id?: string
          paid_amount?: number
          payment_status: string
          payment_type: string
          remaining_debt?: number
          sale_date?: string
          shift_id?: string | null
          subtotal_amount: number
          tax_amount?: number
        }
        Update: {
          cashier_id?: string
          cashier_name?: string | null
          created_at?: string
          customer_id?: string | null
          discount_amount?: number
          due_date?: string | null
          grand_total?: number
          id?: string
          invoice_number?: string
          notes?: string | null
          owner_id?: string
          paid_amount?: number
          payment_status?: string
          payment_type?: string
          remaining_debt?: number
          sale_date?: string
          shift_id?: string | null
          subtotal_amount?: number
          tax_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "cashier_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id?: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          phone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_cashier_products: {
        Row: {
          dimension: string | null
          id: string | null
          include_ppn: boolean | null
          is_active: boolean | null
          name: string | null
          owner_id: string | null
          sell_price: number | null
          sku: string | null
          stock_qty: number | null
          thickness_mm: number | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          dimension?: string | null
          id?: string | null
          include_ppn?: boolean | null
          is_active?: boolean | null
          name?: string | null
          owner_id?: string | null
          sell_price?: number | null
          sku?: string | null
          stock_qty?: number | null
          thickness_mm?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          dimension?: string | null
          id?: string | null
          include_ppn?: boolean | null
          is_active?: boolean | null
          name?: string | null
          owner_id?: string | null
          sell_price?: number | null
          sku?: string | null
          stock_qty?: number | null
          thickness_mm?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_my_role: { Args: never; Returns: string }
      rpc_create_sale: {
        Args: {
          p_customer_id?: string
          p_discount_amount?: number
          p_due_date?: string
          p_items?: Json
          p_notes?: string
          p_paid_amount?: number
          p_payment_type?: string
          p_tax_amount?: number
        }
        Returns: Json
      }
      rpc_pay_receivable: {
        Args: {
          p_amount: number
          p_notes?: string
          p_payment_method?: string
          p_sale_id: string
        }
        Returns: Json
      }
      rpc_record_purchase: {
        Args: {
          p_invoice_number: string
          p_items?: Json
          p_notes?: string
          p_purchase_date?: string
          p_supplier_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

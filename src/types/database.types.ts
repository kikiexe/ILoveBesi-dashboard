export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: 'owner' | 'cashier';
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          role: 'owner' | 'cashier';
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: 'owner' | 'cashier';
          created_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          sku: string;
          name: string;
          dimension: string;
          thickness_mm: number;
          unit: string;
          stock_qty: number;
          avg_cost_price: number;
          sell_price: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sku: string;
          name: string;
          dimension: string;
          thickness_mm: number;
          unit?: string;
          stock_qty?: number;
          avg_cost_price?: number;
          sell_price?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sku?: string;
          name?: string;
          dimension?: string;
          thickness_mm?: number;
          unit?: string;
          stock_qty?: number;
          avg_cost_price?: number;
          sell_price?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          code: string;
          name: string;
          phone: string | null;
          address: string | null;
          credit_limit: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          phone?: string | null;
          address?: string | null;
          credit_limit?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          phone?: string | null;
          address?: string | null;
          credit_limit?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      suppliers: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone?: string | null;
          address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string | null;
          address?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      purchases: {
        Row: {
          id: string;
          invoice_number: string;
          supplier_id: string | null;
          purchase_date: string;
          total_amount: number;
          notes: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_number: string;
          supplier_id?: string | null;
          purchase_date?: string;
          total_amount: number;
          notes?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_number?: string;
          supplier_id?: string | null;
          purchase_date?: string;
          total_amount?: number;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchases_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          }
        ];
      };
      purchase_items: {
        Row: {
          id: string;
          purchase_id: string;
          product_id: string;
          qty: number;
          buy_price: number;
          subtotal: number;
        };
        Insert: {
          id?: string;
          purchase_id: string;
          product_id: string;
          qty: number;
          buy_price: number;
          subtotal: number;
        };
        Update: {
          id?: string;
          purchase_id?: string;
          product_id?: string;
          qty?: number;
          buy_price?: number;
          subtotal?: number;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey";
            columns: ["purchase_id"];
            isOneToOne: false;
            referencedRelation: "purchases";
            referencedColumns: ["id"];
          }
        ];
      };
      sales: {
        Row: {
          id: string;
          invoice_number: string;
          sale_date: string;
          customer_id: string | null;
          payment_type: 'TUNAI' | 'KREDIT';
          payment_status: 'LUNAS' | 'BELUM_LUNAS';
          subtotal_amount: number;
          discount_amount: number;
          tax_amount: number;
          grand_total: number;
          paid_amount: number;
          remaining_debt: number;
          due_date: string | null;
          notes: string | null;
          cashier_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_number: string;
          sale_date?: string;
          customer_id?: string | null;
          payment_type: 'TUNAI' | 'KREDIT';
          payment_status: 'LUNAS' | 'BELUM_LUNAS';
          subtotal_amount: number;
          discount_amount?: number;
          tax_amount?: number;
          grand_total: number;
          paid_amount?: number;
          remaining_debt?: number;
          due_date?: string | null;
          notes?: string | null;
          cashier_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_number?: string;
          sale_date?: string;
          customer_id?: string | null;
          payment_type?: 'TUNAI' | 'KREDIT';
          payment_status?: 'LUNAS' | 'BELUM_LUNAS';
          subtotal_amount?: number;
          discount_amount?: number;
          tax_amount?: number;
          grand_total?: number;
          paid_amount?: number;
          remaining_debt?: number;
          due_date?: string | null;
          notes?: string | null;
          cashier_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sales_cashier_id_fkey";
            columns: ["cashier_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          }
        ];
      };
      sale_items: {
        Row: {
          id: string;
          sale_id: string;
          product_id: string;
          qty: number;
          unit_price: number;
          cost_price_at_sale: number;
          discount_pct: number;
          tax_pct: number;
          subtotal: number;
        };
        Insert: {
          id?: string;
          sale_id: string;
          product_id: string;
          qty: number;
          unit_price: number;
          cost_price_at_sale: number;
          discount_pct?: number;
          tax_pct?: number;
          subtotal: number;
        };
        Update: {
          id?: string;
          sale_id?: string;
          product_id?: string;
          qty?: number;
          unit_price?: number;
          cost_price_at_sale?: number;
          discount_pct?: number;
          tax_pct?: number;
          subtotal?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          }
        ];
      };
      receivable_payments: {
        Row: {
          id: string;
          sale_id: string;
          payment_date: string;
          amount: number;
          payment_method: 'TUNAI' | 'TRANSFER';
          notes: string | null;
          received_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          sale_id: string;
          payment_date?: string;
          amount: number;
          payment_method?: 'TUNAI' | 'TRANSFER';
          notes?: string | null;
          received_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          sale_id?: string;
          payment_date?: string;
          amount?: number;
          payment_method?: 'TUNAI' | 'TRANSFER';
          notes?: string | null;
          received_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "receivable_payments_received_by_fkey";
            columns: ["received_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receivable_payments_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          }
        ];
      };
      operational_expenses: {
        Row: {
          id: string;
          expense_date: string;
          category: string;
          amount: number;
          notes: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          expense_date?: string;
          category: string;
          amount: number;
          notes?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          expense_date?: string;
          category?: string;
          amount?: number;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "operational_expenses_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      v_cashier_products: {
        Row: {
          id: string;
          sku: string;
          name: string;
          dimension: string;
          thickness_mm: number;
          unit: string;
          stock_qty: number;
          sell_price: number;
          is_active: boolean;
          updated_at: string;
        };
      };
    };
    Functions: {
      get_my_role: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      rpc_record_purchase: {
        Args: {
          p_invoice_number: string;
          p_supplier_id: string;
          p_purchase_date?: string;
          p_notes?: string | null;
          p_items: Json;
        };
        Returns: Json;
      };
      rpc_create_sale: {
        Args: {
          p_customer_id?: string | null;
          p_payment_type?: 'TUNAI' | 'KREDIT';
          p_discount_amount?: number;
          p_tax_amount?: number;
          p_paid_amount?: number;
          p_due_date?: string | null;
          p_notes?: string | null;
          p_items: Json;
        };
        Returns: Json;
      };
      rpc_pay_receivable: {
        Args: {
          p_sale_id: string;
          p_amount: number;
          p_payment_method?: 'TUNAI' | 'TRANSFER';
          p_notes?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
      Database["public"]["Views"])
  ? (Database["public"]["Tables"] &
      Database["public"]["Views"])[PublicTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
  ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
  ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

/**
 * Shape of the public schema created by the files in supabase/migrations.
 * Hand-maintained: if you change the SQL, change this to match.
 */

export type OrderStatus = "confirmed" | "packing" | "shipped" | "delivered" | "cancelled";
export type DeliverySpeed = "standard" | "express";
/** Mirrors PaymentMethodId in src/lib/payments.ts and the orders check constraint. */
export type PaymentMethodName = "card" | "upi" | "apple_pay" | "google_pay" | "paypal";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  postcode: string | null;
  created_at: string;
  updated_at: string;
};

export type Order = {
  id: string;
  user_id: string;
  reference: string;
  status: OrderStatus;
  full_name: string;
  email: string;
  address1: string;
  address2: string | null;
  city: string;
  postcode: string;
  delivery_speed: DeliverySpeed;
  payment_method: PaymentMethodName;
  /** "Visa ending 4242", a UPI ID, or the wallet name. Never a full card number. */
  payment_detail: string | null;
  subtotal_pence: number;
  shipping_pence: number;
  total_pence: number;
  created_at: string;
};

export type OrderItem = {
  id: number;
  order_id: string;
  product_slug: string;
  product_name: string;
  unit_price_pence: number;
  quantity: number;
  line_total_pence: number;
};

export type ProductRow = {
  slug: string;
  name: string;
  brand: string;
  category: string;
  price_pence: number;
  was_price_pence: number | null;
  stock: number;
  low_stock_at: number;
  active: boolean;
  updated_at: string;
};

export type StockMovement = {
  id: number;
  product_slug: string;
  order_id: string | null;
  delta: number;
  reason: "sale" | "restock" | "adjustment" | "cancellation";
  note: string | null;
  created_at: string;
};

export type ReviewStatus = "published" | "hidden";

export type ReviewRow = {
  id: number;
  product_slug: string;
  user_id: string;
  author_name: string;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
  status: ReviewStatus;
  created_at: string;
  updated_at: string;
};

export type ReviewVote = {
  review_id: number;
  user_id: string;
  created_at: string;
};

/**
 * reviews_public: a review with its helpful count counted from review_votes,
 * plus whether the caller has already voted on it.
 */
export type ReviewPublic = ReviewRow & {
  helpful_count: number;
  voted_by_me: boolean;
};

/** product_ratings: the star breakdown for one product, totalled in the view. */
export type ProductRating = {
  product_slug: string;
  review_count: number;
  average_rating: number;
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
};

/** One row per basket line, as place_order() expects it. */
export type PlaceOrderItem = {
  slug: string;
  quantity: number;
};

export type PlaceOrderResult = {
  order_id: string;
  reference: string;
  subtotal_pence: number;
  shipping_pence: number;
  total_pence: number;
};

export type Database = {
  public: {
    Tables: {
      products: {
        Row: ProductRow;
        Insert: Omit<ProductRow, "updated_at"> & { updated_at?: string };
        Update: Partial<ProductRow>;
        Relationships: [];
      };
      stock_movements: {
        Row: StockMovement;
        Insert: Omit<StockMovement, "id" | "created_at"> & { created_at?: string };
        Update: Partial<Omit<StockMovement, "id">>;
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_slug_fkey";
            columns: ["product_slug"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["slug"];
          },
        ];
      };
      profiles: {
        Row: Profile;
        Insert: Partial<Omit<Profile, "id">> & { id: string };
        Update: Partial<Omit<Profile, "id" | "created_at">>;
        Relationships: [];
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, "id" | "reference" | "status" | "created_at"> & {
          id?: string;
          reference?: string;
          status?: OrderStatus;
          created_at?: string;
        };
        Update: Partial<Order>;
        Relationships: [];
      };
      order_items: {
        Row: OrderItem;
        Insert: Omit<OrderItem, "id" | "line_total_pence">;
        Update: Partial<Omit<OrderItem, "id" | "line_total_pence">>;
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: ReviewRow;
        // verified and status are set by triggers, never by the client.
        Insert: Omit<ReviewRow, "id" | "verified" | "status" | "created_at" | "updated_at">;
        // reviews_guard_derived() pins everything else back to its old value.
        Update: Partial<Pick<ReviewRow, "rating" | "title" | "body">>;
        Relationships: [
          {
            foreignKeyName: "reviews_product_slug_fkey";
            columns: ["product_slug"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["slug"];
          },
        ];
      };
      review_votes: {
        Row: ReviewVote;
        Insert: Omit<ReviewVote, "created_at"> & { created_at?: string };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "review_votes_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      low_stock: {
        Row: Pick<ProductRow, "slug" | "name" | "brand" | "category" | "stock" | "low_stock_at">;
        Relationships: [];
      };
      product_sales: {
        Row: {
          slug: string;
          name: string;
          stock: number;
          units_sold: number;
          revenue_pence: number;
        };
        Relationships: [];
      };
      reviews_public: {
        Row: ReviewPublic;
        Relationships: [];
      };
      product_ratings: {
        Row: ProductRating;
        Relationships: [];
      };
    };
    Functions: {
      place_order: {
        Args: {
          p_full_name: string;
          p_email: string;
          p_address1: string;
          p_address2: string | null;
          p_city: string;
          p_postcode: string;
          p_delivery_speed: DeliverySpeed;
          p_payment_method: PaymentMethodName;
          p_payment_detail: string | null;
          p_items: PlaceOrderItem[];
        };
        Returns: PlaceOrderResult[];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

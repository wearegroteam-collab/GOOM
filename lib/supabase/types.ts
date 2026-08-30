export type EventStatus = "draft" | "published" | "past";
export type VideoProvider = "youtube" | "vimeo" | "instagram" | "mp4" | "embed";
export type VideoAspectRatio = "auto" | "16:9" | "9:16" | "4:5" | "1:1";
export type HeroMediaType = "image" | "video";

export type EventRecord = {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  description: string | null;
  date: string | null;
  venue: string | null;
  address: string | null;
  city: string | null;
  image_url: string | null;
  info_banner_url?: string | null;
  hero_media_type?: HeroMediaType;
  hero_media_explicit?: boolean;
  ticket_url: string | null;
  showpass_widget_code: string | null;
  status: EventStatus;
  featured: boolean;
  capacity?: number | null;
  sales_enabled?: boolean;
  created_at: string;
  updated_at: string;
};

export type TicketTypeRecord = {
  id: string; event_id: string; name: string; description: string | null;
  price_cents: number; currency: string; quantity_total: number;
  quantity_sold: number; quantity_reserved: number; sales_start: string | null;
  sales_end: string | null; active: boolean; sort_order: number;
  created_at: string; updated_at: string;
};

export type OrderStatus = "pending" | "paid" | "failed" | "cancelled" | "refunded" | "partially_refunded";
export type OrderRecord = {
  id: string; public_token: string; order_number: string; event_id: string;
  customer_name: string; customer_email: string; customer_phone: string | null;
  subtotal_cents: number; fees_cents: number; total_cents: number; refunded_cents: number;
  currency: string; status: OrderStatus; payment_provider: string; payment_type: "sale" | "complimentary";
  provider_payment_id: string | null; provider_order_id: string | null;
  reservation_expires_at: string | null; email_sent_at: string | null;
  created_at: string; paid_at: string | null; cancelled_at: string | null; refunded_at: string | null;
};

export type OrderItemRecord = { id: string; order_id: string; ticket_type_id: string; quantity: number; unit_price_cents: number; total_cents: number; created_at: string };
export type TicketStatus = "active" | "used" | "cancelled" | "refunded";
export type TicketRecord = {
  id: string; order_id: string; event_id: string; ticket_type_id: string;
  ticket_number: string; verification_token: string; attendee_name: string | null;
  attendee_email: string | null; status: TicketStatus; checked_in_at: string | null;
  checked_in_by: string | null; created_at: string;
};

export type PaymentConnectionRecord = {
  id: string; provider: string; account_reference: string | null; account_name: string | null;
  location_reference: string | null; location_name: string | null; access_token_encrypted: string | null;
  refresh_token_encrypted: string | null; token_expires_at: string | null; connected: boolean;
  created_at: string; updated_at: string;
};
export type RefundRecord = { id: string; order_id: string; amount_cents: number; currency: string; status: "pending"|"completed"|"failed"; provider_refund_id: string|null; idempotency_key: string; created_by: string|null; created_at: string; completed_at: string|null };
export type PaymentWebhookEventRecord = { id: string; provider: string; provider_event_id: string; event_type: string; payload: Record<string, unknown>; processed_at: string|null; processing_error: string|null; created_at: string };

export type EventVideoRecord = {
  id: string;
  event_id: string;
  url: string;
  provider: VideoProvider;
  aspect_ratio: VideoAspectRatio;
  sort_order: number;
  created_at: string;
};

export type HomeBannerRecord = {
  id: string;
  title: string;
  alt_text: string;
  desktop_image_url: string;
  tablet_image_url: string | null;
  mobile_image_url: string | null;
  button_label: string | null;
  button_url: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ServiceRecord = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  icon: string | null;
  active: boolean;
  sort_order: number;
};

export type GalleryRecord = {
  id: string;
  image_url: string;
  caption: string | null;
  active: boolean;
  featured: boolean;
  sort_order: number;
  created_at: string;
};

export type SiteSettingRecord = { id: string; key: string; value: string | null };

export type AdminUserRecord = {
  user_id: string;
  email: string | null;
  active: boolean;
  created_at: string;
};

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      events: Table<EventRecord>;
      event_videos: Table<EventVideoRecord>;
      home_banners: Table<HomeBannerRecord>;
      services: Table<ServiceRecord>;
      gallery: Table<GalleryRecord>;
      site_settings: Table<SiteSettingRecord>;
      admin_users: Table<AdminUserRecord>;
      ticket_types: Table<TicketTypeRecord>;
      orders: Table<OrderRecord>;
      order_items: Table<OrderItemRecord>;
      tickets: Table<TicketRecord>;
      payment_connections: Table<PaymentConnectionRecord>;
      inventory_reservations: Table<Record<string, unknown>>;
      ticket_scans: Table<Record<string, unknown>>;
      payment_webhook_events: Table<PaymentWebhookEventRecord>;
      email_deliveries: Table<Record<string, unknown>>;
      refunds: Table<RefundRecord>;
      audit_logs: Table<Record<string, unknown>>;
    };
    Views: Record<string, never>;
    Functions: {
      create_ticket_order: { Args: { p_event_id: string; p_customer_name: string; p_customer_email: string; p_customer_phone: string; p_payment_provider: string; p_items: { ticket_type_id: string; quantity: number }[] }; Returns: { id: string; public_token: string; order_number: string; total_cents: number; currency: string; expires_at: string } };
      finalize_paid_ticket_order: { Args: { p_order_id: string; p_provider_payment_id: string; p_provider_order_id?: string | null }; Returns: Record<string, unknown> };
      fail_ticket_order: { Args: { p_order_id: string }; Returns: undefined };
      scan_ticket: { Args: { p_value: string; p_check_in?: boolean }; Returns: Record<string, unknown> };
      create_complimentary_tickets: { Args: { p_event_id: string; p_ticket_type_id: string; p_quantity: number; p_name: string; p_email: string }; Returns: { order_id: string; public_token: string; order_number: string } };
      finalize_ticket_refund: { Args: { p_provider_refund_id: string }; Returns: Record<string, unknown> };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type EventStatus = "draft" | "published" | "past";

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
  ticket_url: string | null;
  status: EventStatus;
  featured: boolean;
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
      services: Table<ServiceRecord>;
      gallery: Table<GalleryRecord>;
      site_settings: Table<SiteSettingRecord>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

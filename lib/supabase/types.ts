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
  created_at: string;
  updated_at: string;
};

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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

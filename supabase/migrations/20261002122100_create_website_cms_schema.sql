-- Phase 1: isolated Cafe Flow company website CMS schema.
-- This migration creates website-domain tables only. No POS/QR objects are altered.

CREATE TABLE public.website_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  seo_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.website_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_path text NOT NULL,
  title text,
  caption text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.website_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  contact_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  opening_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  latitude numeric(10,7),
  longitude numeric(10,7),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.website_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  phone text,
  whatsapp text,
  address text,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.website_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name text NOT NULL DEFAULT 'Cafe Flow',
  tagline text,
  logo_path text,
  favicon_path text,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  seo_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.website_careers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department text,
  location text,
  employment_type text,
  description text NOT NULL,
  requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX website_pages_status_idx ON public.website_pages (status);
CREATE INDEX website_gallery_active_sort_idx ON public.website_gallery (is_active, sort_order);
CREATE INDEX website_locations_active_idx ON public.website_locations (is_active);
CREATE INDEX website_careers_active_idx ON public.website_careers (is_active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_pages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_gallery TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_careers TO authenticated;

ALTER TABLE public.website_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_careers ENABLE ROW LEVEL SECURITY;

CREATE POLICY website_pages_authenticated_crud ON public.website_pages
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY website_gallery_authenticated_crud ON public.website_gallery
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY website_locations_authenticated_crud ON public.website_locations
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY website_contacts_authenticated_crud ON public.website_contacts
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY website_settings_authenticated_crud ON public.website_settings
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY website_careers_authenticated_crud ON public.website_careers
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

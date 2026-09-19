export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          body: string | null
          created_at: string
          id: string
          rating: number
          status: string
          title: string | null
          tool_slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          rating: number
          status?: string
          title?: string | null
          tool_slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          rating?: number
          status?: string
          title?: string | null
          tool_slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admins: {
        Row: { created_at: string; user_id: string }
        Insert: { created_at?: string; user_id: string }
        Update: { created_at?: string; user_id?: string }
        Relationships: []
      }
      tools: {
        Row: {
          created_at: string
          data: Json
          published: boolean
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: Json
          published?: boolean
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          published?: boolean
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          status?: string
        }
        Relationships: []
      }
      collections: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      collection_items: {
        Row: {
          collection_id: string
          created_at: string
          note: string | null
          tool_slug: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          note?: string | null
          tool_slug: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          note?: string | null
          tool_slug?: string
        }
        Relationships: []
      }
      tool_submissions: {
        Row: {
          category_slug: string | null
          created_at: string
          id: string
          name: string
          pitch: string | null
          status: string
          submitter_email: string | null
          url: string
        }
        Insert: {
          category_slug?: string | null
          created_at?: string
          id?: string
          name: string
          pitch?: string | null
          status?: string
          submitter_email?: string | null
          url: string
        }
        Update: {
          category_slug?: string | null
          created_at?: string
          id?: string
          name?: string
          pitch?: string | null
          status?: string
          submitter_email?: string | null
          url?: string
        }
        Relationships: []
      }
      saved_tools: {
        Row: {
          created_at: string
          tool_slug: string
          user_id: string
        }
        Insert: {
          created_at?: string
          tool_slug: string
          user_id: string
        }
        Update: {
          created_at?: string
          tool_slug?: string
          user_id?: string
        }
        Relationships: []
      }
      outbound_clicks: {
        Row: {
          created_at: string
          id: number
          path: string | null
          tool_slug: string
        }
        Insert: {
          created_at?: string
          id?: never
          path?: string | null
          tool_slug: string
        }
        Update: {
          created_at?: string
          id?: never
          path?: string | null
          tool_slug?: string
        }
        Relationships: []
      }
      news_sources: {
        Row: {
          id: string
          name: string
          feed_url: string
          site_url: string
          active: boolean
          last_fetched_at: string | null
          last_error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          feed_url: string
          site_url: string
          active?: boolean
          last_fetched_at?: string | null
          last_error?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          feed_url?: string
          site_url?: string
          active?: boolean
        }
        Relationships: []
      }
      /** Read-only over the API. Written only by the ingest and admin RPCs. */
      stories: {
        Row: {
          id: string
          slug: string | null
          source_id: string
          source_url: string
          headline: string
          summary: string | null
          take: string | null
          beat: string | null
          image_url: string | null
          status: string
          featured: boolean
          source_published_at: string | null
          published_at: string | null
          created_at: string
        }
        Insert: { [_ in never]: never }
        Update: { [_ in never]: never }
        Relationships: []
      }
      /** Publisher text. Admin-only by RLS; never rendered publicly. */
      story_excerpts: {
        Row: { story_id: string; excerpt: string }
        Insert: { [_ in never]: never }
        Update: { [_ in never]: never }
        Relationships: []
      }
      story_tools: {
        Row: { story_id: string; tool_slug: string; position: number }
        Insert: { [_ in never]: never }
        Update: { [_ in never]: never }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean }
      /** GDPR Art. 17. Takes no arguments: the user id comes from the JWT. */
      delete_own_account: { Args: Record<string, never>; Returns: undefined }
      /** The only path anon has to update `subscribers`. */
      unsubscribe_email: { Args: { target_email: string }; Returns: boolean }
      admin_click_stats: {
        Args: { days?: number }
        Returns: { tool_slug: string; clicks: number }[]
      }
      admin_set_review_status: {
        Args: { review_id: string; new_status: string }
        Returns: boolean
      }
      /** Secret-gated. Raises 42501 on a wrong secret. */
      ingest_sources: {
        Args: { secret: string }
        Returns: { id: string; name: string; feed_url: string }[]
      }
      /** Secret-gated. False when the URL is already known. */
      ingest_story: {
        Args: {
          secret: string
          p_source_id: string
          p_source_url: string
          p_headline: string
          p_excerpt: string | null
          p_image_url: string | null
          p_source_published_at: string | null
          p_tool_slugs: string[]
        }
        Returns: boolean
      }
      touch_news_source: {
        Args: { secret: string; p_source_id: string; p_error: string | null }
        Returns: undefined
      }
      /** Admin-only. Returns the story's slug, or null if not admin / not found. */
      admin_publish_story: {
        Args: {
          p_story_id: string
          p_slug: string
          p_headline: string
          p_summary: string
          p_take: string | null
          p_beat: string
          p_featured: boolean
          p_tool_slugs: string[]
        }
        Returns: string | null
      }
      /** Admin-only. 'rejected' from pending, or 'pending' to unpublish. */
      admin_set_story_status: {
        Args: { p_story_id: string; p_status: string }
        Returns: boolean
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

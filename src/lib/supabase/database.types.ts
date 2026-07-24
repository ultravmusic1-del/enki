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
    }
    Views: { [_ in never]: never }
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean }
      admin_click_stats: {
        Args: { days?: number }
        Returns: { tool_slug: string; clicks: number }[]
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

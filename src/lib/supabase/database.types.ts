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
          title?: string | null
          tool_slug?: string
          updated_at?: string
          user_id?: string
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
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string | null; created_at: string; updated_at: string };
        Insert: { id: string; display_name?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; display_name?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      recipes: {
        Row: { id: string; user_id: string; title: string; description: string | null; instructions: string; prep_minutes: number | null; cook_minutes: number | null; servings: number | null; difficulty: string | null; image_path: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; title: string; description?: string | null; instructions: string; prep_minutes?: number | null; cook_minutes?: number | null; servings?: number | null; difficulty?: string | null; image_path?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string; title?: string; description?: string | null; instructions?: string; prep_minutes?: number | null; cook_minutes?: number | null; servings?: number | null; difficulty?: string | null; image_path?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      recipe_ingredients: {
        Row: { id: string; recipe_id: string; name: string; quantity: number | null; unit: string | null; notes: string | null; position: number; created_at: string; updated_at: string };
        Insert: { id?: string; recipe_id: string; name: string; quantity?: number | null; unit?: string | null; notes?: string | null; position: number; created_at?: string; updated_at?: string };
        Update: { id?: string; recipe_id?: string; name?: string; quantity?: number | null; unit?: string | null; notes?: string | null; position?: number; created_at?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: "recipe_ingredients_recipe_id_fkey"; columns: ["recipe_id"]; isOneToOne: false; referencedRelation: "recipes"; referencedColumns: ["id"] }];
      };
      pantry_items: {
        Row: { id: string; user_id: string; name: string; quantity: number; unit: string; category: string | null; low_stock_threshold: number | null; expires_on: string | null; image_path: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; name: string; quantity?: number; unit: string; category?: string | null; low_stock_threshold?: number | null; expires_on?: string | null; image_path?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string; name?: string; quantity?: number; unit?: string; category?: string | null; low_stock_threshold?: number | null; expires_on?: string | null; image_path?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      shopping_list_items: {
        Row: { id: string; user_id: string; name: string; quantity: number | null; unit: string | null; source_recipe_id: string | null; is_completed: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; name: string; quantity?: number | null; unit?: string | null; source_recipe_id?: string | null; is_completed?: boolean; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string; name?: string; quantity?: number | null; unit?: string | null; source_recipe_id?: string | null; is_completed?: boolean; created_at?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: "shopping_list_items_source_recipe_id_fkey"; columns: ["source_recipe_id"]; isOneToOne: false; referencedRelation: "recipes"; referencedColumns: ["id"] }];
      };
      favorites: {
        Row: { user_id: string; recipe_id: string; created_at: string };
        Insert: { user_id: string; recipe_id: string; created_at?: string };
        Update: { user_id?: string; recipe_id?: string; created_at?: string };
        Relationships: [{ foreignKeyName: "favorites_recipe_id_fkey"; columns: ["recipe_id"]; isOneToOne: false; referencedRelation: "recipes"; referencedColumns: ["id"] }];
      };
      recipe_imports: {
        Row: { id: string; user_id: string; source_path: string | null; source_filename: string; mime_type: string; byte_size: number; status: string; draft_json: Json | null; confidence_json: Json; warnings_json: Json; error_code: string | null; error_message: string | null; attempt_count: number; expires_at: string; provider_request_id: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; source_path: string; source_filename: string; mime_type: string; byte_size: number; status?: string; draft_json?: Json | null; confidence_json?: Json; warnings_json?: Json; error_code?: string | null; error_message?: string | null; attempt_count?: number; expires_at?: string; provider_request_id?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string; source_path?: string | null; source_filename?: string; mime_type?: string; byte_size?: number; status?: string; draft_json?: Json | null; confidence_json?: Json; warnings_json?: Json; error_code?: string | null; error_message?: string | null; attempt_count?: number; expires_at?: string; provider_request_id?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];

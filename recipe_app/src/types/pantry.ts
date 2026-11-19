export type PantryItem = {
  id: string;
  user_id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string | null;
  low_stock_threshold: number | null;
  expires_on: string | null;
  image_path: string | null;
  image_url?: string | null;
  created_at: string;
  updated_at: string;
};

export type PantryItemDraft = {
  name: string;
  quantity: string;
  unit: string;
  category: string;
  lowStockThreshold: string;
  expiresOn: string;
  image: File | null;
};

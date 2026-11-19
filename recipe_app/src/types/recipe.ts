export type Difficulty = "easy" | "medium" | "hard";

export type RecipeIngredient = {
  id?: string;
  recipe_id?: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  position: number;
};

export type Recipe = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  instructions: string;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number | null;
  difficulty: Difficulty | null;
  image_path: string | null;
  image_url?: string | null;
  created_at: string;
  updated_at: string;
  recipe_ingredients: RecipeIngredient[];
};

export type RecipeDraft = {
  title: string;
  description: string;
  instructions: string;
  prepMinutes: string;
  cookMinutes: string;
  servings: string;
  difficulty: Difficulty;
  ingredients: Array<Pick<RecipeIngredient, "name" | "quantity" | "unit" | "notes">>;
};

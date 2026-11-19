import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createPantryItem, deletePantryItem, listPantryItems, updatePantryQuantity, validatePantryImage } from "../lib/pantry";
import type { PantryItem, PantryItemDraft } from "../types/pantry";
import MobileNav from "../components/MobileNav";
import Toast from "../components/Toast";

const emptyDraft: PantryItemDraft = {
  name: "",
  quantity: "",
  unit: "",
  category: "",
  lowStockThreshold: "",
  expiresOn: "",
  image: null,
};

function isLowStock(item: PantryItem) {
  return item.low_stock_threshold !== null && item.quantity <= item.low_stock_threshold;
}

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [imagePreview, setImagePreview] = useState("");

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const loadItems = useCallback(async () => {
    setError("");
    try {
      setItems(await listPantryItems());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load your stock.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadItems(); }, [loadItems]);

  const addItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const item = await createPantryItem(draft);
      setItems((current) => [...current, item].sort((left, right) => left.name.localeCompare(right.name)));
      setDraft(emptyDraft);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview("");
      notify(`${item.name} added to stock.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add this stock item.");
    } finally {
      setSaving(false);
    }
  };

  const adjustQuantity = async (item: PantryItem, amount: number) => {
    setError("");
    try {
      const updated = await updatePantryQuantity(item.id, item.quantity + amount);
      setItems((current) => current.map((currentItem) => currentItem.id === updated.id ? updated : currentItem));
      notify(`${updated.name} updated.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update this stock item.");
    }
  };

  const removeItem = async (item: PantryItem) => {
    if (!window.confirm(`Delete ${item.name} from your stock?`)) return;
    try {
      await deletePantryItem(item.id);
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
      notify(`${item.name} removed from stock.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete this stock item.");
    }
  };

  return (
    <main className="pantry-shell">
      <Toast message={toast} />
      <header className="recipe-editor-header">
        <div><p className="eyebrow">PantryPilot / Stock</p><h1>What’s in stock?</h1><p className="muted">Keep a simple view of what you have before you plan your next meal.</p></div>
        <Link className="button button-secondary" to="/">Back to kitchen</Link>
      </header>
      {error && <div className="notice error pantry-content" role="alert">{error}</div>}
      <section className="pantry-content pantry-layout" aria-label="Pantry stock">
        <form className="form-section pantry-form" onSubmit={addItem}>
          <div className="section-heading"><p className="eyebrow">Add stock</p><h2>Track an item</h2><p className="form-help muted">Add the basics first. You can use a photo to recognize the item later.</p></div>
          <div className="form-grid form-grid-wide pantry-form-grid">
            <label>Item name<input aria-label="Item name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Rice" required /></label>
            <label>Unit<input aria-label="Unit" value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} placeholder="bags, cans, oz" required /></label>
            <label>Quantity<input aria-label="Quantity" type="number" min="0" step="any" value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} placeholder="0" /></label>
            <label>Category<input aria-label="Category" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="Pantry" /></label>
            <label>Low-stock alert<input aria-label="Low-stock alert" type="number" min="0" step="any" value={draft.lowStockThreshold} onChange={(event) => setDraft({ ...draft, lowStockThreshold: event.target.value })} placeholder="Optional" /></label>
            <label>Expiration date<input aria-label="Expiration date" type="date" value={draft.expiresOn} onChange={(event) => setDraft({ ...draft, expiresOn: event.target.value })} /></label>
          </div>
          <label className="image-upload">Item photo<input aria-label="Item photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setError("");
            if (!file) {
              if (imagePreview) URL.revokeObjectURL(imagePreview);
              setDraft({ ...draft, image: null });
              setImagePreview("");
              return;
            }
            try {
              validatePantryImage(file);
              if (imagePreview) URL.revokeObjectURL(imagePreview);
              setDraft({ ...draft, image: file });
              setImagePreview(URL.createObjectURL(file));
            } catch (caught) {
              event.target.value = "";
              if (imagePreview) URL.revokeObjectURL(imagePreview);
              setDraft({ ...draft, image: null });
              setImagePreview("");
              setError(caught instanceof Error ? caught.message : "Unable to use that image.");
            }
          }} /><span>{draft.image ? draft.image.name : "Choose a JPEG, PNG, or WebP up to 5 MB"}</span></label>
          {imagePreview && <div className="image-preview"><img src={imagePreview} alt="Pantry item preview" /><button className="text-button" type="button" onClick={() => { URL.revokeObjectURL(imagePreview); setDraft({ ...draft, image: null }); setImagePreview(""); }}>Remove image</button></div>}
          <button className="button button-primary" type="submit" disabled={saving}>{saving ? "Adding…" : "Add to stock"}</button>
        </form>
        <section className="pantry-list" aria-labelledby="stock-list-title">
          <div className="section-heading"><p className="eyebrow">Your inventory</p><h2 id="stock-list-title">Stock list</h2></div>
          {loading && <div className="recipe-state">Loading your stock…</div>}
          {!loading && items.length === 0 && <div className="empty-state"><span className="empty-icon">◒</span><h3>Your stock list is empty.</h3><p className="muted">Add the ingredients and supplies you already have.</p></div>}
          {!loading && items.length > 0 && <div className="stock-list">{items.map((item) => <article className={`stock-card${isLowStock(item) ? " low-stock" : ""}`} key={item.id}>{item.image_url ? <img className="stock-card-image" src={item.image_url} alt="" /> : <div className="stock-card-placeholder" aria-hidden="true">◒</div>}<div><h3>{item.name}</h3><p className="muted">{item.category || "Uncategorized"}{item.expires_on ? ` · Expires ${item.expires_on}` : ""}</p></div><div className="stock-quantity"><strong>{item.quantity} {item.unit}</strong><div className="quantity-actions"><button className="icon-button" type="button" onClick={() => void adjustQuantity(item, -1)} aria-label={`Decrease ${item.name}`}>−</button><button className="icon-button" type="button" onClick={() => void adjustQuantity(item, 1)} aria-label={`Increase ${item.name}`}>+</button></div></div>{isLowStock(item) && <span className="stock-warning">Low stock</span>}<button className="text-button" type="button" onClick={() => void removeItem(item)}>Delete</button></article>)}</div>}
        </section>
      </section>
      <MobileNav />
    </main>
  );
}

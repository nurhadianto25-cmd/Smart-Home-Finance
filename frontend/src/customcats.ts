import { storage } from "@/src/utils/storage";

export type Cat = { id: string; name: string; icon: string; color: string };
export type CatStore = { expense: Cat[]; income: Cat[] };

const KEY = "shf_custom_categories";

const mk = (name: string, icon: string, color: string): Cat => ({ id: `${name}-${Math.random().toString(36).slice(2, 8)}`, name, icon, color });

export const DEFAULT_CATS: CatStore = {
  expense: [
    mk("Makanan & Minuman", "food", "#FF9D3D"),
    mk("Transportasi", "car", "#4AC6FF"),
    mk("Kesehatan", "heart-pulse", "#FF4757"),
    mk("Hiburan", "gamepad-variant", "#9B6BFF"),
    mk("Hewan Peliharaan", "paw", "#F7C948"),
    mk("Belanja", "cart", "#10D96A"),
    mk("Tagihan & Cicilan", "file-document-outline", "#9B6BFF"),
    mk("Pendidikan", "school", "#3D7EFF"),
    mk("Rumah", "home", "#10D96A"),
    mk("Lainnya", "dots-horizontal", "#8A94A6"),
  ],
  income: [
    mk("Gaji", "cash", "#10D96A"),
    mk("Bonus", "gift", "#9B6BFF"),
    mk("Investasi", "chart-line", "#3D7EFF"),
    mk("Usaha", "store", "#FF9D3D"),
    mk("Lainnya", "dots-horizontal", "#8A94A6"),
  ],
};

export async function loadCats(): Promise<CatStore> {
  const c = await storage.getItem<any>(KEY, DEFAULT_CATS as any);
  if (!c || !Array.isArray(c.expense) || !Array.isArray(c.income)) return DEFAULT_CATS;
  return c as CatStore;
}

export async function saveCats(c: CatStore): Promise<void> {
  await storage.setItem(KEY, c as any);
}

export function newCat(name: string, icon: string, color: string): Cat {
  return mk(name, icon, color);
}

export const CAT_ICON_CHOICES = [
  "food", "car", "heart-pulse", "gamepad-variant", "paw", "cart", "file-document-outline",
  "school", "home", "cash", "gift", "chart-line", "store", "airplane", "medical-bag",
  "coffee", "gas-station", "cellphone", "shopping", "dumbbell", "dots-horizontal",
];
export const CAT_COLOR_CHOICES = ["#10D96A", "#3D7EFF", "#9B6BFF", "#FF9D3D", "#FF4757", "#4AC6FF", "#F7C948", "#8A94A6"];

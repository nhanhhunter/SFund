import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import {
  defaultPortfolioCurrency,
  type PortfolioDividend,
  type InsertPortfolioItem,
  type PortfolioPurchase,
  type InsertWatchlistItem,
  type PortfolioItem,
  type WatchlistItem,
} from "@shared/schema";
import { AVATAR_CHOICES, type AvatarOptionId } from "@/lib/avatar-options";
import { db } from "@/lib/firebase";

export type ThemePreference = "light" | "dark";
export type FontPreference = "editorial" | "sans" | "display";
export type MiniChartPeriodPreference = "1" | "7" | "30";

export type UserPreferences = {
  theme: ThemePreference;
  fontFamily: FontPreference;
  miniChartPeriod: MiniChartPeriodPreference;
  menuOrder: string[];
  hiddenMenuItems: string[];
  displayName: string;
  avatar: AvatarOptionId;
  updatedAt: string;
};

export const DEFAULT_NAV_ORDER = [
  "/portfolio",
  "/watchlist",
  "/",
  "/stocks",
  "/gold",
  "/oil",
  "/crypto",
] as const;

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: "light",
  fontFamily: "editorial",
  miniChartPeriod: "7",
  menuOrder: [...DEFAULT_NAV_ORDER],
  hiddenMenuItems: [],
  displayName: "",
  avatar: AVATAR_CHOICES[0],
  updatedAt: new Date(0).toISOString(),
};

function requireDb() {
  if (!db) {
    throw new Error("Firebase chưa được cấu hình.");
  }

  return db;
}

function portfolioCollection(userId: string) {
  return collection(requireDb(), "users", userId, "portfolio");
}

function watchlistCollection(userId: string) {
  return collection(requireDb(), "users", userId, "watchlist");
}

function preferencesDoc(userId: string) {
  return doc(requireDb(), "users", userId, "settings", "preferences");
}

async function deleteCollectionDocuments(pathCollection: ReturnType<typeof collection>) {
  const snapshot = await getDocs(pathCollection);
  await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)));
}

function normalizePortfolioItem(data: Partial<PortfolioItem>, fallbackId: string): PortfolioItem {
  const addedAt = data.addedAt || new Date().toISOString();
  const updatedAt = data.updatedAt || addedAt;
  const currency = data.currency || defaultPortfolioCurrency(data.type || "stock");
  const purchaseLots = Array.isArray(data.purchaseLots) && data.purchaseLots.length > 0
    ? (data.purchaseLots as PortfolioPurchase[])
    : [{
        quantity: Number(data.quantity) || 0,
        price: Number(data.avgBuyPrice) || 0,
        boughtAt: addedAt,
      }];
  const dividends = Array.isArray(data.dividends) ? (data.dividends as PortfolioDividend[]) : [];
  const quantity = purchaseLots.reduce((sum, lot) => sum + (Number(lot.quantity) || 0), 0);
  const totalCost = purchaseLots.reduce(
    (sum, lot) => sum + (Number(lot.quantity) || 0) * (Number(lot.price) || 0),
    0,
  );
  const avgBuyPrice = quantity > 0 ? totalCost / quantity : Number(data.avgBuyPrice) || 0;

  return {
    ...data,
    id: data.id || fallbackId,
    addedAt,
    updatedAt,
    currency,
    purchaseLots,
    dividends,
    quantity,
    avgBuyPrice,
  } as PortfolioItem;
}

export async function listPortfolioItems(userId: string): Promise<PortfolioItem[]> {
  const snapshot = await getDocs(
    query(portfolioCollection(userId), orderBy("addedAt", "desc")),
  );

  return snapshot.docs.map((item) => normalizePortfolioItem(item.data() as Partial<PortfolioItem>, item.id));
}

export async function addPortfolioItem(
  userId: string,
  item: InsertPortfolioItem,
): Promise<PortfolioItem> {
  const docRef = doc(portfolioCollection(userId));
  const now = new Date().toISOString();
  const created = normalizePortfolioItem({
    ...item,
    id: docRef.id,
    addedAt: now,
    updatedAt: now,
  }, docRef.id);

  await setDoc(docRef, created);
  return created;
}

export async function updatePortfolioItem(
  userId: string,
  id: string,
  item: InsertPortfolioItem,
  addedAt?: string,
): Promise<PortfolioItem> {
  const now = new Date().toISOString();
  const updated = normalizePortfolioItem({
    ...item,
    id,
    addedAt,
    updatedAt: now,
  }, id);

  await setDoc(doc(portfolioCollection(userId), id), updated, { merge: true });
  return updated;
}

export async function deletePortfolioItem(userId: string, id: string) {
  await deleteDoc(doc(portfolioCollection(userId), id));
}

export async function listWatchlistItems(userId: string): Promise<WatchlistItem[]> {
  const snapshot = await getDocs(
    query(watchlistCollection(userId), orderBy("addedAt", "desc")),
  );

  return snapshot.docs.map((item) => item.data() as WatchlistItem);
}

export async function addWatchlistItem(
  userId: string,
  item: InsertWatchlistItem,
): Promise<WatchlistItem> {
  const draft = {
    ...item,
    id: "",
    addedAt: new Date().toISOString(),
  } satisfies WatchlistItem;

  const docRef = await addDoc(watchlistCollection(userId), draft);
  const finalItem = { ...draft, id: docRef.id };
  await setDoc(doc(watchlistCollection(userId), docRef.id), finalItem, { merge: true });
  return finalItem;
}

export async function removeWatchlistItem(userId: string, id: string) {
  await deleteDoc(doc(watchlistCollection(userId), id));
}

export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  const snapshot = await getDoc(preferencesDoc(userId));
  return snapshot.exists() ? (snapshot.data() as UserPreferences) : null;
}

export async function saveUserPreferences(userId: string, preferences: UserPreferences) {
  await setDoc(preferencesDoc(userId), preferences, { merge: true });
}

export async function deleteAllUserData(userId: string) {
  await Promise.all([
    deleteCollectionDocuments(portfolioCollection(userId)),
    deleteCollectionDocuments(watchlistCollection(userId)),
    deleteDoc(preferencesDoc(userId)).catch(() => undefined),
  ]);
}

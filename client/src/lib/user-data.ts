import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import {
  type InsertPortfolioItem,
  type InsertWatchlistItem,
  type PortfolioItem,
  type WatchlistItem,
} from "@shared/schema";
import { db } from "@/lib/firebase";

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

export async function listPortfolioItems(userId: string): Promise<PortfolioItem[]> {
  const snapshot = await getDocs(
    query(portfolioCollection(userId), orderBy("addedAt", "desc")),
  );

  return snapshot.docs.map((item) => item.data() as PortfolioItem);
}

export async function addPortfolioItem(
  userId: string,
  item: InsertPortfolioItem,
): Promise<PortfolioItem> {
  const docRef = doc(portfolioCollection(userId));
  const created: PortfolioItem = {
    ...item,
    id: docRef.id,
    addedAt: new Date().toISOString(),
  };

  await setDoc(docRef, created);
  return created;
}

export async function updatePortfolioItem(
  userId: string,
  id: string,
  item: InsertPortfolioItem,
): Promise<PortfolioItem> {
  const updated: PortfolioItem = {
    ...item,
    id,
    addedAt: new Date().toISOString(),
  };

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

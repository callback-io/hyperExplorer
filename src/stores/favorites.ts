import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface FavoriteItem {
  name: string;
  path: string;
}

interface FavoritesState {
  favorites: FavoriteItem[];
  addFavorite: (item: FavoriteItem) => void;
  removeFavorite: (path: string) => void;
  isFavorite: (path: string) => boolean;
}

export const useFavorites = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],
      addFavorite: (item) =>
        set((state) => {
          if (state.favorites.some((f) => f.path === item.path)) return state;
          return { favorites: [...state.favorites, item] };
        }),
      removeFavorite: (path) =>
        set((state) => ({
          favorites: state.favorites.filter((f) => f.path !== path),
        })),
      isFavorite: (path) => get().favorites.some((f) => f.path === path),
    }),
    { name: "favorites-storage" }
  )
);

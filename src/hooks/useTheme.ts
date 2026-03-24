/**
 * useTheme Hook
 * 单一职责：获取主题 Context
 */
import { useContext } from "react";
import { ThemeProviderContext } from "@/contexts/themeContextDef";

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};

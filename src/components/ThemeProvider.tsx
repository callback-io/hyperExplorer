import { useEffect } from "react";
import { useSetting } from "@/hooks/useSetting";
import { ThemeProviderContext } from "@/contexts/themeContextDef";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

export function ThemeProvider({ children, defaultTheme = "system", ...props }: ThemeProviderProps) {
  // 使用 useSetting 自动同步主题状态
  const [theme, setTheme] = useSetting<Theme>("theme", defaultTheme);

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  // 监听系统主题变化
  useEffect(() => {
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const root = window.document.documentElement;
      // 只有在当前也是 system 模式下才自动切换
      if (theme === "system") {
        root.classList.remove("light", "dark");
        root.classList.add(media.matches ? "dark" : "light");
      }
    };

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [theme]);

  // 移除旧的监听逻辑 (已由 useSetting 接管)
  // useEffect(() => { ... }, []);

  // Use the setTheme from useSetting directly

  const value = {
    theme,
    setTheme: (t: Theme) => setTheme(t), // Wrap to match void return type if needed, though Promise<void> is compatible
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

import { useEffect, useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SmartIconProps } from "@/types";
import { SYSTEM_PATHS } from "@/constants/paths";
import { iconCache, loadingIcons, registerIconRefresh, triggerIconRefresh } from "@/lib/iconCache";

export function SmartIcon({ icon: Icon, className, sysIcon }: SmartIconProps) {
  // 用于强制刷新的计数器
  const [updateCount, forceUpdate] = useState(0);

  // 生成缓存 key
  const cacheKey = useMemo(() => {
    if (!sysIcon) return null;
    return `${sysIcon.type}:${sysIcon.value || "default"}`;
  }, [sysIcon]);

  // 从缓存读取图标（每次渲染都检查最新缓存）
  const iconBase64 = useMemo(() => {
    if (!cacheKey) return null;
    const cached = iconCache[cacheKey];
    return cached === "failed" ? null : cached || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, updateCount]); // 这里必须依赖 updateCount，否则 forceUpdate 无效！

  // Debug: 监控渲染
  useEffect(() => {
    if (cacheKey && iconBase64) {
      console.log(`[SmartIcon] Rendered ${cacheKey} with data len: ${iconBase64.length}`);
    }
  }, [cacheKey, iconBase64]);

  // 注册全局刷新回调
  useEffect(() => {
    const unregister = registerIconRefresh(() => {
      console.log("[SmartIcon] Refresh triggered from global event");
      forceUpdate((n) => n + 1);
    });
    return () => {
      unregister();
    };
  }, []);

  // 加载图标到缓存
  useEffect(() => {
    if (!sysIcon || !cacheKey) return;

    // 如果已经有缓存，无需加载
    if (iconCache[cacheKey]) {
      return;
    }

    // 如果正在加载，不重复发起请求
    if (loadingIcons.has(cacheKey)) {
      return;
    }

    // 开始加载
    let isMounted = true;
    loadingIcons.add(cacheKey);
    // console.log(`[SmartIcon] Fetching: ${cacheKey}`);

    const fetchIcon = async () => {
      try {
        let base64: string | null = null;

        if (sysIcon.type === "path" && sysIcon.value) {
          base64 = await invoke<string>("get_app_icon", { appPath: sysIcon.value });
        } else if (sysIcon.type === "ext") {
          base64 = await invoke<string>("get_file_type_icon", {
            ext: sysIcon.value || "",
          });
        } else if (sysIcon.type === "folder") {
          base64 = await invoke<string>("get_app_icon", {
            appPath: SYSTEM_PATHS.CORE_SERVICES,
          });
        } else if (sysIcon.type === "sfsymbol" && sysIcon.value) {
          base64 = await invoke<string>("get_sf_symbol", { name: sysIcon.value });
        }

        // 即使组件卸载了，也要更新全局缓存！
        if (base64) {
          iconCache[cacheKey] = base64;
          // console.log(`[SmartIcon] Loaded ${cacheKey}, len: ${base64.length}`);
        } else {
          iconCache[cacheKey] = "failed";
          // console.log(`[SmartIcon] Loaded ${cacheKey} is EMPTY/NULL`);
        }

        if (isMounted) {
          // 触发当前组件刷新
          forceUpdate((n) => n + 1);
        }
      } catch (e) {
        console.error(`SmartIcon failed to load ${sysIcon.type}:${sysIcon.value}`, e);
        iconCache[cacheKey] = "failed";
      } finally {
        loadingIcons.delete(cacheKey);
        // 触发全局刷新，通知所有等待的组件（包括因并发跳过加载的组件）
        triggerIconRefresh();
        // 触发全局刷新，通知所有等待的组件（包括因并发跳过加载的组件）
        triggerIconRefresh();
        // console.log(`[SmartIcon] Fetched & Triggered: ${cacheKey}`);
      }
    };

    fetchIcon();

    return () => {
      isMounted = false;
    };
  }, [sysIcon, cacheKey]);

  // 优先显示系统图标
  if (iconBase64) {
    if (sysIcon?.type === "sfsymbol") {
      return (
        <span
          className={`inline-block shrink-0 bg-current ${className || "h-6 w-6"}`}
          style={{
            maskImage: `url(data:image/png;base64,${iconBase64})`,
            maskSize: "contain",
            maskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskImage: `url(data:image/png;base64,${iconBase64})`,
            WebkitMaskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
          }}
          draggable={false}
        />
      );
    }
    return (
      <img
        src={`data:image/png;base64,${iconBase64}`}
        className={`object-contain ${className || "h-6 w-6"}`}
        alt=""
        draggable={false}
      />
    );
  }

  // 如果有 fallback 图标，显示它（即使正在加载系统图标）
  if (Icon) {
    return <Icon className={className || "h-6 w-6"} />;
  }

  return null;
}

import { useEffect, useState, useMemo } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { marked } from "marked";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import json from "highlight.js/lib/languages/json";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import bash from "highlight.js/lib/languages/bash";
import yaml from "highlight.js/lib/languages/yaml";
import sql from "highlight.js/lib/languages/sql";
import "highlight.js/styles/github-dark.css";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("json", json);
hljs.registerLanguage("css", css);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("sql", sql);
import { useTranslation } from "react-i18next";
import { X, ExternalLink, Folder, File, Loader2 } from "lucide-react";
import { SmartIcon } from "@/components/SmartIcon";
import { FileEntry } from "@/types";
import {
  isTextFile,
  isBrowserSupportedImage,
  isVideoFile,
  isAudioFile,
  isPdfFile,
} from "@/utils/file";
import { formatFileSize, formatDate } from "@/utils/format";

interface QuickLookProps {
  entry: FileEntry | null;
  onClose: () => void;
}

type PreviewType = "text" | "image" | "video" | "audio" | "pdf" | "icon";

export function QuickLook({ entry, onClose }: QuickLookProps) {
  const { t } = useTranslation();

  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);

  // 缓存 convertFileSrc 结果，避免重复转换
  const fileSrc = useMemo(() => {
    if (!entry) return null;
    return convertFileSrc(entry.path);
  }, [entry]);

  // 根据 entry 计算预览类型
  const previewType: PreviewType = useMemo(() => {
    if (!entry || entry.is_dir) return "icon";
    // 忽略 macOS 的元数据文件 (AppleDouble)
    if (entry.name.startsWith("._")) return "icon";

    if (isBrowserSupportedImage(entry.extension)) return "image";
    if (isVideoFile(entry.extension)) return "video";
    if (isAudioFile(entry.extension)) return "audio";
    if (isPdfFile(entry.extension)) return "pdf";
    if (isTextFile(entry.extension) && entry.size < 1024 * 1024) return "text";
    return "icon";
  }, [entry]);

  // 当 entry 变化时，重置错误状态
  useEffect(() => {
    setError(null);
    setTextContent(null);
    setFallbackSrc(null);
  }, [entry]);

  // ESC 关闭 + 媒体清理
  useEffect(() => {
    if (!entry) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      // 暂停所有媒体元素
      document.querySelectorAll("video, audio").forEach((el) => {
        (el as HTMLMediaElement).pause();
      });
    };
  }, [entry, onClose]);

  useEffect(() => {
    // 只有文本文件才需要加载内容
    if (!entry || previewType !== "text") {
      return;
    }

    let cancelled = false;

    const loadText = async () => {
      try {
        setLoading(true);
        setError(null);
        const content = await invoke<string>("read_text_file", {
          path: entry.path,
          maxSize: 1024 * 1024,
        });
        if (!cancelled) {
          setTextContent(content);
        }
      } catch (err) {
        console.error("Failed to read text:", err);
        if (!cancelled) {
          setError(String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadText();

    return () => {
      cancelled = true;
    };
  }, [entry, previewType]);

  if (!entry) return null;

  const handleOpen = async () => {
    try {
      await invoke("open_file", { path: entry.path });
      onClose();
    } catch (e) {
      console.error("Failed to open file:", e);
    }
  };

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="text-muted-foreground flex flex-col items-center justify-center">
          <Loader2 className="mb-2 h-8 w-8 animate-spin" />
          <span className="text-xs">{t("common.loading")}</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center p-4 text-center text-red-500">
          <p className="mb-1 text-sm font-medium">{t("common.quick_look.error") || "Error"}</p>
          <p className="text-xs opacity-80">{error}</p>
        </div>
      );
    }

    switch (previewType) {
      case "image":
        return (
          <div className="flex h-full w-full items-center justify-center p-4">
            <img
              key={entry.path}
              src={fallbackSrc || fileSrc || ""}
              alt={entry.name}
              className="max-h-full max-w-full rounded-lg object-contain shadow-lg"
              onError={() => {
                // 如果已经是 fallback 加载失败，或者是 asset 协议加载失败且没有 fallback
                if (fallbackSrc) {
                  setError(t("common.quick_look.error", "Failed to load image"));
                  return;
                }

                // 尝试使用 base64 读取
                invoke<string>("read_image_base64", { path: entry.path })
                  .then((base64) => {
                    setFallbackSrc(base64);
                    setError(null); // 清除可能出现的错误
                  })
                  .catch(() => {
                    setError(t("common.quick_look.error", "Failed to load image"));
                  });
              }}
            />
          </div>
        );

      case "video":
        return (
          <div className="flex h-full w-full items-center justify-center p-4">
            <video
              key={entry.path}
              src={fileSrc || ""}
              controls
              className="max-h-full max-w-full rounded-lg shadow-lg"
              onError={(e) => {
                console.error("Video load error:", e);
                setError(t("common.quick_look.error") || "Failed to load video");
              }}
            >
              Your browser does not support video playback.
            </video>
          </div>
        );

      case "audio":
        return (
          <div className="flex h-full w-full flex-col items-center justify-center gap-8 p-8">
            <div className="relative flex h-32 w-32 items-center justify-center drop-shadow-2xl">
              <SmartIcon
                icon={File}
                className="text-muted-foreground h-32 w-32"
                sysIcon={{ type: "ext", value: entry.extension || "" }}
              />
            </div>
            <audio
              key={entry.path}
              src={fileSrc || ""}
              controls
              className="w-full max-w-md"
              onError={(e) => {
                console.error("Audio load error:", e);
                setError(t("common.quick_look.error") || "Failed to load audio");
              }}
            >
              Your browser does not support audio playback.
            </audio>
          </div>
        );

      case "pdf":
        return (
          <div className="h-full w-full p-4">
            <embed
              key={entry.path}
              src={fileSrc || ""}
              type="application/pdf"
              className="h-full w-full rounded-lg shadow-lg"
              onError={(e) => {
                console.error("PDF load error:", e);
                setError(t("common.quick_look.error") || "Failed to load PDF");
              }}
            />
          </div>
        );

      case "text":
        if (textContent === null) return null;
        // Markdown 渲染
        if (entry?.extension?.toLowerCase() === "md") {
          const html = marked.parse(textContent) as string;
          return (
            <div className="bg-muted/30 h-full w-full overflow-auto rounded-md border p-4 shadow-inner">
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          );
        }
        // 代码高亮
        {
          const ext = entry?.extension?.toLowerCase() || "";
          const lang = hljs.getLanguage(ext) ? ext : undefined;
          const highlighted = lang
            ? hljs.highlight(textContent, { language: lang }).value
            : undefined;
          return (
            <div className="bg-muted/30 h-full w-full overflow-auto rounded-md border p-4 shadow-inner">
              {highlighted ? (
                <pre className="font-mono text-xs">
                  <code dangerouslySetInnerHTML={{ __html: highlighted }} />
                </pre>
              ) : (
                <pre className="font-mono text-xs break-words whitespace-pre-wrap">
                  {textContent}
                </pre>
              )}
            </div>
          );
        }

      case "icon":
      default:
        return (
          <>
            <div className="relative mb-6 flex h-32 w-32 items-center justify-center drop-shadow-2xl">
              <SmartIcon
                icon={entry.is_dir ? Folder : File}
                className={
                  entry.is_dir ? "h-32 w-32 text-blue-500" : "text-muted-foreground h-32 w-32"
                }
                sysIcon={
                  entry.is_dir ? { type: "folder" } : { type: "ext", value: entry.extension || "" }
                }
              />
            </div>

            <div className="text-center">
              <h2 className="line-clamp-2 px-8 text-2xl font-semibold tracking-tight break-all">
                {entry.name}
              </h2>
              <div className="text-muted-foreground mt-2 space-y-1 text-sm">
                <p>
                  {entry.is_dir
                    ? t("common.folder")
                    : entry.extension?.toUpperCase() || t("common.file")}
                  {" • "}
                  {entry.is_dir ? "--" : formatFileSize(entry.size)}
                </p>
                <p>
                  {t("common.quick_look.modified")}:{" "}
                  {formatDate(entry.modified, "yyyy/MM/dd HH:mm:ss")}
                </p>
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-background/80 text-foreground animate-in fade-in zoom-in-95 relative flex h-[400px] w-[600px] flex-col overflow-hidden rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="bg-muted/30 flex items-center justify-between border-b px-4 py-3">
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground rounded-full p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="text-sm font-medium opacity-80">{t("common.quick_look.preview")}</div>
          <button
            onClick={handleOpen}
            className="text-primary hover:text-primary/80 flex items-center gap-1 text-sm font-medium transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            {t("common.quick_look.open")}
          </button>
        </div>

        {/* Content */}
        <div className="flex w-full flex-1 flex-col items-center justify-center overflow-hidden p-8">
          {renderPreview()}
        </div>
      </div>
    </div>
  );
}

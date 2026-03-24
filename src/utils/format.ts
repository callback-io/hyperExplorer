import { format } from "date-fns";

/**
 * Format file size into human readable string (B, KB, MB, GB, TB).
 * @param bytes Size in bytes
 * @param decimals Number of decimal places (default: 1 for >B, 0 for B)
 */
export function formatFileSize(bytes: number, decimals = 1): string {
  if (bytes === 0) return "--";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  // Keep 0 decimals for Bytes if bytes < 1024, essentially i=0
  const actualDecimals = i === 0 ? 0 : decimals;
  return `${(bytes / Math.pow(1024, i)).toFixed(actualDecimals)} ${units[i]}`;
}

/**
 * Format timestamp (seconds) to date string.
 * @param timestamp Timestamp in seconds
 * @param formatStr Date format string (default: 'yyyy/MM/dd HH:mm')
 */
export function formatDate(timestamp: number | null, formatStr = "yyyy/MM/dd"): string {
  if (!timestamp) return "--";
  // Rust often gives seconds, JS needs milliseconds
  return format(new Date(timestamp * 1000), formatStr);
}

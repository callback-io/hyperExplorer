import {
  TEXT_EXTENSIONS,
  IMAGE_EXTENSIONS,
  BROWSER_SUPPORTED_IMAGES,
  VIDEO_EXTENSIONS,
  AUDIO_EXTENSIONS,
  PDF_EXTENSIONS,
} from "@/constants/fileTypes";

/**
 * Check if the file extension represents a readable text file.
 * @param extension File extension (without dot)
 */
export const isTextFile = (extension?: string | null): boolean => {
  if (!extension) return false;
  return TEXT_EXTENSIONS.includes(extension.toLowerCase());
};

/**
 * Check if the file extension represents an image file.
 * @param extension File extension (without dot)
 */
export const isImageFile = (extension?: string | null): boolean => {
  if (!extension) return false;
  return IMAGE_EXTENSIONS.includes(extension.toLowerCase());
};

/**
 * Check if the file extension represents a browser-supported image file.
 * @param extension File extension (without dot)
 */
export const isBrowserSupportedImage = (extension?: string | null): boolean => {
  if (!extension) return false;
  return BROWSER_SUPPORTED_IMAGES.includes(extension.toLowerCase());
};

/**
 * Check if the file extension represents a video file.
 * @param extension File extension (without dot)
 */
export const isVideoFile = (extension?: string | null): boolean => {
  if (!extension) return false;
  return VIDEO_EXTENSIONS.includes(extension.toLowerCase());
};

/**
 * Check if the file extension represents an audio file.
 * @param extension File extension (without dot)
 */
export const isAudioFile = (extension?: string | null): boolean => {
  if (!extension) return false;
  return AUDIO_EXTENSIONS.includes(extension.toLowerCase());
};

/**
 * Check if the file extension represents a PDF file.
 * @param extension File extension (without dot)
 */
export const isPdfFile = (extension?: string | null): boolean => {
  if (!extension) return false;
  return PDF_EXTENSIONS.includes(extension.toLowerCase());
};
/**
 * Check if the folder name is a special system directory that needs a custom icon.
 */
export const isSpecialFolder = (name: string): boolean => {
  const SPECIAL_FOLDERS = [
    "Applications",
    "Desktop",
    "Documents",
    "Downloads",
    "Library",
    "Movies",
    "Music",
    "Pictures",
    "Public",
    "System",
    "Users",
    "Volumes",
    "bin",
    "cores",
    "dev",
    "etc",
    "home",
    "opt",
    "private",
    "sbin",
    "tmp",
    "usr",
    "var",
  ];
  return SPECIAL_FOLDERS.includes(name);
};

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "../locales/en/common.json";
import enNav from "../locales/en/nav.json";
import enSidebar from "../locales/en/sidebar.json";
import enFileList from "../locales/en/file_list.json";
import enContextMenu from "../locales/en/context_menu.json";
import enSearch from "../locales/en/search.json";
import enSettings from "../locales/en/settings.json";
import enTabs from "../locales/en/tabs.json";

import zhCommon from "../locales/zh/common.json";
import zhNav from "../locales/zh/nav.json";
import zhSidebar from "../locales/zh/sidebar.json";
import zhFileList from "../locales/zh/file_list.json";
import zhContextMenu from "../locales/zh/context_menu.json";
import zhSearch from "../locales/zh/search.json";
import zhSettings from "../locales/zh/settings.json";
import zhTabs from "../locales/zh/tabs.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: {
          ...enCommon,
          nav: enNav,
          sidebar: enSidebar,
          file_list: enFileList,
          context_menu: enContextMenu,
          search: enSearch,
          settings: enSettings,
          tabs: enTabs,
        },
      },
      zh: {
        common: {
          ...zhCommon,
          nav: zhNav,
          sidebar: zhSidebar,
          file_list: zhFileList,
          context_menu: zhContextMenu,
          search: zhSearch,
          settings: zhSettings,
          tabs: zhTabs,
        },
      },
      "zh-CN": {
        common: {
          ...zhCommon,
          nav: zhNav,
          sidebar: zhSidebar,
          file_list: zhFileList,
          context_menu: zhContextMenu,
          search: zhSearch,
          settings: zhSettings,
          tabs: zhTabs,
        },
      },
    },
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    ns: ["common"],
    defaultNS: "common",
  });

export default i18n;

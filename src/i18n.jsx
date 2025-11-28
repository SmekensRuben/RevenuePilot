import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import settingsNL from "./locales/nl/settings.json";
import settingsEN from "./locales/en/settings.json";
import settingsFR from "./locales/fr/settings.json";

import landingNL from "./locales/nl/landing.json";
import landingEN from "./locales/en/landing.json";
import landingFR from "./locales/fr/landing.json";

import authNL from "./locales/nl/auth.json";
import authEN from "./locales/en/auth.json";
import authFR from "./locales/fr/auth.json";

import hoteldashboardNL from "./locales/nl/hoteldashboard.json";
import hoteldashboardEN from "./locales/en/hoteldashboard.json";
import hoteldashboardFR from "./locales/fr/hoteldashboard.json";

import ingredientsNL from "./locales/nl/ingredients.json";
import ingredientsEN from "./locales/en/ingredients.json";
import ingredientsFR from "./locales/fr/ingredients.json";
import articlesNL from "./locales/nl/articles.json";
import articlesEN from "./locales/en/articles.json";
import articlesFR from "./locales/fr/articles.json";
import productsNL from "./locales/nl/products.json";
import productsEN from "./locales/en/products.json";
import productsFR from "./locales/fr/products.json";
import ordersNL from "./locales/nl/orders.json";
import ordersEN from "./locales/en/orders.json";
import ordersFR from "./locales/fr/orders.json";
import shoppinglistsNL from "./locales/nl/shoppinglists.json";
import shoppinglistsEN from "./locales/en/shoppinglists.json";
import shoppinglistsFR from "./locales/fr/shoppinglists.json";

import salesPromoNL from "./locales/nl/salespromo.json";
import salesPromoEN from "./locales/en/salespromo.json";
import salesPromoFR from "./locales/fr/salespromo.json";

import revenueCenterNL from "./locales/nl/revenuecenter.json";
import revenueCenterEN from "./locales/en/revenuecenter.json";
import revenueCenterFR from "./locales/fr/revenuecenter.json";

import soldProductsNL from "./locales/nl/soldproducts.json";
import soldProductsEN from "./locales/en/soldproducts.json";
import soldProductsFR from "./locales/fr/soldproducts.json";

import analyticsNL from "./locales/nl/analytics.json";
import analyticsEN from "./locales/en/analytics.json";
import analyticsFR from "./locales/fr/analytics.json";

import transfersNL from "./locales/nl/transfers.json";
import transfersEN from "./locales/en/transfers.json";
import transfersFR from "./locales/fr/transfers.json";

import commonNL from "./locales/nl/common.json";
import commonEN from "./locales/en/common.json";
import commonFR from "./locales/fr/common.json";

import recipesNL from "./locales/nl/recipes.json";
import recipesEN from "./locales/en/recipes.json";
import recipesFR from "./locales/fr/recipes.json";

const resources = {
  nl: {
    settings: settingsNL,
    landing: landingNL,
    auth: authNL,
    hoteldashboard: hoteldashboardNL,
    ingredients: ingredientsNL,
    articles: articlesNL,
    products: productsNL,
    orders: ordersNL,
    shoppinglists: shoppinglistsNL,
    salespromo: salesPromoNL,
    transfers: transfersNL,
    revenuecenter: revenueCenterNL,
    soldproducts: soldProductsNL,
    analytics: analyticsNL,
    common: commonNL,
    recipes: recipesNL
  },
  en: {
    settings: settingsEN,
    landing: landingEN,
    auth: authEN,
    hoteldashboard: hoteldashboardEN,
    ingredients: ingredientsEN,
    articles: articlesEN,
    products: productsEN,
    orders: ordersEN,
    shoppinglists: shoppinglistsEN,
    salespromo: salesPromoEN,
    transfers: transfersEN,
    revenuecenter: revenueCenterEN,
    soldproducts: soldProductsEN,
    analytics: analyticsEN,
    common: commonEN,
    recipes: recipesEN
  },
  fr: {
    settings: settingsFR,
    landing: landingFR,
    auth: authFR,
    hoteldashboard: hoteldashboardFR,
    ingredients: ingredientsFR,
    articles: articlesFR,
    products: productsFR,
    orders: ordersFR,
    shoppinglists: shoppinglistsFR,
    salespromo: salesPromoFR,
    transfers: transfersFR,
    revenuecenter: revenueCenterFR,
    soldproducts: soldProductsFR,
    analytics: analyticsFR,
    common: commonFR,
    recipes: recipesFR
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem("lang") || "nl",
    fallbackLng: "nl",
    ns: ["common", "settings", "app", "monitor", "reports", "auth", "landing", "salespromo", "transfers", "articles", "products", "orders", "shoppinglists", "revenuecenter", "soldproducts", "analytics", "recipes"],
    defaultNS: "common",
    interpolation: {
      escapeValue: false // React ontsmet al
    }
  });

export default i18n;

import React, { useEffect, useState, useMemo } from "react";
import HeaderBar from "layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { useHotelContext } from "contexts/HotelContext";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { getArticlesWithoutIngredient } from "../../services/firebaseArticles";
import ArticleMiniCard from "../ingredients/ArticleMiniCard";

export default function NonLinkedArticlesPage() {
  const { t } = useTranslation("articles");
  const { t: tCommon } = useTranslation("common");
  const { hotelUid, hotelName, language } = useHotelContext();
  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const locale = language === "en" ? "en-GB" : language === "fr" ? "fr-FR" : "nl-NL";
  const today = useMemo(
    () =>
      new Date().toLocaleDateString(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    [locale]
  );

  const handleLogout = async () => {
    if (window.confirm(tCommon("logoutConfirm"))) {
      sessionStorage.clear();
      window.location.href = "/login";
    }
  };

  useEffect(() => {
    if (!hotelUid) return;

    let isSubscribed = true;
    setLoading(true);
    setError(false);

    getArticlesWithoutIngredient(hotelUid)
      .then((list = []) => {
        if (!isSubscribed) return;
        setArticles(Array.isArray(list) ? list : []);
      })
      .catch(err => {
        console.error("Error fetching articles without ingredient:", err);
        if (!isSubscribed) return;
        setError(true);
        setArticles([]);
      })
      .finally(() => {
        if (!isSubscribed) return;
        setLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [hotelUid]);

  const handleCreateIngredient = article => {
    if (!article) return;
    navigate("/ingredients", {
      state: {
        prefillIngredient: {
          name: article.name || "",
          unit: article.recipeUnit || "",
          category: article.category || "",
          articleId: article.id,
        },
        returnTo: {
          pathname: "/catalog/non-linked-articles",
        },
      },
    });
  };

  const buttonClass = "btn bg-marriott text-white px-4 py-2 rounded";

  return (
    <>
      <HeaderBar hotelName={hotelName} today={today} onLogout={handleLogout} />
      <PageContainer>
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {t("nonLinkedArticlesTitle")}
            </h1>
            <p className="mt-1 text-gray-600">
              {t("nonLinkedArticlesDescription")}
            </p>
          </div>
          {loading ? (
            <div className="text-gray-500">{t("loading")}</div>
          ) : error ? (
            <div className="text-red-600">{t("nonLinkedArticlesError")}</div>
          ) : articles.length === 0 ? (
            <div className="text-gray-600">{t("nonLinkedArticlesEmpty")}</div>
          ) : (
            <div className="grid gap-3">
              {articles.map(article => (
                <ArticleMiniCard
                  key={article.id}
                  article={article}
                  actionSlot={
                    <button
                      type="button"
                      className={buttonClass}
                      onClick={() => handleCreateIngredient(article)}
                    >
                      {t("nonLinkedArticlesCreateIngredient")}
                    </button>
                  }
                />
              ))}
            </div>
          )}
        </div>
      </PageContainer>
    </>
  );
}

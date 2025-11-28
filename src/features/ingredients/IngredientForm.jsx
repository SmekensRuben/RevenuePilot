import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Combobox } from "components/ui/combobox";
import ConfirmModal from "components/layout/ConfirmModal";
import ArticleMiniCard from "./ArticleMiniCard";
import { ALLERGENS, ALLERGEN_ICONS } from "../../constants/allergens";
import { useHotelContext } from "contexts/HotelContext";

export default function IngredientForm({ form, setForm, articles, ingredients = [], categories = {}, onSubmit, loading = false }) {
  const { t } = useTranslation("ingredients");
  const { language } = useHotelContext();

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const [articleInput, setArticleInput] = useState(null);
  const [duplicateInfo, setDuplicateInfo] = useState(null); // { ingredient: name, article }

  const parentCategoryOptions = useMemo(() => {
    const list = Object.entries(categories).map(([key, val]) => ({ key, ...val }));
    const map = {};
    list.forEach(cat => { map[cat.key] = { ...cat, childCount: 0 }; });
    list.forEach(cat => {
      if (cat.parentId && map[cat.parentId]) {
        map[cat.parentId].childCount += 1;
      }
    });
    return Object.values(map)
      .filter(cat => !cat.parentId && cat.childCount > 0)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categories]);

  const childCategoryOptions = useMemo(() => {
    return Object.entries(categories)
      .filter(([key, val]) => val.parentId === form.parentCategory)
      .map(([key, val]) => ({ key, label: val.label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categories, form.parentCategory]);

  const handleAddArticle = article => {
    if (!article) return;
    const existing = ingredients.find(
      ing => Array.isArray(ing.articles) && ing.articles.includes(article.id)
    );
    if (existing) {
      setDuplicateInfo({ ingredient: existing.name, article });
      setArticleInput(null);
      return;
    }
    setForm(prev => {
      if (prev.articles.includes(article.id)) return prev;
      return { ...prev, articles: [...prev.articles, article.id] };
    });
    setArticleInput(null);
  };

  const confirmDuplicate = () => {
    if (duplicateInfo) {
      setForm(prev => {
        if (prev.articles.includes(duplicateInfo.article.id)) return prev;
        return {
          ...prev,
          articles: [...prev.articles, duplicateInfo.article.id],
        };
      });
    }
    setDuplicateInfo(null);
  };

  const handleRemoveArticle = id => {
    setForm(prev => ({ ...prev, articles: prev.articles.filter(a => a !== id) }));
  };

  return (
    <>
    <form
      onSubmit={e => {
        e.preventDefault();
        onSubmit && onSubmit();
      }}
      className="grid grid-cols-1 gap-4 mt-4"
    >
      <div className="flex flex-col">
        <label htmlFor="name" className="text-sm mb-1">
          {t("name")}
        </label>
        <input
          id="name"
          type="text"
          placeholder={t("name")}
          value={form.name}
          onChange={e => handleChange("name", e.target.value)}
          className="border px-3 py-2 w-full"
          required
        />
      </div>
      <div className="flex flex-col">
        <label htmlFor="alias_en" className="text-sm mb-1">
          {t("aliasEn")}
        </label>
        <input
          id="alias_en"
          type="text"
          placeholder={t("aliasEn")}
          value={form.aliases?.en || ""}
          onChange={e =>
            setForm(prev => ({
              ...prev,
              aliases: { ...prev.aliases, en: e.target.value },
            }))
          }
          className="border px-3 py-2 w-full"
        />
      </div>
      <div className="flex flex-col">
        <label htmlFor="alias_fr" className="text-sm mb-1">
          {t("aliasFr")}
        </label>
        <input
          id="alias_fr"
          type="text"
          placeholder={t("aliasFr")}
          value={form.aliases?.fr || ""}
          onChange={e =>
            setForm(prev => ({
              ...prev,
              aliases: { ...prev.aliases, fr: e.target.value },
            }))
          }
          className="border px-3 py-2 w-full"
        />
      </div>
      <div className="flex flex-col">
        <label htmlFor="alias_nl" className="text-sm mb-1">
          {t("aliasNl")}
        </label>
        <input
          id="alias_nl"
          type="text"
          placeholder={t("aliasNl")}
          value={form.aliases?.nl || ""}
          onChange={e =>
            setForm(prev => ({
              ...prev,
              aliases: { ...prev.aliases, nl: e.target.value },
            }))
          }
          className="border px-3 py-2 w-full"
        />
      </div>
      <div className="flex flex-col">
        <label htmlFor="unit" className="text-sm mb-1">
          {t("unit")}
        </label>
        <input
          id="unit"
          type="text"
          placeholder={t("unit")}
          value={form.unit}
          onChange={e => handleChange("unit", e.target.value)}
          className="border px-3 py-2 w-full"
          required
        />
      </div>
      <div className="flex flex-col">
        <label htmlFor="parentCategory" className="text-sm mb-1">
          {t("selectParentCategory")}
        </label>
        <select
          id="parentCategory"
          value={form.parentCategory}
          onChange={e => {
            handleChange("parentCategory", e.target.value);
            handleChange("category", "");
          }}
          className="border px-3 py-2 w-full"
        >
          <option value="">{t("selectParentCategory")}</option>
          {parentCategoryOptions.map(opt => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col">
        <label htmlFor="category" className="text-sm mb-1">
          {t("selectSubcategory")}
        </label>
        <select
          id="category"
          value={form.category}
          onChange={e => handleChange("category", e.target.value)}
          className="border px-3 py-2 w-full"
          required
          disabled={!form.parentCategory}
        >
          <option value="">{t("selectSubcategory")}</option>
          {childCategoryOptions.map(opt => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col">
        <span className="text-sm mb-1">{t("articles")}</span>
        <Combobox
          value={articleInput}
          onChange={handleAddArticle}
          options={articles.filter(a => !form.articles.includes(a.id))}
          displayValue={a => a?.aliases?.[language] || a?.name || ""}
          getOptionValue={a => a.id}
          placeholder={t("articles")}
        />
        {form.articles.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {form.articles.map(id => {
              const art = articles.find(a => a.id === id);
              return (
                <ArticleMiniCard
                  key={id}
                  article={art}
                  onRemove={handleRemoveArticle}
                />
              );
            })}
          </div>
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-sm mb-1">{t("allergensLabel")}</span>
        <div className="grid grid-cols-2 gap-2">
          {ALLERGENS.map(key => {
            const Icon = ALLERGEN_ICONS[key];
            return (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.allergens?.[key] || false}
                  onChange={e =>
                    handleChange("allergens", {
                      ...form.allergens,
                      [key]: e.target.checked,
                    })
                  }
                />
                {Icon && <Icon className="w-4 h-4" />}
                {t(`allergens.${key}`)}
              </label>
            );
          })}
        </div>
      </div>
      <button type="submit" className="bg-black text-white px-4 py-2" disabled={loading}>
        {t("add")}
      </button>
    </form>
    <ConfirmModal
      open={!!duplicateInfo}
      title={t("articleAlreadyLinkedTitle")}
      message={t("articleAlreadyLinked", { ingredient: duplicateInfo?.ingredient })}
      onConfirm={confirmDuplicate}
      onCancel={() => setDuplicateInfo(null)}
    />
    </>
  );
}

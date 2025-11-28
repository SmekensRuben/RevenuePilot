import React, { useState, useMemo } from "react";
import { Dialog } from "@headlessui/react";
import { useTranslation } from "react-i18next";
import { usePermission } from "../../hooks/usePermission";
import ConfirmModal from "components/layout/ConfirmModal";
import { Combobox } from "components/ui/combobox";
import ArticleMiniCard from "./ArticleMiniCard";
import { ALLERGENS, ALLERGEN_ICONS } from "../../constants/allergens";
import { useHotelContext } from "contexts/HotelContext";

export default function IngredientDetailDialog({
  open,
  onClose,
  ingredient,
  articles = [],
  ingredients = [],
  categories = {},
  editMode,
  setEditMode,
  editForm,
  setEditForm,
  onEditSubmit,
  onDelete,
}) {
  const { t } = useTranslation("ingredients");
  const { language } = useHotelContext();
  const canEdit = usePermission("ingredients", "edit");
  const canDelete = usePermission("ingredients", "delete");
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const handleEditChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
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
      .filter(([key, val]) => val.parentId === editForm.parentCategory)
      .map(([key, val]) => ({ key, label: val.label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categories, editForm.parentCategory]);

  const handleAddArticle = article => {
    if (!article) return;
    const existing = ingredients.find(
      ing =>
        ing.id !== ingredient.id &&
        Array.isArray(ing.articles) &&
        ing.articles.includes(article.id)
    );
    if (existing) {
      setDuplicateInfo({ ingredient: existing.name, article });
      setArticleInput(null);
      return;
    }
    setEditForm(prev => {
      if (prev.articles.includes(article.id)) return prev;
      return { ...prev, articles: [...prev.articles, article.id] };
    });
    setArticleInput(null);
  };

  const confirmDuplicate = () => {
    if (duplicateInfo) {
      setEditForm(prev => {
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
    setEditForm(prev => ({ ...prev, articles: prev.articles.filter(a => a !== id) }));
  };

  if (!ingredient) return null;

  return (
    <>
      <Dialog open={open} onClose={() => { onClose(); setEditMode(false); }} className="fixed inset-0 z-50 overflow-hidden">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 sm:inset-y-0 sm:right-0 sm:max-w-md w-full bg-white shadow-xl p-6 overflow-y-auto">
          <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">
            {ingredient.name}
          </h2>
          {editMode ? (
            <form
              onSubmit={e => { e.preventDefault(); onEditSubmit(); }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1">{t("name")}</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => handleEditChange("name", e.target.value)}
                  className="border px-3 py-2 w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("aliasEn")}</label>
                <input
                  type="text"
                  value={editForm.aliases?.en || ""}
                  onChange={e =>
                    handleEditChange("aliases", {
                      ...editForm.aliases,
                      en: e.target.value,
                    })
                  }
                  className="border px-3 py-2 w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("aliasFr")}</label>
                <input
                  type="text"
                  value={editForm.aliases?.fr || ""}
                  onChange={e =>
                    handleEditChange("aliases", {
                      ...editForm.aliases,
                      fr: e.target.value,
                    })
                  }
                  className="border px-3 py-2 w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("aliasNl")}</label>
                <input
                  type="text"
                  value={editForm.aliases?.nl || ""}
                  onChange={e =>
                    handleEditChange("aliases", {
                      ...editForm.aliases,
                      nl: e.target.value,
                    })
                  }
                  className="border px-3 py-2 w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("unit")}</label>
                <input
                  type="text"
                  value={editForm.unit}
                  onChange={e => handleEditChange("unit", e.target.value)}
                  className="border px-3 py-2 w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("selectParentCategory")}</label>
                <select
                  value={editForm.parentCategory}
                  onChange={e => {
                    handleEditChange("parentCategory", e.target.value);
                    handleEditChange("category", "");
                  }}
                  className="border px-3 py-2 w-full"
                >
                  <option value="">{t("selectParentCategory")}</option>
                  {parentCategoryOptions.map(opt => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("selectSubcategory")}</label>
                <select
                  value={editForm.category}
                  onChange={e => handleEditChange("category", e.target.value)}
                  className="border px-3 py-2 w-full"
                  required
                  disabled={!editForm.parentCategory}
                >
                  <option value="">{t("selectSubcategory")}</option>
                  {childCategoryOptions.map(opt => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="block text-sm font-medium mb-1">{t("articles")}</span>
                <Combobox
                  value={articleInput}
                  onChange={handleAddArticle}
                  options={articles.filter(a => !editForm.articles.includes(a.id))}
                  displayValue={a => a?.aliases?.[language] || a?.name || ""}
                  getOptionValue={a => a.id}
                  placeholder={t("articles")}
                />
                {editForm.articles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {editForm.articles.map(id => {
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
              <div>
                <span className="block text-sm font-medium mb-1">{t("allergensLabel")}</span>
                <div className="grid grid-cols-2 gap-2">
                  {ALLERGENS.map(key => {
                    const Icon = ALLERGEN_ICONS[key];
                    return (
                      <label key={key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editForm.allergens?.[key] || false}
                          onChange={e =>
                            handleEditChange("allergens", {
                              ...editForm.allergens,
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
              <div className="flex gap-2">
                <button type="submit" className="bg-black text-white px-4 py-2">{t("save")}</button>
                <button type="button" onClick={() => setEditMode(false)} className="bg-gray-200 text-gray-800 px-4 py-2">{t("cancel")}</button>
              </div>
            </form>
          ) : (
            <>
              <ul className="text-sm text-gray-800 space-y-2">
                <li><strong>{t("unit")}: </strong>{ingredient.unit}</li>
                <li>
                  <strong>{t("category")}: </strong>
                  {categories[ingredient.category]?.label || ingredient.category}
                </li>
                {ingredient.articles && ingredient.articles.length > 0 && (
                  <li className="flex flex-col gap-1">
                    <strong className="mb-1">{t("articles")}: </strong>
                    <div className="flex flex-wrap gap-2">
                      {ingredient.articles.map(id => {
                        const art = articles.find(a => a.id === id);
                        return <ArticleMiniCard key={id} article={art} />;
                      })}
                    </div>
                  </li>
                )}
                {ingredient.allergens && Object.values(ingredient.allergens).some(v => v) && (
                  <li className="flex items-center gap-1 flex-wrap">
                    <strong>{t("allergensLabel")}: </strong>
                    {ALLERGENS.filter(a => ingredient.allergens[a]).map(a => {
                      const Icon = ALLERGEN_ICONS[a];
                      return (
                        <Icon
                          key={a}
                          className="w-4 h-4"
                          title={t(`allergens.${a}`)}
                        />
                      );
                    })}
                  </li>
                )}
              </ul>
            </>
          )}
          {!editMode && (
            <div className="mt-6 flex flex-wrap gap-2">
              {canEdit && <button onClick={() => setEditMode(true)} className="bg-black text-white px-4 py-2">{t("edit")}</button>}
              <button onClick={() => onClose()} className="bg-gray-200 text-gray-800 px-4 py-2">{t("close")}</button>
              {canDelete && <button onClick={() => setConfirmDelete(true)} className="bg-red-600 text-white px-4 py-2">{t("delete")}</button>}
            </div>
          )}
        </div>
      </Dialog>
      <ConfirmModal
        open={confirmDelete}
        title={t("deleteConfirmationTitle")}
        message={t("deleteConfirmationMessage")}
        onConfirm={() => { setConfirmDelete(false); onDelete(); }}
        onCancel={() => setConfirmDelete(false)}
      />
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

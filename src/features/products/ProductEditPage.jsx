import React, { useEffect, useState, useMemo } from "react";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { useHotelContext } from "contexts/HotelContext";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { doc, getDoc, updateDoc, db } from "../../firebaseConfig";
import { getIngredients } from "services/firebaseIngredients";
import { getRecipesIndexed } from "services/firebaseRecipes";
import { getOutlets, getProductCategories } from "services/firebaseSettings";
import ProductForm from "./ProductForm";
import { addProduct, updateProduct } from "./productsService";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Pencil, Trash2 } from "lucide-react";

export default function ProductEditPage() {
  const { hotelUid, hotelName, language } = useHotelContext();
  const { productId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation("products");
  const { t: tCommon } = useTranslation("common");

  const [product, setProduct] = useState(null);
  const [isProductLoading, setIsProductLoading] = useState(false);
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [productCategories, setProductCategories] = useState({});
  const [stepText, setStepText] = useState("");
  const [stepFiles, setStepFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingStepIndex, setEditingStepIndex] = useState(null);
  const [editingStepText, setEditingStepText] = useState("");
  const [editingStepFiles, setEditingStepFiles] = useState([]);

  const isNewProduct = !productId;

  const searchParamsString = searchParams.toString();

  const initialProductValues = useMemo(() => {
    const params = new URLSearchParams(searchParamsString);
    return {
      name: params.get("name") || "",
      lightspeedId: params.get("lightspeedId") || "",
      price: params.get("price") || "",
      saleUnit: params.get("saleUnit") || "",
    };
  }, [searchParamsString]);

  useEffect(() => {
    if (!hotelUid) return;

    getIngredients(hotelUid).then(res =>
      setIngredients(res.filter(ing => ing.active !== false))
    );
    getRecipesIndexed(hotelUid).then(setRecipes);
    getOutlets(hotelUid).then(o => setOutlets(o || []));
    getProductCategories().then(setProductCategories);
  }, [hotelUid]);

  useEffect(() => {
    if (!hotelUid) return;

    if (!productId) {
      setProduct(null);
      setIsProductLoading(false);
      return;
    }

    setIsProductLoading(true);
    const load = async () => {
      const snap = await getDoc(doc(db, `hotels/${hotelUid}/products/${productId}`));
      if (snap.exists()) {
        setProduct({ id: snap.id, ...snap.data() });
      } else {
        setProduct(null);
      }
      setIsProductLoading(false);
    };

    load();
  }, [hotelUid, productId]);

  const handleFormSubmit = async data => {
    if (isNewProduct) {
      const newProductId = await addProduct(hotelUid, data);
      navigate(newProductId ? `/products/${newProductId}` : "/products");
      return;
    }

    await updateProduct(hotelUid, productId, data);
    navigate(`/products/${productId}`);
  };

  const uploadPhotos = async files => {
    const storage = getStorage();
    const urls = [];
    for (const file of files) {
      const storageRef = ref(
        storage,
        `hotels/${hotelUid}/products/${productId}/${Date.now()}_${file.name}`
      );
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type,
      });
      const url = await new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          snapshot => {
            setUploadProgress(
              Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
            );
          },
          reject,
          () =>
            getDownloadURL(uploadTask.snapshot.ref)
              .then(resolve)
              .catch(reject)
        );
      });
      urls.push(url);
    }
    setUploadProgress(0);
    return urls;
  };

  const handleAddStep = async e => {
    e.preventDefault();
    if (!product || !stepText) return;
    const photos = await uploadPhotos(stepFiles);
    const newSteps = [...(product.steps || []), { description: stepText, photos }];
    await updateDoc(doc(db, `hotels/${hotelUid}/products/${product.id}`), { steps: newSteps });
    setProduct(p => ({ ...p, steps: newSteps }));
    setStepText("");
    setStepFiles([]);
  };

  const handleStartEditStep = idx => {
    const step = product?.steps?.[idx];
    if (!step) return;
    setEditingStepIndex(idx);
    setEditingStepText(step.description);
    setEditingStepFiles([]);
  };

  const handleCancelEditStep = () => {
    setEditingStepIndex(null);
    setEditingStepText("");
    setEditingStepFiles([]);
  };

  const handleUpdateStep = async e => {
    e.preventDefault();
    if (editingStepIndex === null || !product) return;
    const photos = await uploadPhotos(editingStepFiles);
    const updatedSteps = product.steps.map((s, i) =>
      i === editingStepIndex
        ? { ...s, description: editingStepText, photos: [...(s.photos || []), ...photos] }
        : s
    );
    await updateDoc(doc(db, `hotels/${hotelUid}/products/${product.id}`), {
      steps: updatedSteps,
    });
    setProduct(p => ({ ...p, steps: updatedSteps }));
    handleCancelEditStep();
  };

  const handleDeleteStep = async idx => {
    if (!product) return;
    if (!window.confirm(t("editSteps.deleteConfirm"))) return;
    const newSteps = product.steps.filter((_, i) => i !== idx);
    await updateDoc(doc(db, `hotels/${hotelUid}/products/${product.id}`), {
      steps: newSteps,
    });
    setProduct(p => ({ ...p, steps: newSteps }));
  };

  const locale = language === "en" ? "en-GB" : language === "fr" ? "fr-FR" : "nl-NL";
  const today = useMemo(
    () =>
      new Date().toLocaleDateString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [locale]
  );

  const handleLogout = () => {
    if (window.confirm(tCommon("logoutConfirm"))) {
      sessionStorage.clear();
      window.location.href = "/login";
    }
  };

  const handleBackNavigation = React.useCallback(() => {
    if (typeof window !== "undefined" && window.history?.length > 1) {
      navigate(-1);
      return;
    }

    navigate(productId ? `/products/${productId}` : "/products", { replace: true });
  }, [navigate, productId]);

  return (
    <>
      <HeaderBar hotelName={hotelName} today={today} onLogout={handleLogout} />
      <PageContainer className="max-w-3xl">
        <button
          type="button"
          className="mb-4 text-sm underline"
          onClick={handleBackNavigation}
        >
          {t("details.back")}
        </button>
        {(isNewProduct || (!isProductLoading && product)) && (
          <>
            <ProductForm
              asPage
              open
              onClose={handleBackNavigation}
              onSubmit={handleFormSubmit}
              ingredients={ingredients}
              recipes={recipes}
              outlets={outlets}
              categories={productCategories}
              editProduct={isNewProduct ? null : product}
              initialValues={isNewProduct ? initialProductValues : undefined}
            />
            {!isNewProduct && product && (
              <div className="p-6 max-w-lg w-full">
                <section>
                  <h2 className="mb-2 text-xl font-bold">{t("editSteps.title")}</h2>
                  {(product.steps || []).map((step, idx) => (
                    <div key={idx} className="mb-4 rounded border bg-white p-4 shadow">
                      <div className="mb-2 flex items-start justify-between">
                        <p className="font-medium">{t("editSteps.step", { index: idx + 1 })}</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleStartEditStep(idx)} className="rounded p-1 hover:bg-gray-200" title={t("editSteps.edit")}>
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDeleteStep(idx)} className="rounded p-1 hover:bg-red-100" title={t("editSteps.delete")}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    {editingStepIndex === idx ? (
                      <form onSubmit={handleUpdateStep} className="space-y-2">
                        <textarea className="w-full border p-2" value={editingStepText} onChange={e => setEditingStepText(e.target.value)} />
                        <input type="file" multiple onChange={e => setEditingStepFiles(Array.from(e.target.files || []))} />
                        {uploadProgress > 0 && <p className="text-sm text-gray-600">{t("editSteps.uploading", { progress: uploadProgress })}</p>}
                        <div className="flex justify-end gap-2 pt-2">
                          <button type="button" onClick={handleCancelEditStep} className="px-4 py-2">{t("form.cancel")}</button>
                          <button type="submit" className="bg-black px-4 py-2 text-white">{t("form.submitEdit")}</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <p className="mb-2">{step.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {(step.photos || []).map((url, i) => (
                            <img key={i} src={url} alt="step" className="h-32 w-32 rounded object-cover" />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}
                  <form onSubmit={handleAddStep} className="mt-4 space-y-2 rounded border bg-white p-4 shadow">
                    <textarea className="w-full border p-2" placeholder={t("editSteps.placeholder")}
                      value={stepText}
                      onChange={e => setStepText(e.target.value)} />
                    <input type="file" multiple onChange={e => setStepFiles(Array.from(e.target.files || []))} />
                    {uploadProgress > 0 && <p className="text-sm text-gray-600">{t("editSteps.uploading", { progress: uploadProgress })}</p>}
                    <div className="flex justify-center pt-2">
                      <button type="submit" className="bg-black px-4 py-2 text-white">{t("editSteps.addStep")}</button>
                    </div>
                  </form>
                </section>
              </div>
            )}
          </>
        )}
      </PageContainer>
    </>
  );
}


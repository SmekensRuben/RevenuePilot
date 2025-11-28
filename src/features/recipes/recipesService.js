import {
  db,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
} from "../../firebaseConfig";
import {
  rebuildRecipeCategoryIndex,
  clearRecipesIndexedCache,
} from "../../services/firebaseRecipes";
import { getIngredientsIndexed } from "../../services/firebaseIngredients";

async function validateIngredients(hotelUid, composition = []) {
  if (!hotelUid || !Array.isArray(composition)) return;
  const ingredients = await getIngredientsIndexed(hotelUid);
  const validIds = new Set(ingredients.map(i => i.id));
  const invalid = composition.find(row => !validIds.has(row.ingredientId));
  if (invalid) {
    throw new Error(`Invalid ingredient ID: ${invalid.ingredientId}`);
  }
}

export async function getRecipes(hotelUid) {
  if (!hotelUid) return [];
  const recipesCol = collection(db, `hotels/${hotelUid}/recipes`);
  const snap = await getDocs(recipesCol);
  return snap.docs.map(docSnap => ({
    ...docSnap.data(),
    id: docSnap.id
  }));
}

export async function addRecipe(hotelUid, data) {
  if (!hotelUid) return;
  await validateIngredients(hotelUid, data.composition);
  const recipesCol = collection(db, `hotels/${hotelUid}/recipes`);
  const recipeData = { ...data, category: data.category ?? "" };
  await addDoc(recipesCol, recipeData);
  await rebuildRecipeCategoryIndex(hotelUid, recipeData.category);
  clearRecipesIndexedCache(hotelUid);
}

export async function updateRecipe(hotelUid, id, data) {
  if (!hotelUid || !id) return;
  await validateIngredients(hotelUid, data.composition);
  const recipeDoc = doc(db, `hotels/${hotelUid}/recipes`, id);
  const currentSnap = await getDoc(recipeDoc);
  let oldCategory = "";
  if (currentSnap.exists()) {
    const current = currentSnap.data();
    oldCategory = current.category || "";
  }

  await updateDoc(recipeDoc, data);
  const newCategory = data.category !== undefined ? data.category : oldCategory;
  await rebuildRecipeCategoryIndex(hotelUid, newCategory);
  if (oldCategory !== newCategory) {
    await rebuildRecipeCategoryIndex(hotelUid, oldCategory);
  }
  clearRecipesIndexedCache(hotelUid);
}

export async function deleteRecipe(hotelUid, id) {
  if (!hotelUid || !id) return;
  const recipeDoc = doc(db, `hotels/${hotelUid}/recipes`, id);
  const snap = await getDoc(recipeDoc);
  const category = snap.exists() ? snap.data().category || "" : "";
  await deleteDoc(recipeDoc);
  await rebuildRecipeCategoryIndex(hotelUid, category);
  clearRecipesIndexedCache(hotelUid);
}

import {
  addDoc,
  collection,
  db,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "../firebaseConfig";
import { getSelectedHotelUid } from "../utils/hotelUtils";

export function subscribeToChecklistItems(callback) {
  const hotelUid = getSelectedHotelUid();
  if (!hotelUid) return () => {};

  const checklistRef = collection(db, `hotels/${hotelUid}/checklistItems`);
  const q = query(checklistRef, orderBy("createdAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    const checklistItems = snapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...docSnapshot.data(),
    }));

    callback(checklistItems);
  });
}

export async function uploadChecklistStepPhotos({ hotelUid, checklistId, stepIndex, files }) {
  const uploads = files.map(async (file, photoIndex) => {
    const fileExtension = file.name.split(".").pop();
    const safeExtension = fileExtension ? `.${fileExtension}` : "";
    const filePath = `hotels/${hotelUid}/checklist/${checklistId}/step-${stepIndex}/${Date.now()}-${photoIndex}${safeExtension}`;
    const fileRef = ref(storage, filePath);

    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  });

  return Promise.all(uploads);
}

export async function addChecklistItem(item) {
  const hotelUid = getSelectedHotelUid();
  if (!hotelUid) {
    throw new Error("No hotel selected");
  }

  const checklistRef = collection(db, `hotels/${hotelUid}/checklistItems`);
  const createdDoc = await addDoc(checklistRef, {
    name: item.name,
    description: item.description,
    frequency: item.frequency,
    steps: [],
    createdAt: serverTimestamp(),
  });

  const resolvedSteps = await Promise.all(
    item.steps.map(async (step, stepIndex) => {
      const files = Array.isArray(step.photoFiles) ? step.photoFiles : [];
      const photoUrls = files.length
        ? await uploadChecklistStepPhotos({
            hotelUid,
            checklistId: createdDoc.id,
            stepIndex,
            files,
          })
        : [];

      return {
        title: step.title,
        photoUrls,
      };
    })
  );

  await updateDoc(doc(db, `hotels/${hotelUid}/checklistItems/${createdDoc.id}`), {
    steps: resolvedSteps,
  });
}

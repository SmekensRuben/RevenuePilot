import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { useHotelContext } from "../../contexts/HotelContext";
import {
  auth,
  signOut,
  db,
  doc,
  getDoc,
  setDoc,
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "../../firebaseConfig";

const createStep = () => ({
  id: `step-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  title: "",
  description: "",
  photoUrls: [],
  photoFiles: [],
});

export default function VatChangeCorrectionHowToPage() {
  const { hotelUid, hotelUids = [], roles } = useHotelContext();
  const navigate = useNavigate();
  const [steps, setSteps] = useState([]);
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [showCopyPanel, setShowCopyPanel] = useState(false);
  const [hotelOptions, setHotelOptions] = useState([]);
  const [selectedHotelUids, setSelectedHotelUids] = useState([]);
  const [expandedImageUrl, setExpandedImageUrl] = useState("");

  const isAdmin = useMemo(
    () => Array.isArray(roles) && roles.some((role) => String(role).toLowerCase() === "admin"),
    [roles]
  );

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    []
  );

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  const loadHowTo = async () => {
    if (!hotelUid) {
      setSteps([]);
      return;
    }

    const settingsRef = doc(db, `hotels/${hotelUid}/settings`, hotelUid);
    const settingsSnap = await getDoc(settingsRef);
    const settings = settingsSnap.exists() ? settingsSnap.data() : {};
    const storedSteps = Array.isArray(settings?.vatChangeHowToSteps)
      ? settings.vatChangeHowToSteps
      : [];

    setSteps(
      storedSteps.map((step) => ({
        id: `step-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title: String(step?.title || ""),
        description: String(step?.description || ""),
        photoUrls: Array.isArray(step?.photoUrls) ? step.photoUrls : [],
        photoFiles: [],
      }))
    );
  };

  useEffect(() => {
    loadHowTo().catch((error) => {
      console.error(error);
      setStatus({ type: "error", message: "Laden van How To is mislukt." });
    });
  }, [hotelUid]);

  useEffect(() => {
    const loadHotelOptions = async () => {
      if (!hotelUids.length) {
        setHotelOptions([]);
        return;
      }

      const options = await Promise.all(
        hotelUids.map(async (uid) => {
          try {
            const settingsSnap = await getDoc(doc(db, `hotels/${uid}/settings`, uid));
            const settings = settingsSnap.exists() ? settingsSnap.data() : {};
            return { uid, name: settings.hotelName || uid };
          } catch {
            return { uid, name: uid };
          }
        })
      );

      setHotelOptions(options.filter((option) => option.uid !== hotelUid));
    };

    loadHotelOptions().catch((error) => {
      console.error(error);
      setStatus({ type: "error", message: "Laden van hotels is mislukt." });
    });
  }, [hotelUid, hotelUids]);

  useEffect(() => {
    setSelectedHotelUids([]);
  }, [hotelUid]);

  const uploadStepPhotos = async (step, stepIndex) => {
    const uploads = (step.photoFiles || []).map(async (file, photoIndex) => {
      const extension = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
      const filePath = `hotels/${hotelUid}/vat-change-how-to/step-${stepIndex}/${Date.now()}-${photoIndex}${extension}`;
      const fileRef = ref(storage, filePath);
      await uploadBytes(fileRef, file);
      return getDownloadURL(fileRef);
    });

    const newUrls = await Promise.all(uploads);
    return [...(step.photoUrls || []), ...newUrls];
  };

  const handleSave = async () => {
    if (!hotelUid || !isAdmin) return;
    setIsSaving(true);
    setStatus({ type: "idle", message: "" });

    try {
      const resolvedSteps = await Promise.all(
        steps.map(async (step, index) => ({
          title: String(step.title || "").trim(),
          description: String(step.description || "").trim(),
          photoUrls: await uploadStepPhotos(step, index),
        }))
      );

      const payload = resolvedSteps.filter(
        (step) => step.title || step.description || step.photoUrls.length
      );
      const settingsRef = doc(db, `hotels/${hotelUid}/settings`, hotelUid);
      await setDoc(settingsRef, { vatChangeHowToSteps: payload }, { merge: true });

      setStatus({ type: "success", message: "How To opgeslagen." });
      setIsEditing(false);
      await loadHowTo();
    } catch (error) {
      console.error(error);
      setStatus({ type: "error", message: "Opslaan van How To is mislukt." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyToHotels = async () => {
    if (!hotelUid || !isAdmin || !selectedHotelUids.length) return;

    const hasPendingPhotoFiles = steps.some((step) => (step.photoFiles || []).length);
    if (hasPendingPhotoFiles) {
      setStatus({
        type: "error",
        message: "Sla eerst op voordat je kopieert, er staan nog niet-opgeslagen foto's klaar.",
      });
      return;
    }

    setIsCopying(true);
    setStatus({ type: "idle", message: "" });

    try {
      const payload = steps
        .map((step) => ({
          title: String(step.title || "").trim(),
          description: String(step.description || "").trim(),
          photoUrls: Array.isArray(step.photoUrls) ? step.photoUrls : [],
        }))
        .filter((step) => step.title || step.description || step.photoUrls.length);

      await Promise.all(
        selectedHotelUids.map((targetHotelUid) => {
          const targetSettingsRef = doc(db, `hotels/${targetHotelUid}/settings`, targetHotelUid);
          return setDoc(targetSettingsRef, { vatChangeHowToSteps: payload }, { merge: true });
        })
      );

      setStatus({
        type: "success",
        message: `How To gekopieerd naar ${selectedHotelUids.length} hotel(s).`,
      });
      setSelectedHotelUids([]);
      setShowCopyPanel(false);
    } catch (error) {
      console.error(error);
      setStatus({ type: "error", message: "Kopiëren naar hotels is mislukt." });
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <>
      <HeaderBar today={todayLabel} onLogout={handleLogout} />
      <PageContainer title="How To">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => navigate("/reservations/vat-change-correction")}
            >
              Terug naar VAT Change Correction
            </button>

            {isAdmin ? (
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setShowCopyPanel((prev) => !prev)}
                >
                  {showCopyPanel ? "Sluit kopiëren" : "Kopieer naar hotels"}
                </button>
                <button
                  type="button"
                  className="rounded bg-[#b41f1f] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#991919]"
                  onClick={() => setIsEditing((prev) => !prev)}
                >
                  {isEditing ? "Stop edit" : "Edit"}
                </button>
              </div>
            ) : null}
          </div>

          {showCopyPanel && isAdmin ? (
            <div className="rounded border border-gray-200 bg-white p-4">
              <p className="text-sm font-semibold text-gray-800">Kopieer How To naar andere hotels</p>
              <p className="mt-1 text-sm text-gray-600">
                Selecteer hotels waar je deze stappen (inclusief afbeeldingen) naartoe wilt kopiëren.
              </p>

              {hotelOptions.length ? (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {hotelOptions.map((hotel) => {
                    const isSelected = selectedHotelUids.includes(hotel.uid);
                    return (
                      <label
                        key={hotel.uid}
                        className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setSelectedHotelUids((prev) =>
                              checked ? [...prev, hotel.uid] : prev.filter((uid) => uid !== hotel.uid)
                            );
                          }}
                        />
                        <span>{hotel.name}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 text-sm text-gray-500">Geen andere hotels beschikbaar.</div>
              )}

              <div className="mt-3">
                <button
                  type="button"
                  className="rounded bg-[#b41f1f] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#991919] disabled:opacity-70"
                  disabled={!selectedHotelUids.length || isCopying}
                  onClick={handleCopyToHotels}
                >
                  {isCopying ? "Kopiëren..." : `Kopieer naar ${selectedHotelUids.length} hotel(s)`}
                </button>
              </div>
            </div>
          ) : null}

          {status.message ? (
            <div
              className={`rounded border px-3 py-2 text-sm ${
                status.type === "error"
                  ? "border-red-300 bg-red-50 text-red-700"
                  : "border-green-300 bg-green-50 text-green-700"
              }`}
            >
              {status.message}
            </div>
          ) : null}

          <div className="space-y-4">
            {steps.length ? (
              steps.map((step, index) => (
                <div key={step.id} className="rounded border border-gray-200 bg-white p-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={step.title}
                        placeholder={`Stap ${index + 1} titel`}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                        onChange={(event) =>
                          setSteps((prev) =>
                            prev.map((item) =>
                              item.id === step.id ? { ...item, title: event.target.value } : item
                            )
                          )
                        }
                      />
                      <textarea
                        value={step.description}
                        placeholder="Beschrijving"
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                        rows={3}
                        onChange={(event) =>
                          setSteps((prev) =>
                            prev.map((item) =>
                              item.id === step.id
                                ? { ...item, description: event.target.value }
                                : item
                            )
                          )
                        }
                      />
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(event) => {
                          const files = Array.from(event.target.files || []);
                          setSteps((prev) =>
                            prev.map((item) =>
                              item.id === step.id
                                ? { ...item, photoFiles: [...(item.photoFiles || []), ...files] }
                                : item
                            )
                          );
                          event.target.value = "";
                        }}
                      />
                      <button
                        type="button"
                        className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setSteps((prev) => prev.filter((item) => item.id !== step.id))}
                      >
                        Verwijder stap
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-base font-semibold text-gray-900">
                        Stap {index + 1}: {step.title || "Zonder titel"}
                      </h3>
                      {step.description ? (
                        <p className="mt-2 text-sm text-gray-700">{step.description}</p>
                      ) : null}
                    </>
                  )}

                  {step.photoUrls?.length ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {step.photoUrls.map((url, photoIndex) => (
                        <button
                          key={`${step.id}-${photoIndex}`}
                          type="button"
                          className="overflow-hidden rounded border border-gray-200 text-left"
                          onClick={() => setExpandedImageUrl(url)}
                        >
                          <img
                            src={url}
                            alt={`Stap ${index + 1} foto ${photoIndex + 1}`}
                            className="w-full"
                          />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded border border-gray-200 bg-white p-6 text-sm text-gray-500">
                Nog geen stappen toegevoegd.
              </div>
            )}
          </div>

          {isEditing && isAdmin ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setSteps((prev) => [...prev, createStep()])}
              >
                Stap toevoegen
              </button>
              <button
                type="button"
                className="rounded bg-[#b41f1f] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#991919] disabled:opacity-70"
                disabled={isSaving}
                onClick={handleSave}
              >
                {isSaving ? "Opslaan..." : "Opslaan"}
              </button>
            </div>
          ) : null}
        </div>

        {expandedImageUrl ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
            onClick={() => setExpandedImageUrl("")}
          >
            <div className="relative max-h-full max-w-full overflow-auto" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="absolute right-2 top-2 rounded bg-black/70 px-2 py-1 text-xs font-semibold text-white hover:bg-black"
                onClick={() => setExpandedImageUrl("")}
              >
                Sluiten
              </button>
              <img src={expandedImageUrl} alt="How To afbeelding op originele grootte" className="max-w-none" />
            </div>
          </div>
        ) : null}
      </PageContainer>
    </>
  );
}

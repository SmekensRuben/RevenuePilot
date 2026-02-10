import React, { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "react-toastify";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";
import Modal from "../shared/Modal";
import { auth, signOut } from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";
import { addChecklistItem, subscribeToChecklistItems } from "../../services/firebaseChecklist";

const EMPTY_STEP = {
  title: "",
  photoFiles: [],
};

function createEmptyForm() {
  return {
    name: "",
    description: "",
    frequency: "",
    steps: [{ ...EMPTY_STEP }],
  };
}

export default function ChecklistPage() {
  const { hotelUid } = useHotelContext();
  const [checklistItems, setChecklistItems] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(createEmptyForm);

  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, []);

  useEffect(() => {
    if (!hotelUid) {
      setChecklistItems([]);
      return undefined;
    }

    const unsubscribe = subscribeToChecklistItems(setChecklistItems);
    return () => unsubscribe && unsubscribe();
  }, [hotelUid]);

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  const closeModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setFormData(createEmptyForm());
  };

  const updateStep = (stepIndex, updater) => {
    setFormData((previous) => ({
      ...previous,
      steps: previous.steps.map((step, index) => (index === stepIndex ? updater(step) : step)),
    }));
  };

  const addStep = () => {
    setFormData((previous) => ({
      ...previous,
      steps: [...previous.steps, { ...EMPTY_STEP }],
    }));
  };

  const removeStep = (stepIndex) => {
    setFormData((previous) => {
      const nextSteps = previous.steps.filter((_, index) => index !== stepIndex);
      return {
        ...previous,
        steps: nextSteps.length ? nextSteps : [{ ...EMPTY_STEP }],
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Naam is verplicht.");
      return;
    }

    if (!formData.frequency.trim()) {
      toast.error("Frequentie is verplicht.");
      return;
    }

    if (!formData.steps.length || formData.steps.some((step) => !step.title.trim())) {
      toast.error("Elke stap in het stappenplan moet een naam hebben.");
      return;
    }

    setIsSaving(true);

    try {
      await addChecklistItem({
        name: formData.name.trim(),
        description: formData.description.trim(),
        frequency: formData.frequency.trim(),
        steps: formData.steps.map((step) => ({
          title: step.title.trim(),
          photoFiles: step.photoFiles,
        })),
      });

      toast.success("Checklist item toegevoegd.");
      setFormData(createEmptyForm());
      setIsModalOpen(false);
    } catch (error) {
      console.error("Kon checklist item niet opslaan", error);
      toast.error("Er liep iets mis bij het opslaan.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <HeaderBar today={todayLabel} onLogout={handleLogout} />
      <PageContainer className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wide text-[#b41f1f] font-semibold">Checklist</p>
            <h1 className="text-2xl sm:text-3xl font-bold">Checklist overzicht</h1>
            <p className="text-gray-600 mt-1">Beheer checklist items met stappenplan en foto&apos;s per stap.</p>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="bg-[#b41f1f] text-white px-4 py-2 rounded-full shadow hover:bg-[#961919] transition-colors inline-flex items-center gap-2 self-start"
          >
            <Plus className="h-4 w-4" />
            <span>Checklist item toevoegen</span>
          </button>
        </div>

        <Card>
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-lg font-semibold">Checklist items</h2>
              <p className="text-sm text-gray-600">
                {checklistItems.length} item{checklistItems.length === 1 ? "" : "s"} gevonden
              </p>
            </div>
          </div>

          {!checklistItems.length ? (
            <p className="text-gray-600">Nog geen checklist items aangemaakt.</p>
          ) : (
            <div className="space-y-4">
              {checklistItems.map((item) => (
                <div key={item.id} className="border rounded-lg bg-white p-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{item.description || "Geen beschrijving"}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-[#b41f1f]/10 text-[#b41f1f] px-3 py-1 text-xs font-semibold">
                      Frequentie: {item.frequency}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {(item.steps || []).map((step, stepIndex) => (
                      <div key={`${item.id}-step-${stepIndex}`} className="rounded border border-gray-100 p-3">
                        <p className="text-sm font-semibold">Stap {stepIndex + 1}: {step.title}</p>
                        {!!step.photoUrls?.length && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                            {step.photoUrls.map((photoUrl, photoIndex) => (
                              <a
                                key={`${item.id}-step-${stepIndex}-photo-${photoIndex}`}
                                href={photoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block"
                              >
                                <img
                                  src={photoUrl}
                                  alt={`Stap ${stepIndex + 1} foto ${photoIndex + 1}`}
                                  className="h-32 w-full object-cover rounded border"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </PageContainer>

      <Modal open={isModalOpen} onClose={closeModal} title="Checklist item toevoegen">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="checklist-name">
              Naam
            </label>
            <input
              id="checklist-name"
              type="text"
              value={formData.name}
              onChange={(event) => setFormData((previous) => ({ ...previous, name: event.target.value }))}
              className="w-full rounded border border-gray-300 px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="checklist-description">
              Beschrijving
            </label>
            <textarea
              id="checklist-description"
              value={formData.description}
              onChange={(event) => setFormData((previous) => ({ ...previous, description: event.target.value }))}
              className="w-full rounded border border-gray-300 px-3 py-2"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="checklist-frequency">
              Frequentie
            </label>
            <input
              id="checklist-frequency"
              type="text"
              value={formData.frequency}
              onChange={(event) => setFormData((previous) => ({ ...previous, frequency: event.target.value }))}
              className="w-full rounded border border-gray-300 px-3 py-2"
              placeholder="Bijvoorbeeld: dagelijks"
              required
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800">Stappenplan</p>
              <button
                type="button"
                onClick={addStep}
                className="text-sm font-semibold text-[#b41f1f] hover:underline"
              >
                + Stap toevoegen
              </button>
            </div>

            {formData.steps.map((step, stepIndex) => (
              <div key={`form-step-${stepIndex}`} className="border rounded p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-sm font-medium text-gray-700" htmlFor={`step-${stepIndex}`}>
                    Stap {stepIndex + 1}
                  </label>
                  <button
                    type="button"
                    onClick={() => removeStep(stepIndex)}
                    className="text-xs font-semibold text-red-600 hover:underline"
                  >
                    Verwijderen
                  </button>
                </div>

                <input
                  id={`step-${stepIndex}`}
                  type="text"
                  value={step.title}
                  onChange={(event) =>
                    updateStep(stepIndex, (current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2"
                  placeholder="Naam van de stap"
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`step-photos-${stepIndex}`}>
                    Foto&apos;s toevoegen
                  </label>
                  <input
                    id={`step-photos-${stepIndex}`}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => {
                      const files = Array.from(event.target.files || []);
                      updateStep(stepIndex, (current) => ({
                        ...current,
                        photoFiles: files,
                      }));
                    }}
                    className="w-full text-sm"
                  />
                  {!!step.photoFiles.length && (
                    <p className="text-xs text-gray-500 mt-1">
                      {step.photoFiles.length} foto{step.photoFiles.length === 1 ? "" : "'s"} geselecteerd
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="px-3 py-2 rounded border border-gray-300 text-gray-700"
              disabled={isSaving}
            >
              Annuleren
            </button>
            <button
              type="submit"
              className="px-3 py-2 rounded bg-[#b41f1f] text-white hover:bg-[#961919] disabled:opacity-60"
              disabled={isSaving}
            >
              {isSaving ? "Opslaan..." : "Opslaan"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

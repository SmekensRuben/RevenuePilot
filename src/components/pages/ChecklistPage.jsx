import React, { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";
import Modal from "../shared/Modal";
import { auth, signOut } from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";
import {
  addChecklistItem,
  clearChecklistItemsCompleted,
  deleteChecklistItem,
  subscribeToChecklistItems,
  toggleChecklistItemCompleted,
  updateChecklistItem,
} from "../../services/firebaseChecklist";

const FREQUENCIES = ["Daily", "Weekly", "Monthly"];
const IMPORTANCE_LEVELS = ["Low", "Medium", "High"];
const IMPORTANCE_ORDER = {
  High: 3,
  Medium: 2,
  Low: 1,
};

function getImportanceLabel(importance) {
  return IMPORTANCE_LEVELS.includes(importance) ? importance : "Medium";
}

const EMPTY_STEP = {
  title: "",
  photoFiles: [],
  photoUrls: [],
};

function createEmptyForm() {
  return {
    name: "",
    description: "",
    frequency: FREQUENCIES[0],
    importance: "Medium",
    steps: [],
  };
}

function createFormFromItem(item) {
  return {
    name: item.name || "",
    description: item.description || "",
    frequency: item.frequency || FREQUENCIES[0],
    importance: getImportanceLabel(item.importance),
    steps:
      item.steps?.map((step) => ({
        title: step.title || "",
        photoFiles: [],
        photoUrls: step.photoUrls || [],
      })) || [],
  };
}

export default function ChecklistPage() {
  const navigate = useNavigate();
  const { hotelUid } = useHotelContext();
  const [checklistItems, setChecklistItems] = useState([]);
  const [activeFrequency, setActiveFrequency] = useState(FREQUENCIES[0]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearingChecked, setIsClearingChecked] = useState(false);
  const [formData, setFormData] = useState(createEmptyForm);
  const [editingItemId, setEditingItemId] = useState(null);

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

  const visibleItems = useMemo(
    () =>
      checklistItems
        .filter((item) => item.frequency === activeFrequency)
        .sort((leftItem, rightItem) => {
          const leftImportance = IMPORTANCE_ORDER[getImportanceLabel(leftItem.importance)] || 0;
          const rightImportance = IMPORTANCE_ORDER[getImportanceLabel(rightItem.importance)] || 0;

          if (leftImportance !== rightImportance) {
            return rightImportance - leftImportance;
          }

          return (leftItem.name || "").localeCompare(rightItem.name || "");
        }),
    [activeFrequency, checklistItems]
  );

  const checkedVisibleItems = useMemo(
    () => visibleItems.filter((item) => item.isCompleted),
    [visibleItems]
  );

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  const openCreateModal = () => {
    setEditingItemId(null);
    setFormData(createEmptyForm());
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItemId(item.id);
    setFormData(createFormFromItem(item));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setEditingItemId(null);
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
        steps: nextSteps,
      };
    });
  };

  const handleDeleteItem = async (itemId) => {
    const confirmed = window.confirm("Weet je zeker dat je dit checklist item wilt verwijderen?");
    if (!confirmed) return;

    try {
      await deleteChecklistItem(itemId);
      toast.success("Checklist item verwijderd.");
    } catch (error) {
      console.error("Kon checklist item niet verwijderen", error);
      toast.error("Er liep iets mis bij het verwijderen.");
    }
  };

  const handleToggleCompleted = async (item) => {
    const nextCompletedState = !item.isCompleted;

    try {
      await toggleChecklistItemCompleted(item.id, nextCompletedState);
      toast.success(nextCompletedState ? "Checklist item afgevinkt." : "Checklist item opnieuw geopend.");
    } catch (error) {
      console.error("Kon status van checklist item niet wijzigen", error);
      toast.error("Er liep iets mis bij het bijwerken van de status.");
    }
  };

  const handleClearChecked = async () => {
    if (!checkedVisibleItems.length) return;

    setIsClearingChecked(true);

    try {
      await clearChecklistItemsCompleted(checkedVisibleItems.map((item) => item.id));
      toast.success("Alle checkmarks zijn verwijderd.");
    } catch (error) {
      console.error("Kon checkmarks niet wissen", error);
      toast.error("Er liep iets mis bij het clearen van checkmarks.");
    } finally {
      setIsClearingChecked(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Naam is verplicht.");
      return;
    }

    if (!FREQUENCIES.includes(formData.frequency)) {
      toast.error("Selecteer een geldige frequentie.");
      return;
    }

    if (!IMPORTANCE_LEVELS.includes(formData.importance)) {
      toast.error("Selecteer een geldige prioriteit.");
      return;
    }

    const normalizedSteps = formData.steps
      .map((step) => ({
        ...step,
        title: step.title.trim(),
      }))
      .filter((step) => step.title);

    if (formData.steps.some((step) => step.title && !step.title.trim())) {
      toast.error("Elke ingevulde stap in het stappenplan moet een naam hebben.");
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        frequency: formData.frequency,
        importance: formData.importance,
        steps: normalizedSteps.map((step) => ({
          title: step.title,
          photoFiles: step.photoFiles,
          photoUrls: step.photoUrls,
        })),
      };

      if (editingItemId) {
        await updateChecklistItem(editingItemId, payload);
        toast.success("Checklist item bijgewerkt.");
      } else {
        await addChecklistItem(payload);
        toast.success("Checklist item toegevoegd.");
      }

      closeModal();
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
            <p className="text-gray-600 mt-1">Beheer checklist items met stappenplan en status.</p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="bg-[#b41f1f] text-white px-4 py-2 rounded-full shadow hover:bg-[#961919] transition-colors inline-flex items-center gap-2 self-start"
          >
            <Plus className="h-4 w-4" />
            <span>Checklist item toevoegen</span>
          </button>
        </div>

        <Card>
          <div className="flex flex-wrap gap-2 mb-5">
            {FREQUENCIES.map((frequency) => (
              <button
                key={frequency}
                type="button"
                onClick={() => setActiveFrequency(frequency)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                  activeFrequency === frequency
                    ? "bg-[#b41f1f] text-white border-[#b41f1f]"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                }`}
              >
                {frequency}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-lg font-semibold">Checklist items ({activeFrequency})</h2>
              <p className="text-sm text-gray-600">
                {visibleItems.length} item{visibleItems.length === 1 ? "" : "s"} gevonden
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearChecked}
              disabled={!checkedVisibleItems.length || isClearingChecked}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClearingChecked ? "Clearing..." : "Clear checked"}
            </button>
          </div>

          {!visibleItems.length ? (
            <p className="text-gray-600">Nog geen checklist items voor deze frequentie.</p>
          ) : (
            <div className="space-y-4">
              {visibleItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(`/checklist/${item.id}`)}
                  className="w-full text-left border rounded-lg bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <input
                        id={`checklist-completed-${item.id}`}
                        type="checkbox"
                        checked={!!item.isCompleted}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => handleToggleCompleted(item)}
                        className="mt-1 h-4 w-4 accent-[#b41f1f]"
                      />
                      <div>
                        <p
                          className={`text-lg font-semibold ${item.isCompleted ? "line-through text-gray-500" : "text-gray-900"}`}
                        >
                          {item.name}
                        </p>
                        <p className="text-xs font-semibold text-[#b41f1f] mt-1">
                          Prioriteit: {getImportanceLabel(item.importance)}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">{item.description || "Geen beschrijving"}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="inline-flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Bewerken
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        className="inline-flex items-center gap-1 rounded border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Verwijderen
                      </button>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </PageContainer>

      <Modal open={isModalOpen} onClose={closeModal} title={editingItemId ? "Checklist item bewerken" : "Checklist item toevoegen"}>
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
            <select
              id="checklist-frequency"
              value={formData.frequency}
              onChange={(event) => setFormData((previous) => ({ ...previous, frequency: event.target.value }))}
              className="w-full rounded border border-gray-300 px-3 py-2"
              required
            >
              {FREQUENCIES.map((frequency) => (
                <option key={frequency} value={frequency}>
                  {frequency}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="checklist-importance">
              Prioriteit
            </label>
            <select
              id="checklist-importance"
              value={formData.importance}
              onChange={(event) => setFormData((previous) => ({ ...previous, importance: event.target.value }))}
              className="w-full rounded border border-gray-300 px-3 py-2"
              required
            >
              {IMPORTANCE_LEVELS.map((importance) => (
                <option key={importance} value={importance}>
                  {importance}
                </option>
              ))}
            </select>
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
                />

                {!editingItemId && (
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
                )}
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

import React, { useCallback, useEffect, useMemo, useState } from "react";
import HeaderBar from "layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { useHotelContext } from "contexts/HotelContext";
import {
  addStaffContractType,
  deleteStaffContractType,
  getSettings,
  getStaffContractTypes,
  updateStaffContractType,
} from "services/firebaseSettings";
import { getSelectedHotelUid } from "utils/hotelUtils";
import { useTranslation } from "react-i18next";

const formatCoefficient = value => {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return value.toLocaleString("nl-BE", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
};

function AddContractTypeForm({ onAdd, disabled }) {
  const [form, setForm] = useState({ name: "", coefficient: "1" });
  const [error, setError] = useState("");

  const handleSubmit = async event => {
    event.preventDefault();
    if (disabled) return;
    setError("");
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setError("Naam is verplicht.");
      return;
    }
    const coefficientValue = form.coefficient === ""
      ? 1
      : Number.parseFloat(form.coefficient);
    if (!Number.isFinite(coefficientValue) || coefficientValue <= 0) {
      setError("Coëfficiënt moet een positief getal zijn.");
      return;
    }
    const success = await onAdd({ name: trimmedName, coefficient: coefficientValue });
    if (success) {
      setForm({ name: "", coefficient: "1" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-marriott">Nieuw contracttype</h2>
      <p className="mt-1 text-sm text-gray-500">
        Voeg een contracttype toe en koppel hier een coëfficiënt aan om de uurkost te berekenen.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Naam
          <input
            className="rounded border border-gray-300 px-3 py-2 focus:border-marriott focus:outline-none focus:ring-2 focus:ring-marriott/30"
            placeholder="bv. Voltijds"
            value={form.name}
            onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
            disabled={disabled}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Coëfficiënt
          <input
            type="number"
            step="0.01"
            min="0"
            className="rounded border border-gray-300 px-3 py-2 focus:border-marriott focus:outline-none focus:ring-2 focus:ring-marriott/30"
            value={form.coefficient}
            onChange={event => setForm(current => ({ ...current, coefficient: event.target.value }))}
            disabled={disabled}
          />
        </label>
      </div>
      {error && <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="submit"
          disabled={disabled}
          className="rounded bg-marriott px-4 py-2 text-sm font-semibold text-white hover:bg-marriott-dark disabled:opacity-60"
        >
          Toevoegen
        </button>
      </div>
    </form>
  );
}

function ContractTypeRow({ type, onUpdate, onDelete, saving, deleting }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: type.name || "", coefficient: type.coefficient ?? 1 });
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({ name: type.name || "", coefficient: type.coefficient ?? 1 });
    setError("");
  }, [type]);

  const handleSave = async () => {
    setError("");
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setError("Naam is verplicht.");
      return;
    }
    const coefficientValue = Number.parseFloat(form.coefficient);
    if (!Number.isFinite(coefficientValue) || coefficientValue <= 0) {
      setError("Coëfficiënt moet een positief getal zijn.");
      return;
    }
    const success = await onUpdate(type.id, { name: trimmedName, coefficient: coefficientValue });
    if (success) {
      setEditing(false);
    }
  };

  const handleDelete = async () => {
    if (deleting || saving) return;
    if (!window.confirm(`Contracttype "${type.name}" verwijderen?`)) return;
    await onDelete(type.id);
  };

  return (
    <tr className="border-b border-gray-100 last:border-b-0">
      <td className="px-4 py-3 align-middle text-sm text-gray-900">
        {editing ? (
          <input
            className="w-full rounded border border-gray-300 px-3 py-2 focus:border-marriott focus:outline-none focus:ring-2 focus:ring-marriott/30"
            value={form.name}
            onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
            disabled={saving}
          />
        ) : (
          <span className="font-medium">{type.name || "-"}</span>
        )}
      </td>
      <td className="px-4 py-3 align-middle text-sm text-gray-900">
        {editing ? (
          <input
            type="number"
            min="0"
            step="0.01"
            className="w-full rounded border border-gray-300 px-3 py-2 focus:border-marriott focus:outline-none focus:ring-2 focus:ring-marriott/30"
            value={form.coefficient}
            onChange={event => setForm(current => ({ ...current, coefficient: event.target.value }))}
            disabled={saving}
          />
        ) : (
          formatCoefficient(type.coefficient)
        )}
      </td>
      <td className="px-4 py-3 align-middle text-right text-sm">
        {editing ? (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="rounded border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
            >
              Annuleer
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-marriott px-3 py-1 text-xs font-semibold text-white hover:bg-marriott-dark disabled:opacity-60"
            >
              {saving ? "Opslaan…" : "Opslaan"}
            </button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
            >
              Bewerk
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {deleting ? "Verwijderen…" : "Verwijderen"}
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

export default function StaffContractSettingsPage() {
  const { hotelName: hotelContextName, language } = useHotelContext?.() || {};
  const hotelUid = getSelectedHotelUid();
  const { t: tCommon } = useTranslation("common");

  const locale = useMemo(() => {
    switch (language) {
      case "en":
        return "en-GB";
      case "fr":
        return "fr-FR";
      default:
        return "nl-NL";
    }
  }, [language]);
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    [locale]
  );

  const [settings, setSettingsState] = useState({});
  useEffect(() => {
    if (!hotelUid) return;
    getSettings(hotelUid).then(setSettingsState);
  }, [hotelUid]);

  const [contractTypes, setContractTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [actionError, setActionError] = useState("");
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const refreshContractTypes = useCallback(async () => {
    if (!hotelUid) {
      setContractTypes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setPageError("");
    try {
      const types = await getStaffContractTypes(hotelUid);
      setContractTypes(Array.isArray(types) ? types : []);
    } catch (error) {
      console.error("Failed to load staff contract types", error);
      setContractTypes([]);
      setPageError("Kon contracttypes niet laden.");
    } finally {
      setLoading(false);
    }
  }, [hotelUid]);

  useEffect(() => {
    refreshContractTypes();
  }, [refreshContractTypes]);

  const handleAddContractType = useCallback(
    async payload => {
      if (!hotelUid) return false;
      setActionError("");
      setAdding(true);
      try {
        await addStaffContractType(payload);
        await refreshContractTypes();
        return true;
      } catch (error) {
        console.error("Failed to add contract type", error);
        setActionError(error?.message || "Toevoegen mislukt.");
        return false;
      } finally {
        setAdding(false);
      }
    },
    [hotelUid, refreshContractTypes]
  );

  const handleUpdateContractType = useCallback(
    async (id, updates) => {
      if (!hotelUid || !id) return false;
      setActionError("");
      setSavingId(id);
      try {
        await updateStaffContractType(id, updates);
        await refreshContractTypes();
        return true;
      } catch (error) {
        console.error("Failed to update contract type", error);
        setActionError(error?.message || "Bijwerken mislukt.");
        return false;
      } finally {
        setSavingId("");
      }
    },
    [hotelUid, refreshContractTypes]
  );

  const handleDeleteContractType = useCallback(
    async id => {
      if (!hotelUid || !id) return false;
      setActionError("");
      setDeletingId(id);
      try {
        await deleteStaffContractType(id);
        await refreshContractTypes();
        return true;
      } catch (error) {
        console.error("Failed to delete contract type", error);
        setActionError(error?.message || "Verwijderen mislukt.");
        return false;
      } finally {
        setDeletingId("");
      }
    },
    [hotelUid, refreshContractTypes]
  );

  const handleLogout = async () => {
    if (window.confirm(tCommon("logoutConfirm"))) {
      sessionStorage.clear();
      window.location.href = "/login";
    }
  };

  const heading = useMemo(() => settings?.hotelName || hotelContextName, [hotelContextName, settings?.hotelName]);

  return (
    <>
      <HeaderBar hotelName={heading} today={todayLabel} onLogout={handleLogout} />
      <PageContainer className="flex-1 bg-gray-50 min-h-screen">
        <main className="mx-auto w-full max-w-5xl px-4 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Personeelsinstellingen</h1>
            <p className="mt-1 text-sm text-gray-600">
              Beheer de contracttypes en bijhorende coëfficiënten voor de berekening van uurkosten.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <AddContractTypeForm onAdd={handleAddContractType} disabled={adding} />
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-marriott">Beschikbare contracttypes</h2>
              <p className="mt-1 text-sm text-gray-500">
                Deze lijst wordt gebruikt als suggestie bij het toewijzen van contracttypes aan personeelsleden.
              </p>
              {pageError && (
                <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{pageError}</p>
              )}
              {actionError && (
                <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{actionError}</p>
              )}
              <div className="mt-4 overflow-hidden rounded-lg border border-gray-100">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Naam
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Coëfficiënt
                      </th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Acties
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {loading ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">
                          Contracttypes laden...
                        </td>
                      </tr>
                    ) : contractTypes.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">
                          Nog geen contracttypes beschikbaar.
                        </td>
                      </tr>
                    ) : (
                      contractTypes.map(type => (
                        <ContractTypeRow
                          key={type.id}
                          type={type}
                          onUpdate={handleUpdateContractType}
                          onDelete={handleDeleteContractType}
                          saving={savingId === type.id}
                          deleting={deletingId === type.id}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </PageContainer>
    </>
  );
}

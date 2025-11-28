import React, { useEffect, useState } from "react";

export default function OutletCard({ outlet, onSave, onDelete }) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(outlet.name);
  const [department, setDepartment] = useState(outlet.department || "");
  const [description, setDescription] = useState(outlet.description || "");
  const [outletId, setOutletId] = useState(outlet.outletId || "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [subOutlets, setSubOutlets] = useState(outlet.subOutlets || []);
  const [costCenterIds, setCostCenterIds] = useState(
    Array.isArray(outlet.costCenterIds) ? outlet.costCenterIds : []
  );
  const [subForm, setSubForm] = useState({
    name: "",
    a3MappingCode: "",
    type: "food",
    subType: "Liquor",
  });
  const [savingSub, setSavingSub] = useState(false);
  const [menuCategories, setMenuCategories] = useState(outlet.menuCategories || []);
  const [newCategory, setNewCategory] = useState("");
  const [editIdx, setEditIdx] = useState(-1);
  const [editValue, setEditValue] = useState("");
  const [savingCat, setSavingCat] = useState(false);
  const [newCostCenter, setNewCostCenter] = useState("");
  const [editCostCenterIdx, setEditCostCenterIdx] = useState(-1);
  const [editCostCenterValue, setEditCostCenterValue] = useState("");
  const [savingCostCenter, setSavingCostCenter] = useState(false);

  useEffect(() => {
    setSubOutlets(outlet.subOutlets || []);
    setMenuCategories(outlet.menuCategories || []);
    setCostCenterIds(Array.isArray(outlet.costCenterIds) ? outlet.costCenterIds : []);
  }, [outlet.subOutlets, outlet.menuCategories, outlet.costCenterIds]);

  useEffect(() => {
    setOutletId(outlet.outletId || "");
  }, [outlet.outletId]);

  useEffect(() => {
    setName(outlet.name);
    setDepartment(outlet.department || "");
    setDescription(outlet.description || "");
  }, [outlet.name, outlet.department, outlet.description]);

  const inputClassName =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-marriott focus:outline-none focus:ring-2 focus:ring-marriott/20";
  const chipClassName =
    "inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm";

  function resetGeneralForm() {
    setName(outlet.name);
    setDepartment(outlet.department || "");
    setDescription(outlet.description || "");
    setOutletId(outlet.outletId || "");
  }

  async function handleSaveGeneral(event) {
    event?.preventDefault();
    setSaving(true);
    await onSave({
      name,
      department,
      description,
      outletId: outletId.trim(),
      costCenterIds,
    });
    setSaving(false);
    setEdit(false);
  }

  async function handleAddSubOutlet(event) {
    event?.preventDefault();
    if (!subForm.name || !subForm.a3MappingCode) return;
    if (subForm.type === "beverage" && !subForm.subType) return;
    setSavingSub(true);
    const newSub = { ...subForm };
    if (newSub.type !== "beverage") delete newSub.subType;
    const newList = [...subOutlets, newSub];
    await onSave({ subOutlets: newList });
    setSubOutlets(newList);
    setSubForm({ name: "", a3MappingCode: "", type: "food", subType: "Liquor" });
    setSavingSub(false);
  }

  async function handleDeleteSubOutlet(idx) {
    const newList = subOutlets.filter((_, i) => i !== idx);
    await onSave({ subOutlets: newList });
    setSubOutlets(newList);
  }

  async function handleAddCostCenter(event) {
    event?.preventDefault();
    const trimmed = newCostCenter.trim();
    if (!trimmed) return;
    const exists = costCenterIds.some(id => id.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setNewCostCenter("");
      return;
    }
    setSavingCostCenter(true);
    const newList = [...costCenterIds, trimmed];
    await onSave({ costCenterIds: newList });
    setCostCenterIds(newList);
    setNewCostCenter("");
    setSavingCostCenter(false);
  }

  async function handleDeleteCostCenter(idx) {
    const newList = costCenterIds.filter((_, i) => i !== idx);
    setSavingCostCenter(true);
    await onSave({ costCenterIds: newList });
    setCostCenterIds(newList);
    setSavingCostCenter(false);
  }

  function startEditCostCenter(idx) {
    setEditCostCenterIdx(idx);
    setEditCostCenterValue(costCenterIds[idx]);
  }

  async function handleSaveCostCenter(event) {
    event?.preventDefault();
    if (editCostCenterIdx === -1) return;
    const trimmed = editCostCenterValue.trim();
    if (!trimmed) return;
    const exists = costCenterIds.some(
      (id, idx) => idx !== editCostCenterIdx && id.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) return;
    setSavingCostCenter(true);
    const newList = costCenterIds.map((id, idx) => (idx === editCostCenterIdx ? trimmed : id));
    await onSave({ costCenterIds: newList });
    setCostCenterIds(newList);
    setEditCostCenterIdx(-1);
    setEditCostCenterValue("");
    setSavingCostCenter(false);
  }

  function cancelEditCostCenter() {
    setEditCostCenterIdx(-1);
    setEditCostCenterValue("");
  }

  async function handleAddCategory(event) {
    event?.preventDefault();
    if (!newCategory.trim()) return;
    setSavingCat(true);
    const newList = [...menuCategories, newCategory.trim()];
    await onSave({ menuCategories: newList });
    setMenuCategories(newList);
    setNewCategory("");
    setSavingCat(false);
  }

  async function handleDeleteCategory(idx) {
    const newList = menuCategories.filter((_, i) => i !== idx);
    await onSave({ menuCategories: newList });
    setMenuCategories(newList);
  }

  function startEditCategory(idx) {
    setEditIdx(idx);
    setEditValue(menuCategories[idx]);
  }

  async function handleSaveCategory(event) {
    event?.preventDefault();
    if (editIdx === -1 || !editValue.trim()) return;
    setSavingCat(true);
    const newList = menuCategories.map((c, i) => (i === editIdx ? editValue.trim() : c));
    await onSave({ menuCategories: newList });
    setMenuCategories(newList);
    setEditIdx(-1);
    setEditValue("");
    setSavingCat(false);
  }

  function cancelEditCategory() {
    setEditIdx(-1);
    setEditValue("");
  }

  const generalInfoSection = edit ? (
    <section className="rounded-2xl border border-gray-200 bg-white/90 p-6 shadow-md shadow-gray-200/40 backdrop-blur-sm">
      <form onSubmit={handleSaveGeneral} className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Algemene gegevens bewerken</h2>
          <p className="mt-1 text-sm text-gray-500">
            Pas de basisgegevens van dit outlet aan. Wijzigingen worden direct opgeslagen.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="outlet-name">
              Naam
            </label>
            <input
              id="outlet-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className={`${inputClassName} mt-1`}
              placeholder="Naam van het outlet"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700" htmlFor="outlet-department">
              Afdeling
            </label>
            <input
              id="outlet-department"
              type="text"
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className={`${inputClassName} mt-1`}
              placeholder="Bijbehorende afdeling"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700" htmlFor="outlet-id">
              Outlet ID
            </label>
            <input
              id="outlet-id"
              type="text"
              value={outletId}
              onChange={e => setOutletId(e.target.value)}
              className={`${inputClassName} mt-1 font-mono`}
              placeholder="Unieke outlet ID"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="outlet-description">
              Beschrijving
            </label>
            <textarea
              id="outlet-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className={`${inputClassName} mt-1 min-h-[96px] resize-none`}
              placeholder="Omschrijf dit outlet"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => {
              resetGeneralForm();
              setEdit(false);
            }}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-gray-400 hover:text-gray-900"
          >
            Annuleer
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-lg bg-marriott px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-marriott-dark disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Bezig met opslaan..." : "Opslaan"}
          </button>
        </div>
      </form>
    </section>
  ) : (
    <section className="rounded-2xl border border-gray-200 bg-white/90 p-6 shadow-md shadow-gray-200/40 backdrop-blur-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Algemene gegevens</h2>
          <p className="mt-1 text-sm text-gray-500">
            Overzicht van de basisinformatie van dit outlet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetGeneralForm();
            setEdit(true);
          }}
          className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-marriott shadow-sm ring-1 ring-inset ring-marriott/40 transition hover:bg-marriott hover:text-white"
        >
          Bewerk gegevens
        </button>
      </div>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Naam</dt>
          <dd className="mt-1 text-sm font-medium text-gray-900">{outlet.name}</dd>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Afdeling</dt>
          <dd className="mt-1 text-sm font-medium text-gray-900">
            {outlet.department || "–"}
          </dd>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm sm:col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Beschrijving</dt>
          <dd className="mt-1 text-sm text-gray-700">
            {outlet.description || "Geen beschrijving toegevoegd."}
          </dd>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Outlet ID</dt>
          <dd className="mt-1 font-mono text-sm text-gray-900">
            {outlet.outletId || "–"}
          </dd>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cost center IDs</dt>
          <dd className="mt-1 text-sm font-medium text-gray-900">{costCenterIds.length}</dd>
        </div>
      </dl>
    </section>
  );

  const subOutletSection = (
    <section className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-gray-900">Suboutlets</h3>
        <p className="text-sm text-gray-500">Beheer de suboutlets en mappings voor dit outlet.</p>
      </div>
      {subOutlets.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center text-sm text-gray-500">
          Geen suboutlets toegevoegd.
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {subOutlets.map((s, idx) => (
            <li
              key={`${s.name}-${idx}`}
              className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <span className={chipClassName}>A3-code: {s.a3MappingCode}</span>
                  <span className={chipClassName}>Type: {s.type}</span>
                  {s.type === "beverage" && s.subType && (
                    <span className={chipClassName}>Subtype: {s.subType}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDeleteSubOutlet(idx)}
                className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-100"
              >
                Verwijderen
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAddSubOutlet} className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <input
          type="text"
          placeholder="Naam"
          value={subForm.name}
          onChange={e => setSubForm(f => ({ ...f, name: e.target.value }))}
          className={inputClassName}
        />
        <input
          type="text"
          placeholder="A3-code"
          value={subForm.a3MappingCode}
          onChange={e => setSubForm(f => ({ ...f, a3MappingCode: e.target.value }))}
          className={inputClassName}
        />
        <select
          value={subForm.type}
          onChange={e => setSubForm(f => ({ ...f, type: e.target.value }))}
          className={inputClassName}
        >
          <option value="food">Food</option>
          <option value="beverage">Beverage</option>
        </select>
        {subForm.type === "beverage" ? (
          <select
            value={subForm.subType}
            onChange={e => setSubForm(f => ({ ...f, subType: e.target.value }))}
            className={inputClassName}
          >
            <option value="Liquor">Liquor</option>
            <option value="Wine">Wine</option>
            <option value="Beer/Soft/Coffee">Beer/Soft/Coffee</option>
          </select>
        ) : (
          <div className="hidden lg:block" />
        )}
        <div className="md:col-span-2 lg:col-span-4 flex justify-end">
          <button
            type="submit"
            disabled={savingSub}
            className="inline-flex items-center justify-center rounded-lg bg-marriott px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-marriott-dark disabled:cursor-not-allowed disabled:opacity-70"
          >
            {savingSub ? "Toevoegen..." : "Suboutlet toevoegen"}
          </button>
        </div>
      </form>
    </section>
  );

  const costCenterSection = (
    <section className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-gray-900">Cost center IDs</h3>
        <p className="text-sm text-gray-500">Gebruik cost center IDs om de boekhouding te koppelen.</p>
      </div>
      {costCenterIds.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center text-sm text-gray-500">
          Geen cost center IDs toegevoegd.
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {costCenterIds.map((id, idx) => (
            <li
              key={`${id}-${idx}`}
              className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              {editCostCenterIdx === idx ? (
                <form onSubmit={handleSaveCostCenter} className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={editCostCenterValue}
                    onChange={e => setEditCostCenterValue(e.target.value)}
                    className={`${inputClassName} font-mono`}
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={savingCostCenter}
                      className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      Bewaar
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditCostCenter}
                      className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:border-gray-400 hover:text-gray-900"
                    >
                      Annuleer
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="font-mono text-sm font-semibold text-gray-900">{id}</span>
                    <span className="text-xs uppercase tracking-wide text-gray-500">Cost center</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditCostCenter(idx)}
                      className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:border-gray-400 hover:text-gray-900"
                    >
                      Bewerk
                    </button>
                    <button
                      onClick={() => handleDeleteCostCenter(idx)}
                      className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-100"
                    >
                      Verwijder
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAddCostCenter} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={newCostCenter}
          onChange={e => setNewCostCenter(e.target.value)}
          className={`${inputClassName} font-mono`}
          placeholder="Nieuw cost center ID"
        />
        <button
          type="submit"
          disabled={savingCostCenter || !newCostCenter.trim()}
          className="inline-flex items-center justify-center rounded-lg bg-marriott px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-marriott-dark disabled:cursor-not-allowed disabled:opacity-70"
        >
          {savingCostCenter ? "Toevoegen..." : "Voeg toe"}
        </button>
      </form>
    </section>
  );

  const menuCategorySection = (
    <section className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-gray-900">Menu-categorieën</h3>
        <p className="text-sm text-gray-500">Organiseer producten via de categorieën van dit outlet.</p>
      </div>
      {menuCategories.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center text-sm text-gray-500">
          Geen menu-categorieën toegevoegd.
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {menuCategories.map((c, idx) => (
            <li
              key={`${c}-${idx}`}
              className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              {editIdx === idx ? (
                <form onSubmit={handleSaveCategory} className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className={inputClassName}
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={savingCat}
                      className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      Bewaar
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditCategory}
                      className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:border-gray-400 hover:text-gray-900"
                    >
                      Annuleer
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="text-sm font-semibold text-gray-900">{c}</span>
                    <span className="text-xs uppercase tracking-wide text-gray-500">Categorie</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditCategory(idx)}
                      className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:border-gray-400 hover:text-gray-900"
                    >
                      Bewerk
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(idx)}
                      className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-100"
                    >
                      Verwijder
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAddCategory} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="Nieuwe categorie"
          value={newCategory}
          onChange={e => setNewCategory(e.target.value)}
          className={inputClassName}
        />
        <button
          type="submit"
          disabled={savingCat}
          className="inline-flex items-center justify-center rounded-lg bg-marriott px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-marriott-dark disabled:cursor-not-allowed disabled:opacity-70"
        >
          {savingCat ? "Toevoegen..." : "Categorie toevoegen"}
        </button>
      </form>
    </section>
  );

  const dangerZoneSection = (
    <section className="rounded-2xl border border-red-200 bg-red-50/80 p-6 shadow-sm">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-red-700">Gevarenzone</h3>
        <p className="text-sm text-red-600">
          Het verwijderen van dit outlet kan niet ongedaan worden gemaakt en verwijdert ook de koppeling met producten.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-100"
          >
            Verwijder outlet
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-red-700">Weet je het zeker?</span>
            <button
              onClick={() => onDelete(outlet.id || outlet.name)}
              className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
            >
              Ja, verwijder
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-100"
            >
              Nee, annuleren
            </button>
          </div>
        )}
      </div>
    </section>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div className="space-y-6">
        {generalInfoSection}
        {subOutletSection}
      </div>
      <div className="space-y-6">
        {costCenterSection}
        {menuCategorySection}
        {dangerZoneSection}
      </div>
    </div>
  );
}

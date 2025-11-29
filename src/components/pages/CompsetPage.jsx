import React, { useEffect, useMemo, useState } from "react";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { auth, signOut } from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";
import { addCompsetHotel, subscribeCompset } from "../../services/compsetService";

export default function CompsetPage() {
  const { hotelUid } = useHotelContext();
  const [compsetHotels, setCompsetHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formState, setFormState] = useState({ name: "", rooms: "" });
  const [submitting, setSubmitting] = useState(false);

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    []
  );

  useEffect(() => {
    if (!hotelUid) return undefined;
    setLoading(true);
    const unsubscribe = subscribeCompset(hotelUid, (items) => {
      setCompsetHotels(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [hotelUid]);

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await addCompsetHotel(hotelUid, formState);
      setFormState({ name: "", rooms: "" });
      setShowForm(false);
    } catch (err) {
      setError("Het opslaan van het hotel is mislukt. Probeer opnieuw.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <HeaderBar today={todayLabel} onLogout={handleLogout} />

      <PageContainer className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500 uppercase tracking-wide">Settings</p>
            <h1 className="text-3xl font-semibold">Compset</h1>
            <p className="text-gray-600 mt-1">
              Beheer de lijst van hotels die tot de compset behoren.
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-md bg-[#b41f1f] text-white font-semibold hover:bg-[#9c1a1a]"
            aria-label="Add hotel to compset"
          >
            +
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Hotels</h2>
            <span className="text-sm text-gray-600">
              {compsetHotels.length} hotels
            </span>
          </div>
          {loading ? (
            <div className="p-4 text-sm text-gray-600">Gegevens laden...</div>
          ) : compsetHotels.length ? (
            <ul className="divide-y divide-gray-100">
              {compsetHotels.map((hotel) => (
                <li key={hotel.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-base font-semibold">{hotel.name}</p>
                      <p className="text-sm text-gray-600">{hotel.rooms} kamers</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-sm font-semibold">
                      {hotel.rooms || 0}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-sm text-gray-600">
              Er zijn nog geen hotels in de compset toegevoegd.
            </div>
          )}
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 px-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold">Nieuw hotel</h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-gray-500 hover:text-gray-700"
                  aria-label="Sluit"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700" htmlFor="hotel-name">
                    Naam
                  </label>
                  <input
                    id="hotel-name"
                    name="name"
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#b41f1f] focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700" htmlFor="hotel-rooms">
                    Aantal kamers
                  </label>
                  <input
                    id="hotel-rooms"
                    name="rooms"
                    type="number"
                    min="0"
                    required
                    value={formState.rooms}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, rooms: e.target.value }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#b41f1f] focus:outline-none"
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 rounded-md border border-gray-200 text-gray-700"
                  >
                    Annuleer
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-md bg-[#b41f1f] text-white font-semibold hover:bg-[#9c1a1a] disabled:opacity-70"
                  >
                    {submitting ? "Opslaan..." : "Opslaan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </PageContainer>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";
import { auth, signOut } from "../../firebaseConfig";
import { subscribeToChecklistItem } from "../../services/firebaseChecklist";
import { useHotelContext } from "../../contexts/HotelContext";

export default function ChecklistDetailPage() {
  const navigate = useNavigate();
  const { checklistId } = useParams();
  const { hotelUid } = useHotelContext();
  const [item, setItem] = useState(undefined);

  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, []);

  useEffect(() => {
    if (!hotelUid || !checklistId) {
      setItem(null);
      return undefined;
    }

    const unsubscribe = subscribeToChecklistItem(checklistId, setItem);
    return () => unsubscribe && unsubscribe();
  }, [hotelUid, checklistId]);

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <HeaderBar today={todayLabel} onLogout={handleLogout} />
      <PageContainer className="space-y-6">
        <button
          type="button"
          onClick={() => navigate("/checklist")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#b41f1f] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Terug naar checklist overzicht
        </button>

        {item === undefined && <p className="text-gray-600">Checklist item laden...</p>}

        {item === null && (
          <Card>
            <p className="text-gray-600">Checklist item niet gevonden.</p>
          </Card>
        )}

        {item && (
          <Card>
            <div className="space-y-4">
              <div>
                <p className="text-sm uppercase tracking-wide text-[#b41f1f] font-semibold">Checklist detail</p>
                <h1 className="text-2xl font-bold mt-1">{item.name}</h1>
                <p className="text-sm text-gray-600 mt-2">{item.description || "Geen beschrijving"}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-[#b41f1f]/10 text-[#b41f1f] px-3 py-1 text-xs font-semibold">
                  Frequentie: {item.frequency}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                    item.isCompleted ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  Status: {item.isCompleted ? "Afgevinkt" : "Open"}
                </span>
              </div>

              <div>
                <h2 className="text-lg font-semibold mb-3">Stappenplan</h2>
                {!item.steps?.length ? (
                  <p className="text-gray-600">Geen stappen beschikbaar.</p>
                ) : (
                  <div className="space-y-4">
                    {item.steps.map((step, stepIndex) => (
                      <div key={`${item.id}-detail-step-${stepIndex}`} className="rounded border border-gray-200 p-4">
                        <p className="text-sm font-semibold">Stap {stepIndex + 1}: {step.title}</p>
                        {!!step.photoUrls?.length && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                            {step.photoUrls.map((photoUrl, photoIndex) => (
                              <a
                                key={`${item.id}-detail-step-${stepIndex}-photo-${photoIndex}`}
                                href={photoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block"
                              >
                                <img
                                  src={photoUrl}
                                  alt={`Stap ${stepIndex + 1} foto ${photoIndex + 1}`}
                                  className="h-40 w-full object-cover rounded border"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}
      </PageContainer>
    </div>
  );
}

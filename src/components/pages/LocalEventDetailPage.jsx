import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";
import { auth, signOut } from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";
import { deleteLocalEvent, getLocalEvent, updateLocalEvent } from "../../services/firebaseLocalEvents";

export default function LocalEventDetailPage() {
  const { t } = useTranslation("calendar");
  const { hotelUid } = useHotelContext();
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    location: "",
    estimatedVisitors: "",
    startDate: "",
    endDate: "",
  });
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [originalData, setOriginalData] = useState(null);

  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = "/login";
  };

  useEffect(() => {
    if (!hotelUid || !eventId) return;

    const loadEvent = async () => {
      setLoading(true);
      const event = await getLocalEvent(eventId);
      if (!event) {
        setStatusMessage(t("detail.notFound"));
        setLoading(false);
        return;
      }

      setFormData({
        title: event.title || "",
        description: event.description || "",
        location: event.location || "",
        estimatedVisitors: event.estimatedVisitors ? String(event.estimatedVisitors) : "",
        startDate: event.startDate || "",
        endDate: event.endDate || "",
      });
      setOriginalData({
        title: event.title || "",
        description: event.description || "",
        location: event.location || "",
        estimatedVisitors: event.estimatedVisitors ? String(event.estimatedVisitors) : "",
        startDate: event.startDate || "",
        endDate: event.endDate || "",
      });
      setLoading(false);
    };

    loadEvent();
  }, [eventId, hotelUid, t]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.title || !formData.startDate) {
      toast.error(t("form.validation"));
      return;
    }

    if (formData.endDate && formData.endDate < formData.startDate) {
      toast.error(t("form.invalidRange"));
      return;
    }

    const estimatedVisitors = formData.estimatedVisitors
      ? Number(formData.estimatedVisitors)
      : null;

    try {
      await updateLocalEvent(eventId, { ...formData, estimatedVisitors });
      toast.success(t("toast.updated"));
      setOriginalData({ ...formData, estimatedVisitors: formData.estimatedVisitors });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update event", error);
      toast.error(t("toast.error"));
    }
  };

  const handleCancelEdit = () => {
    if (originalData) {
      setFormData(originalData);
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!window.confirm(t("detail.deleteConfirm"))) return;

    try {
      await deleteLocalEvent(eventId);
      toast.success(t("toast.deleted"));
      navigate("/calendar/local", { replace: true });
    } catch (error) {
      console.error("Failed to delete event", error);
      toast.error(t("toast.error"));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <HeaderBar today={todayLabel} onLogout={handleLogout} />

      <PageContainer className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-[#b41f1f] font-semibold">{t("title")}</p>
            <h1 className="text-3xl font-bold">{formData.title || t("detail.title")}</h1>
            <p className="text-gray-600 max-w-2xl">{t("detail.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="rounded border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-gray-300"
            >
              {t("detail.back")}
            </button>
            {!loading && !statusMessage && (
              <button
                onClick={() => setIsEditing(true)}
                className="rounded border border-[#b41f1f] bg-white px-4 py-2 text-sm font-semibold text-[#b41f1f] hover:border-[#9c1c1c]"
                disabled={isEditing}
              >
                {t("detail.edit")}
              </button>
            )}
            <button
              onClick={handleDelete}
              className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:border-red-300"
            >
              {t("detail.delete")}
            </button>
          </div>
        </div>

        <Card className="p-6 border border-gray-100 shadow-sm">
          {loading ? (
            <p className="text-gray-600">{t("detail.loading")}</p>
          ) : statusMessage ? (
            <p className="text-red-600 font-semibold">{statusMessage}</p>
          ) : isEditing ? (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700" htmlFor="title">
                  {t("form.title")}
                </label>
                <input
                  id="title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#b41f1f] focus:outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700" htmlFor="description">
                  {t("form.description")}
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#b41f1f] focus:outline-none"
                  rows={3}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700" htmlFor="location">
                  {t("form.location")}
                </label>
                <input
                  id="location"
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#b41f1f] focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700" htmlFor="estimatedVisitors">
                  {t("form.estimatedVisitors")}
                </label>
                <input
                  id="estimatedVisitors"
                  type="number"
                  min="0"
                  value={formData.estimatedVisitors}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, estimatedVisitors: e.target.value.replace(/[^0-9]/g, "") }))
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#b41f1f] focus:outline-none"
                  placeholder="0"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700" htmlFor="startDate">
                    {t("form.startDate")}
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#b41f1f] focus:outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700" htmlFor="endDate">
                    {t("form.endDate")}
                  </label>
                  <input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    min={formData.startDate || undefined}
                    onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#b41f1f] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="rounded border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-gray-300"
                >
                  {t("form.cancel")}
                </button>
                <button
                  type="submit"
                  className="rounded bg-[#b41f1f] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#9c1c1c]"
                >
                  {t("detail.save")}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-700">{t("form.title")}</p>
                <p className="text-lg font-bold text-gray-900">{formData.title || "-"}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-gray-700">{t("form.startDate")}</p>
                  <p className="text-gray-900">{formData.startDate || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">{t("form.endDate")}</p>
                  <p className="text-gray-900">{formData.endDate || t("detail.noEndDate")}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">{t("form.location")}</p>
                  <p className="text-gray-900">{formData.location || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">{t("form.estimatedVisitors")}</p>
                  <p className="text-gray-900">{formData.estimatedVisitors || "-"}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700">{t("form.description")}</p>
                <p className="text-gray-900 whitespace-pre-line">{formData.description || "-"}</p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="rounded bg-[#b41f1f] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#9c1c1c]"
                >
                  {t("detail.edit")}
                </button>
              </div>
            </div>
          )}
        </Card>
      </PageContainer>
    </div>
  );
}

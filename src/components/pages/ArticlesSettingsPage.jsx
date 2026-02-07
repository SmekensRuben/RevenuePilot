import React, { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import HeaderBar from "../layout/HeaderBar";
import PageContainer from "../layout/PageContainer";
import { Card } from "../layout/Card";
import { auth, signOut } from "../../firebaseConfig";
import { useHotelContext } from "../../contexts/HotelContext";
import { getArticles } from "../../services/firebaseArticles";

const columns = [
  { key: "articleNumber", label: "Artikelnummer" },
  { key: "name", label: "Naam" },
  { key: "category", label: "Categorie" },
  { key: "inventory", label: "Inventory" },
];

export default function ArticlesSettingsPage() {
  const { hotelUid } = useHotelContext();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");

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

  useEffect(() => {
    let isMounted = true;
    const loadArticles = async () => {
      if (!hotelUid) {
        if (isMounted) {
          setArticles([]);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      const data = await getArticles(hotelUid);
      if (isMounted) {
        setArticles(data);
        setLoading(false);
      }
    };
    loadArticles();
    return () => {
      isMounted = false;
    };
  }, [hotelUid]);

  const filteredArticles = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    if (!query) return articles;
    return articles.filter((article) => {
      const name = String(article.name || "").toLowerCase();
      const category = String(article.category || "").toLowerCase();
      return name.includes(query) || category.includes(query);
    });
  }, [articles, filterQuery]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <HeaderBar today={todayLabel} onLogout={handleLogout} />
      <PageContainer className="space-y-6">
        <div>
          <p className="text-sm text-gray-500 uppercase tracking-wide">Settings</p>
          <h1 className="text-3xl font-semibold">Artikels</h1>
          <p className="text-gray-600 mt-1">Beheer en doorzoek alle artikels.</p>
        </div>

        <Card>
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">Artikeloverzicht</h2>
              <p className="text-sm text-gray-600">
                {filteredArticles.length} artikel
                {filteredArticles.length === 1 ? "" : "en"} gevonden
              </p>
            </div>
            <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
              Filter op naam of categorie
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(event) => setFilterQuery(event.target.value)}
                  placeholder="Zoek op naam of category..."
                  className="w-full rounded border border-gray-300 pl-9 pr-3 py-2 text-sm"
                />
              </div>
            </label>
          </div>

          {loading ? (
            <p className="text-gray-600">Artikels laden...</p>
          ) : filteredArticles.length === 0 ? (
            <p className="text-gray-600">Geen artikels gevonden.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredArticles.map((article) => {
                    const inventoryEnabled = Boolean(article.inventory);
                    const inventoryLabel = inventoryEnabled ? "Ja" : "";
                    return (
                      <tr key={article.id}>
                        <td className="px-4 py-3 text-sm text-gray-800">
                          {article.articleNumber || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800">
                          {article.name || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800">
                          {article.category || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800">
                          {inventoryLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </PageContainer>
    </div>
  );
}

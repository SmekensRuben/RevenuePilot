import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import HeaderBar from "components/layout/HeaderBar";
import PageContainer from "components/layout/PageContainer";
import { useHotelContext } from "contexts/HotelContext";
import { getShoppingLists, addShoppingList } from "./shoppingListService";
import { useTranslation } from "react-i18next";

export default function ShoppingListsPage() {
  const { hotelUid, hotelName } = useHotelContext();
  const navigate = useNavigate();
  const [lists, setLists] = useState([]);
  const [newListName, setNewListName] = useState("");
  const { t } = useTranslation("shoppinglists");

  async function fetchData() {
    const data = await getShoppingLists(hotelUid);
    setLists(data);
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelUid]);

  async function handleAddList() {
    if (!newListName) return;
    await addShoppingList(hotelUid, newListName);
    setNewListName("");
    fetchData();
  }

  return (
    <>
      <HeaderBar hotelName={hotelName} today="" />
      <PageContainer className="max-w-4xl">
        <h1 className="text-2xl font-bold mb-4">{t("page.title")}</h1>
        <div className="flex gap-2 mb-6">
          <input
            className="border p-2 flex-grow rounded"
            placeholder={t("page.newListPlaceholder")}
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
          />
          <button
            className="bg-marriott text-white px-4 py-2 rounded"
            onClick={handleAddList}
          >
            {t("page.addList")}
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {lists.map((list) => (
            <div
              key={list.id}
              className="bg-white rounded-2xl shadow p-4 flex items-center justify-between cursor-pointer hover:shadow-md transition"
              onClick={() => navigate(`/shoppinglists/${list.id}`)}
            >
              <h2 className="text-lg font-semibold">{list.name}</h2>
              <span className="text-marriott font-semibold">&gt;</span>
            </div>
          ))}
        </div>
      </PageContainer>
    </>
  );
}

import React, { useState } from "react";
import CategorySettings from "./CategorySettings";
import ProductCategorySettings from "./ProductCategorySettings";
import UnitSettings from "./UnitSettings";
import LocationSettings from "./LocationSettings";
import SalesPromoTypesSettings from "./SalesPromoTypesSettings";

const STAMGEGEVENS_TABS = [
  { key: "categories", label: "Categorieën" },
  { key: "productCategories", label: "Product-categorieën" },
  { key: "units", label: "Eenheden" },
  { key: "locations", label: "Locaties" },
  { key: "salesPromoTypes", label: "Sales & Promo" },
];

export default function StamgegevensSettings(props) {
  const [activeTab, setActiveTab] = useState(STAMGEGEVENS_TABS[0].key);

  return (
    <div>
      {/* Tabs bovenaan */}
      <div className="flex mb-4 border-b">
        {STAMGEGEVENS_TABS.map(tab => (
          <button
            key={tab.key}
            className={
              "px-4 py-2 mr-2 border-b-2 " +
              (activeTab === tab.key
                ? "border-primary font-bold text-primary"
                : "border-transparent text-gray-600")
            }
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "categories" && <CategorySettings {...props} />}
      {activeTab === "productCategories" && (
        <ProductCategorySettings
          categoryList={props.productCategoryList}
          addProductCategory={props.addProductCategory}
          deleteProductCategory={props.deleteProductCategory}
          setProductCategories={props.setProductCategories}
        />
      )}
      {activeTab === "units" && <UnitSettings {...props} />}
      {activeTab === "locations" && (
        <LocationSettings
          locations={props.locations}
          handleAddLocation={props.handleAddLocation}
          handleDeleteLocation={props.handleDeleteLocation}
        />
      )}
      {activeTab === "salesPromoTypes" && (
        <SalesPromoTypesSettings
          types={props.salesPromoTypes}
          handleAddType={props.handleAddSalesPromoType}
          handleDeleteType={props.handleDeleteSalesPromoType}
          handleUpdateType={props.handleUpdateSalesPromoType}
        />
      )}
    </div>
  );
}

import React, { useState } from "react";
import CategoryMappingSettings from "./CategoryMappingSettings";
import BulkEditMappings from "./BulkEditMappings";

const MAPPINGS_TABS = [
  { key: "categoryMapping", label: "Categorie-mapping" },
  { key: "bulkEdit", label: "Bulk-Edit" }
];

export default function MappingsSettings(props) {
  const [activeTab, setActiveTab] = useState("categoryMapping");

  return (
    <div>
      <div className="flex mb-4 border-b">
        {MAPPINGS_TABS.map(tab => (
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

      {activeTab === "categoryMapping" && (
        <CategoryMappingSettings
          categories={props.categoryList}
          productCategoryList={props.productCategoryList}
          mappings={props.categoryMappings}
          addMapping={props.handleAddCategoryMapping}
          updateMapping={props.handleUpdateCategoryMapping}
          deleteMapping={props.handleDeleteCategoryMapping}
        />
      )}
      {activeTab === "bulkEdit" && <BulkEditMappings />}
    </div>
  );
}

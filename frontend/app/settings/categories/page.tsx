"use client";

import { api } from "@/lib/api";
import CatalogSettings from "@/components/CatalogSettings";

export default function CategoriesPage() {
  return (
    <CatalogSettings
      title="Categories"
      icon="🏷️"
      list={api.listCategories}
      create={api.createCategory}
      remove={api.deleteCategory}
    />
  );
}

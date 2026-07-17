"use client";

import { api } from "@/lib/api";
import CatalogSettings from "@/components/CatalogSettings";

export default function RoomsPage() {
  return (
    <CatalogSettings
      title="Rooms"
      icon="🚪"
      list={api.listRooms}
      create={api.createRoom}
      remove={api.deleteRoom}
    />
  );
}

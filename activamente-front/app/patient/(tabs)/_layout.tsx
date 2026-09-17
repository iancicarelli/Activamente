import React from "react";
import { RoleTabs } from "../../../components/RoleTabs";

export default function PatientTabs() {
  return (
    <RoleTabs
      big
      tabs={[
        { name: "home", title: "Inicio", icon: "home-outline", iconActive: "home" },
        { name: "history", title: "Historial", icon: "chart-timeline-variant", iconActive: "chart-timeline-variant-shimmer" },
        { name: "profile", title: "Perfil", icon: "account-outline", iconActive: "account" },
      ]}
    />
  );
}

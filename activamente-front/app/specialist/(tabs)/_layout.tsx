import React from "react";
import { RoleTabs } from "../../../components/RoleTabs";

export default function SpecialistTabs() {
  return (
    <RoleTabs
      tabs={[
        { name: "home", title: "Inicio", icon: "home-outline", iconActive: "home" },
        { name: "calendar", title: "Calendario", icon: "calendar-month-outline", iconActive: "calendar-month" },
        { name: "patients", title: "Pacientes", icon: "account-group-outline", iconActive: "account-group" },
        { name: "profile", title: "Perfil", icon: "account-outline", iconActive: "account" },
      ]}
    />
  );
}

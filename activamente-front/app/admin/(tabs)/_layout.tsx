import React from "react";
import { RoleTabs } from "../../../components/RoleTabs";

export default function AdminTabs() {
  return (
    <RoleTabs
      tabs={[
        { name: "home", title: "Inicio", icon: "home-outline", iconActive: "home" },
        { name: "users", title: "Usuarios", icon: "account-group-outline", iconActive: "account-group" },
        { name: "profile", title: "Perfil", icon: "account-outline", iconActive: "account" },
      ]}
    />
  );
}

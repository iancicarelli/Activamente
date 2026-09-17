import React from "react";
import { render } from "@testing-library/react-native";
import { ToastProvider } from "../../components/ui/Toast";
import { mockRouter } from "../../jest.setup";

export const renderScreen = (ui: React.ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);

export const setParams = (params: Record<string, string>) => {
  (global as any).__routeParams = params;
};

export { mockRouter };

export const flush = () => new Promise((r) => setTimeout(r, 0));

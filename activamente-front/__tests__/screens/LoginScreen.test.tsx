import React from "react";
import { fireEvent, waitFor } from "@testing-library/react-native";
import LoginScreen from "../../screens/LoginScreen";
import { renderScreen, mockRouter, setParams } from "./helpers";
import { ApiError } from "../../services/apiClient";

jest.mock("../../services/authService", () => ({ loginApi: jest.fn() }));
const { loginApi } = jest.requireMock("../../services/authService");

describe("LoginScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setParams({});
  });

  test("rol PATIENT → home del paciente (replace)", async () => {
    loginApi.mockResolvedValue({ role: "PATIENT" });
    const { getByTestId } = renderScreen(<LoginScreen />);
    fireEvent.changeText(getByTestId("login-identifier"), "pedro@test.com");
    fireEvent.changeText(getByTestId("login-password"), "x");
    fireEvent.press(getByTestId("login-submit"));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/patient/(tabs)/home"));
  });

  test("rol SPECIALIST → home del especialista", async () => {
    loginApi.mockResolvedValue({ role: "SPECIALIST" });
    const { getByTestId } = renderScreen(<LoginScreen />);
    fireEvent.changeText(getByTestId("login-identifier"), "12.345.678-5");
    fireEvent.changeText(getByTestId("login-password"), "x");
    fireEvent.press(getByTestId("login-submit"));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/specialist/(tabs)/home"));
  });

  test("401 muestra mensaje humano", async () => {
    loginApi.mockRejectedValue(new ApiError("Invalid", 401));
    const { getByTestId, findByText } = renderScreen(<LoginScreen />);
    fireEvent.changeText(getByTestId("login-identifier"), "a@b.cl");
    fireEvent.changeText(getByTestId("login-password"), "x");
    fireEvent.press(getByTestId("login-submit"));
    expect(await findByText(/no son correctos/)).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  test("campos vacíos no llaman al backend", () => {
    const { getByTestId, getByText } = renderScreen(<LoginScreen />);
    fireEvent.press(getByTestId("login-submit"));
    expect(loginApi).not.toHaveBeenCalled();
    expect(getByText(/Escribe tu correo o RUT/)).toBeTruthy();
  });

  test("motivo 'expired' en params muestra el aviso", () => {
    setParams({ reason: "expired" });
    const { getByText } = renderScreen(<LoginScreen />);
    expect(getByText(/Tu sesión expiró/)).toBeTruthy();
  });
});

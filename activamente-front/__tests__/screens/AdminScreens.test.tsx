import React from "react";
import { Alert } from "react-native";
import { fireEvent, waitFor } from "@testing-library/react-native";
import AdminUsersScreen from "../../screens/admin/AdminUsersScreen";
import CreateUserScreen from "../../screens/admin/CreateUserScreen";
import { renderScreen, setParams } from "./helpers";

jest.mock("../../services/userService", () => ({
  listUsers: jest.fn(),
  setUserStatus: jest.fn(),
  updateUser: jest.fn(),
  setUserPassword: jest.fn(),
  createUserApi: jest.fn(),
  ROLE_LABEL: { admin: "Administrador", especialista: "Especialista", paciente: "Paciente" },
}));
const users = jest.requireMock("../../services/userService");

beforeEach(() => {
  jest.clearAllMocks();
  setParams({});
  jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
    const confirmBtn = buttons?.find((b) => b.text === "Confirmar" || b.text === "Entendido");
    confirmBtn?.onPress?.();
  });
});

describe("AdminUsersScreen", () => {
  test("toggle llama a setUserStatus y actualiza la fila", async () => {
    users.listUsers.mockResolvedValue({ items: [{ id: "u1", fullName: "Ana Pérez", email: "a@t.com", role: "paciente", isActive: true, createdAt: null, rut: null, phone: null }], total: 1, hasMore: false });
    users.setUserStatus.mockResolvedValue({ id: "u1", fullName: "Ana Pérez", email: "a@t.com", role: "paciente", isActive: false, createdAt: null, rut: null, phone: null });
    const { findByText } = renderScreen(<AdminUsersScreen />);
    fireEvent.press(await findByText("Desactivar"));
    await waitFor(() => expect(users.setUserStatus).toHaveBeenCalledWith("u1", false));
    expect(await findByText("Inactivo")).toBeTruthy();
  });

  test("el admin cambia la contraseña de un usuario", async () => {
    users.listUsers.mockResolvedValue({ items: [{ id: "u1", fullName: "Ana Pérez", email: "a@t.com", role: "paciente", isActive: true, createdAt: null, rut: null, phone: null }], total: 1, hasMore: false });
    users.setUserPassword.mockResolvedValue(undefined);
    const { findByText, getByTestId, getByText } = renderScreen(<AdminUsersScreen />);
    fireEvent.press(await findByText("Clave"));
    fireEvent.changeText(getByTestId("new-password"), "Nueva1234");
    fireEvent.changeText(getByTestId("confirm-password"), "Otra");
    expect(await findByText("Las contraseñas no coinciden.")).toBeTruthy();
    fireEvent.changeText(getByTestId("confirm-password"), "Nueva1234");
    fireEvent.press(getByText("Guardar"));
    await waitFor(() => expect(users.setUserPassword).toHaveBeenCalledWith("u1", "Nueva1234"));
  });

  test("muestra 'Cargar más' cuando hay más páginas", async () => {
    users.listUsers.mockResolvedValue({ items: [{ id: "u1", fullName: "A B", email: "a", role: "admin", isActive: true, createdAt: null, rut: null, phone: null }], total: 40, hasMore: true });
    const { findByText } = renderScreen(<AdminUsersScreen />);
    expect(await findByText(/Cargar más/)).toBeTruthy();
  });
});

describe("CreateUserScreen", () => {
  test("valida RUT y crea con contraseña temporal", async () => {
    users.createUserApi.mockResolvedValue({ id: "n", email: "luis@t.com", temp_password: "Luis123!" });
    const { getByPlaceholderText, getByTestId, findByText } = renderScreen(<CreateUserScreen />);
    fireEvent.changeText(getByPlaceholderText("Ej: Ana María Silva"), "Luis Rojas");
    fireEvent.changeText(getByPlaceholderText("ana.silva@ejemplo.cl"), "luis@t.com");
    fireEvent.changeText(getByPlaceholderText("12.345.678-9"), "123456789");
    expect(await findByText("El RUT no es válido.")).toBeTruthy();
    fireEvent.changeText(getByPlaceholderText("12.345.678-9"), "123456785");
    fireEvent.press(getByTestId("create-user-submit"));
    await waitFor(() => expect(users.createUserApi).toHaveBeenCalledWith(expect.objectContaining({ fullName: "Luis Rojas", email: "luis@t.com", role: "paciente", rut: "12.345.678-5" })));
    expect(Alert.alert).toHaveBeenCalledWith("Usuario creado", expect.stringContaining("Luis123!"), expect.anything());
  });
});

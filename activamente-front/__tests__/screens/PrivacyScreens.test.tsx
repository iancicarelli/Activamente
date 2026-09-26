// Ley 21.719: pantalla de términos, solicitud de eliminación del paciente y aprobación del admin.
import React from "react";
import { Alert } from "react-native";
import { fireEvent, waitFor } from "@testing-library/react-native";
import TermsScreen from "../../screens/TermsScreen";
import PatientProfileScreen from "../../screens/patient/PatientProfileScreen";
import { DeletionRequestsCard } from "../../components/DeletionRequestsCard";
import { renderScreen, mockRouter } from "./helpers";
import { __resetAuthForTests, setAuth } from "../../services/authStore";

jest.mock("../../services/privacyService", () => ({
  getMyTerms: jest.fn(),
  acceptTerms: jest.fn(),
  getMyDeletionRequest: jest.fn(),
  requestAccountDeletion: jest.fn(),
  listDeletionRequests: jest.fn(),
  approveDeletionRequest: jest.fn(),
  rejectDeletionRequest: jest.fn(),
}));
jest.mock("../../services/authService", () => ({ logout: jest.fn() }));
jest.mock("../../services/meService", () => ({ getMe: jest.fn() }));
jest.mock("../../services/appointmentService", () => ({ getNextAppointment: jest.fn() }));

const privacy = jest.requireMock("../../services/privacyService");
const auth = jest.requireMock("../../services/authService");
const me = jest.requireMock("../../services/meService");
const appts = jest.requireMock("../../services/appointmentService");

const terms = (accepted: boolean) => ({
  version: "2026-09-25",
  accepted,
  accepted_at: accepted ? "2026-09-25T12:00:00Z" : null,
  sections: [
    { title: "Uso de la cámara", body: "La imagen se analiza dentro de tu teléfono." },
    { title: "Tus derechos", body: "Puedes pedir eliminar tus datos." },
  ],
});

// Confirma el diálogo pulsando el botón de acción (el último).
const confirmAlerts = () =>
  jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
    buttons?.[buttons.length - 1]?.onPress?.();
  });

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  __resetAuthForTests();
  setAuth({ token: "t", role: "PATIENT", userId: "u1", expiresAt: Date.now() + 100000 });
});

describe("TermsScreen", () => {
  test("pendiente: no deja aceptar sin marcar la casilla; al aceptar registra la versión y va al inicio", async () => {
    privacy.getMyTerms.mockResolvedValue(terms(false));
    privacy.acceptTerms.mockResolvedValue(undefined);
    const { findByText, getByTestId } = renderScreen(<TermsScreen />);
    expect(await findByText("Uso de la cámara")).toBeTruthy();

    fireEvent.press(getByTestId("terms-accept"));
    expect(privacy.acceptTerms).not.toHaveBeenCalled();

    fireEvent.press(getByTestId("terms-check"));
    fireEvent.press(getByTestId("terms-accept"));
    await waitFor(() => expect(privacy.acceptTerms).toHaveBeenCalledWith("2026-09-25"));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/patient/(tabs)/home"));
  });

  test("'No acepto' cierra la sesión tras confirmar", async () => {
    privacy.getMyTerms.mockResolvedValue(terms(false));
    confirmAlerts();
    const { findByTestId } = renderScreen(<TermsScreen />);
    fireEvent.press(await findByTestId("terms-decline"));
    await waitFor(() => expect(auth.logout).toHaveBeenCalled());
  });

  test("ya aceptados: solo se leen, sin botones de aceptar", async () => {
    privacy.getMyTerms.mockResolvedValue(terms(true));
    const { findByText, queryByTestId } = renderScreen(<TermsScreen />);
    expect(await findByText("Tus derechos")).toBeTruthy();
    expect(queryByTestId("terms-accept")).toBeNull();
    expect(queryByTestId("terms-decline")).toBeNull();
  });
});

describe("PatientProfileScreen · privacidad", () => {
  beforeEach(() => {
    me.getMe.mockResolvedValue({ full_name: "Pedro Soto", email: "p@t.com", role: "PATIENT", patient: { rut: "98765432-5", age: 70, phone: null, address: null, specialists: [] } });
    appts.getNextAppointment.mockResolvedValue(null);
  });

  test("pedir la eliminación envía la solicitud y muestra que está en revisión", async () => {
    privacy.getMyDeletionRequest.mockResolvedValue(null);
    privacy.requestAccountDeletion.mockResolvedValue({ id: "d1", status: "PENDING", requested_at: "2026-09-25T12:00:00Z", resolved_at: null });
    confirmAlerts();
    const { findByTestId } = renderScreen(<PatientProfileScreen />);
    fireEvent.press(await findByTestId("request-deletion"));
    await waitFor(() => expect(privacy.requestAccountDeletion).toHaveBeenCalled());
    expect(await findByTestId("deletion-pending")).toBeTruthy();
  });

  test("con una solicitud pendiente no ofrece pedir otra", async () => {
    privacy.getMyDeletionRequest.mockResolvedValue({ id: "d1", status: "PENDING", requested_at: "2026-09-25T12:00:00Z", resolved_at: null });
    const { findByTestId, queryByTestId } = renderScreen(<PatientProfileScreen />);
    expect(await findByTestId("deletion-pending")).toBeTruthy();
    expect(queryByTestId("request-deletion")).toBeNull();
  });

  test("'Ver términos y privacidad' abre la pantalla de términos", async () => {
    privacy.getMyDeletionRequest.mockResolvedValue(null);
    const { findByText } = renderScreen(<PatientProfileScreen />);
    fireEvent.press(await findByText("Ver términos y privacidad"));
    expect(mockRouter.push).toHaveBeenCalledWith("/terms");
  });
});

describe("DeletionRequestsCard (admin)", () => {
  const item = { id: "d1", status: "PENDING", requested_at: "2026-09-25T12:00:00Z", resolved_at: null, user_id: "u1", reason: null, full_name: "Pedro Soto", email: "p@t.com", rut: "98765432-5" };

  test("sin pendientes no muestra nada", async () => {
    privacy.listDeletionRequests.mockResolvedValue([]);
    const { queryByText } = renderScreen(<DeletionRequestsCard />);
    await waitFor(() => expect(privacy.listDeletionRequests).toHaveBeenCalledWith("PENDING"));
    expect(queryByText(/Solicitudes de eliminación/)).toBeNull();
  });

  test("aprobar pide confirmación, borra y saca la solicitud de la lista", async () => {
    privacy.listDeletionRequests.mockResolvedValue([item]);
    privacy.approveDeletionRequest.mockResolvedValue({ ...item, status: "APPROVED" });
    const onResolved = jest.fn();
    confirmAlerts();
    const { findByText, queryByText } = renderScreen(<DeletionRequestsCard onResolved={onResolved} />);
    expect(await findByText("Pedro Soto")).toBeTruthy();
    fireEvent.press(await findByText("Eliminar"));
    await waitFor(() => expect(privacy.approveDeletionRequest).toHaveBeenCalledWith("d1"));
    await waitFor(() => expect(queryByText("Pedro Soto")).toBeNull());
    expect(onResolved).toHaveBeenCalled();
    expect(privacy.rejectDeletionRequest).not.toHaveBeenCalled();
  });
});

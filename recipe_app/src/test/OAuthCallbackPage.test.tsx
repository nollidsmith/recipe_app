import { MemoryRouter } from "react-router-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockNavigate, mockUseAuth } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock("../app/AuthProvider", () => ({ useAuth: mockUseAuth }));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

import OAuthCallbackPage from "../app/OAuthCallbackPage";

describe("OAuthCallbackPage", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/?error=access_denied&error_description=User%20cancelled&error_code=provider_error");
    mockUseAuth.mockReturnValue({ loading: false, session: null });
  });

  it("surfaces provider error, description, and code and clears the URL", async () => {
    render(<MemoryRouter><OAuthCallbackPage /></MemoryRouter>);

    expect(await screen.findByRole("alert")).toHaveTextContent("access_denied User cancelled Code: provider_error");
    expect(window.location.search).toBe("");
  });

  it("returns an authenticated user to the remembered internal route", async () => {
    window.sessionStorage.setItem("pantrypilot.oauth.returnTo", "/pantry?low=true");
    window.history.replaceState({}, "", "/?code=oauth-code");
    mockUseAuth.mockReturnValue({ loading: false, session: { user: { id: "user-1" } } });

    render(<MemoryRouter><OAuthCallbackPage /></MemoryRouter>);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/pantry?low=true", { replace: true }));
    expect(window.location.search).toBe("");
    expect(window.sessionStorage.getItem("pantrypilot.oauth.returnTo")).toBeNull();
  });

  it("fails safely when the callback code produces no session", async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/?code=oauth-code");
    render(<MemoryRouter><OAuthCallbackPage /></MemoryRouter>);

    expect(screen.getByRole("status")).toHaveTextContent("Completing sign-in");
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(screen.getByRole("alert")).toHaveTextContent("no session was created");
    expect(screen.getByRole("button", { name: "Try sign-in again" })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("preserves the intended route when retrying OAuth", async () => {
    window.sessionStorage.setItem("pantrypilot.oauth.returnTo", "/recipes/new");
    window.history.replaceState({}, "", "/?code=oauth-code");
    vi.useFakeTimers();
    render(<MemoryRouter><OAuthCallbackPage /></MemoryRouter>);
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(screen.getByRole("button", { name: "Try sign-in again" })).toBeInTheDocument();
    await act(async () => { screen.getByRole("button", { name: "Try sign-in again" }).click(); });

    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
    expect(window.sessionStorage.getItem("pantrypilot.oauth.returnTo")).toBe("/recipes/new");
    vi.useRealTimers();
  });
});

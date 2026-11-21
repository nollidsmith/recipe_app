import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuth, mockUseAuth } = vi.hoisted(() => ({
  mockAuth: {
    resetPasswordForEmail: vi.fn(),
    signInWithPassword: vi.fn(),
    signInWithOAuth: vi.fn(),
    signUp: vi.fn(),
  },
  mockUseAuth: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({ supabase: { auth: mockAuth } }));
vi.mock("../app/AuthProvider", () => ({ useAuth: mockUseAuth }));

import LoginPage from "../app/LoginPage";

function renderLogin() {
  return render(<MemoryRouter><LoginPage /></MemoryRouter>);
}

describe("LoginPage", () => {
  beforeEach(() => {
    mockAuth.resetPasswordForEmail.mockReset();
    mockAuth.signInWithPassword.mockReset();
    mockAuth.signInWithOAuth.mockReset();
    mockAuth.signUp.mockReset();
    mockUseAuth.mockReturnValue({ session: null });
  });

  it("submits email sign-in", async () => {
    const user = userEvent.setup();
    mockAuth.signInWithPassword.mockResolvedValue({ error: null });
    renderLogin();

    await user.type(screen.getByLabelText("Email address"), "cook@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    fireEvent.submit(screen.getByLabelText("Password").closest("form")!);

    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
      email: "cook@example.com",
      password: "password123",
    });
  });

  it("shows the confirmation message after sign-up", async () => {
    const user = userEvent.setup();
    mockAuth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    renderLogin();

    await user.click(screen.getByRole("button", { name: "Need an account? Sign up" }));
    await user.type(screen.getByLabelText("First name"), "Dillon");
    await user.type(screen.getByLabelText("Email address"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    fireEvent.submit(screen.getByLabelText("Password").closest("form")!);

    expect(await screen.findByRole("status")).toHaveTextContent("Check your email");
    expect(mockAuth.signUp).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({ data: { first_name: "Dillon" } }),
    }));
  });

  it("uses the reset-password callback URL", async () => {
    const user = userEvent.setup();
    mockAuth.resetPasswordForEmail.mockResolvedValue({ error: null });
    renderLogin();

    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    await user.type(screen.getByLabelText("Email address"), "cook@example.com");
    fireEvent.submit(screen.getByLabelText("Email address").closest("form")!);

    expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith("cook@example.com", {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  });

  it("starts OAuth with the production-safe origin and remembers the requested route", async () => {
    const user = userEvent.setup();
    mockAuth.signInWithOAuth.mockResolvedValue({ error: null });
    render(<MemoryRouter initialEntries={[{ pathname: "/login", state: { from: { pathname: "/pantry", search: "?filter=low", hash: "#stock" } } }]}><LoginPage /></MemoryRouter>);

    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(mockAuth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    expect(window.sessionStorage.getItem("pantrypilot.oauth.returnTo")).toBe("/pantry?filter=low#stock");
  });

  it("surfaces an OAuth initiation error", async () => {
    const user = userEvent.setup();
    mockAuth.signInWithOAuth.mockResolvedValue({ error: new Error("Google provider is unavailable") });
    renderLogin();

    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Google provider is unavailable");
  });

  it("does not offer Apple sign-in", () => {
    renderLogin();

    expect(screen.queryByRole("button", { name: "Continue with Apple" })).not.toBeInTheDocument();
  });
});

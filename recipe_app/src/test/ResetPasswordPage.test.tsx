import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUpdateUser, mockUseAuth } = vi.hoisted(() => ({
  mockUpdateUser: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({ supabase: { auth: { updateUser: mockUpdateUser } } }));
vi.mock("../app/AuthProvider", () => ({ useAuth: mockUseAuth }));

import ResetPasswordPage from "../app/ResetPasswordPage";

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    mockUpdateUser.mockReset();
    mockUseAuth.mockReturnValue({ loading: false, session: { user: { id: "user-1" } } });
  });

  it("rejects mismatched passwords", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><ResetPasswordPage /></MemoryRouter>);

    await user.type(screen.getByLabelText("New password"), "password123");
    await user.type(screen.getByLabelText("Confirm new password"), "different123");
    fireEvent.submit(screen.getByRole("button", { name: "Update password" }).closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match");
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("updates the password", async () => {
    const user = userEvent.setup();
    mockUpdateUser.mockResolvedValue({ error: null });
    render(<MemoryRouter><ResetPasswordPage /></MemoryRouter>);

    await user.type(screen.getByLabelText("New password"), "password123");
    await user.type(screen.getByLabelText("Confirm new password"), "password123");
    fireEvent.submit(screen.getByRole("button", { name: "Update password" }).closest("form")!);

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: "password123" });
  });
});

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AppErrorBoundary from "../components/AppErrorBoundary";

function BrokenView(): ReactNode {
  throw new Error("render failed");
}

describe("AppErrorBoundary", () => {
  it("shows recovery UI when a child throws", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<AppErrorBoundary><BrokenView /></AppErrorBoundary>);
    expect(screen.getByRole("heading", { name: "PantryPilot needs a refresh" })).toBeInTheDocument();
    errorSpy.mockRestore();
  });

  it("reloads when recovery is requested", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const recover = vi.fn();
    render(<AppErrorBoundary onRecover={recover}><BrokenView /></AppErrorBoundary>);
    await userEvent.click(screen.getByRole("button", { name: "Refresh PantryPilot" }));
    expect(recover).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });
});

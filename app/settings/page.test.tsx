import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import SettingsPage from "./page";

describe("Settings page", () => {
  it("renders heading", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input: any) => {
        const url = typeof input === "string" ? input : input?.url;
        if (url === "/api/tools") {
          return {
            ok: true,
            json: async () => ({ tools: [{ key: "weather", id: "get-weather" }] }),
          } as any;
        }
        return {
          ok: true,
          json: async () => ({ systemPrompt: "x", model: "y", enabledTools: ["weather"] }),
        } as any;
      });

    render(<SettingsPage />);
    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
    await screen.findByDisplayValue("y");

    fetchSpy.mockRestore();
  });
});


import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import SettingsPage from "./page";

function createOkJsonResponse(jsonBody: unknown): Response {
  return {
    ok: true,
    json: async () => jsonBody,
  } as unknown as Response;
}

describe("Settings page", () => {
  it("renders heading", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (requestInput: RequestInfo | URL) => {
        const requestUrl =
          typeof requestInput === "string"
            ? requestInput
            : (requestInput as Request).url;
        if (requestUrl === "/api/tools") {
          return createOkJsonResponse({
            tools: [{ key: "weather", id: "get-weather" }],
          });
        }
        return createOkJsonResponse({
          systemPrompt: "x",
          model: "y",
          enabledTools: ["weather"],
        });
      });

    render(<SettingsPage />);
    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
    await screen.findByDisplayValue("y");

    fetchSpy.mockRestore();
  });
});

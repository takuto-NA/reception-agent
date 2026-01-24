import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("@ai-sdk/react", () => ({
  useChat: () => ({
    messages: [],
    status: "ready",
    error: undefined,
    sendMessage: vi.fn(),
    stop: vi.fn(),
  }),
}));

import Home from "./page";

describe("Home page", () => {
  it("renders heading", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "Chat" })).toBeTruthy();
  });
});

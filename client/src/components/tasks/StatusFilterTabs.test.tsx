import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StatusFilterTabs } from "./StatusFilterTabs.js";

describe("StatusFilterTabs", () => {
  it("renders filters and reports status changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<StatusFilterTabs onChange={onChange} value="active" />);

    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Active" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Completed" })).toHaveAttribute(
      "aria-selected",
      "false"
    );

    await user.click(screen.getByRole("tab", { name: "Completed" }));

    expect(onChange).toHaveBeenCalledWith("completed");
  });
});

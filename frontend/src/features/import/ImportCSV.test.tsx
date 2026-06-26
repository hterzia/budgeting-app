import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ImportCSV } from "./ImportCSV";
import { Account } from "../../types";

vi.mock('../../app/providers/BudgetProvider', () => ({
  useBudget: () => ({ refresh: vi.fn() }),
}));

vi.mock("../../shared/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../shared/ui")>();
  return {
    ...actual,
    useToast: () => ({ push: vi.fn() }),
  };
});

const mockAccounts: Account[] = [
  { id: "acct-1", name: "Chase Checking", type: "checking" },
  { id: "acct-2", name: "Amex CC", type: "credit_card" },
];

describe("ImportCSV", () => {
  it("shows the account dropdown when accounts exist", () => {
    render(<ImportCSV accounts={mockAccounts} onClose={vi.fn()} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText("Chase Checking (Checking)")).toBeInTheDocument();
  });

  it("shows the inline create form directly when no accounts exist", () => {
    render(<ImportCSV accounts={[]} onClose={vi.fn()} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Account name")).toBeInTheDocument();
  });

  it('shows the create form when "+ Create new account" is clicked', () => {
    render(<ImportCSV accounts={mockAccounts} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("+ Create new account"));
    expect(screen.getByPlaceholderText("Account name")).toBeInTheDocument();
  });

  it("hides the create form when its cancel link is clicked", () => {
    render(<ImportCSV accounts={mockAccounts} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("+ Create new account"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(
      screen.queryByPlaceholderText("Account name"),
    ).not.toBeInTheDocument();
  });

  it("renders the drop zone", () => {
    render(<ImportCSV accounts={mockAccounts} onClose={vi.fn()} />);
    expect(screen.getByText(/Drop your CSV here/i)).toBeInTheDocument();
  });

  it("renders the Cancel and Import buttons", () => {
    render(<ImportCSV accounts={mockAccounts} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /import/i })).toBeInTheDocument();
  });

  it("Import button is disabled when no file is selected", () => {
    render(<ImportCSV accounts={mockAccounts} onClose={vi.fn()} />);
    const importBtn = screen.getByRole("button", { name: /import/i });
    expect(importBtn).toBeDisabled();
  });

  it("shows invert amount sign checkbox", () => {
    render(<ImportCSV accounts={mockAccounts} onClose={vi.fn()} />);
    const checkbox = screen.getByRole("checkbox", {
      name: /invert amount sign/i,
    });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(<ImportCSV accounts={mockAccounts} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});


import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import "@testing-library/jest-dom/vitest";
import IssueBoard from "./IssueBoard.jsx";

const sampleIssue = (id, title = `Issue ${id}`, status = "open") => ({
  id,
  title,
  description: `${title} description`,
  status,
  priority: "High",
  assignee: "Alex Doe",
});

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function advance(ms) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("IssueBoard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // Test 1: Search waits 300 ms before sending the request.
  it("debounces search by 300 ms and passes the query", async () => {
    const loadIssues = vi.fn().mockResolvedValue([]);
    render(<IssueBoard loadIssues={loadIssues} />);

    await flushPromises();
    expect(loadIssues).toHaveBeenCalledTimes(1);
    loadIssues.mockClear();

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "timeout" },
    });

    await advance(299);
    expect(loadIssues).not.toHaveBeenCalled();

    await advance(1);
    await flushPromises();

    expect(loadIssues).toHaveBeenCalledTimes(1);
    expect(loadIssues.mock.calls[0][0]).toMatchObject({
      query: "timeout",
      status: "all",
    });
  });

  // Test 2: Stale requests are cancelled and cannot overwrite current results.
  it("cancels stale requests and ignores their late results", async () => {
    let resolveFirst;

    const loadIssues = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce([
        sampleIssue("ENG-2", "Current result"),
      ]);

    render(<IssueBoard loadIssues={loadIssues} />);
    await flushPromises();

    const firstSignal = loadIssues.mock.calls[0][0].signal;

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "current" },
    });

    expect(firstSignal.aborted).toBe(true);

    await act(async () => {
      resolveFirst([sampleIssue("ENG-1", "Stale result")]);
      await Promise.resolve();
    });

    await advance(300);
    await flushPromises();

    expect(screen.getByText("Current result")).toBeInTheDocument();
    expect(screen.queryByText("Stale result")).not.toBeInTheDocument();
  });

  // Test 3: Changing the status filter triggers a new request immediately.
  it("filters immediately when the status changes", async () => {
    const loadIssues = vi.fn().mockResolvedValue([]);
    render(<IssueBoard loadIssues={loadIssues} />);

    await flushPromises();
    loadIssues.mockClear();

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "closed" },
    });

    await flushPromises();

    expect(loadIssues).toHaveBeenCalledTimes(1);
    expect(loadIssues.mock.calls[0][0].status).toBe("closed");
  });

  // Test 4: Selection is preserved when the selected issue remains in results.
  it("preserves selection when the issue remains in refreshed results", async () => {
    const loadIssues = vi
      .fn()
      .mockResolvedValueOnce([
        sampleIssue("ENG-1"),
        sampleIssue("ENG-2"),
      ])
      .mockResolvedValueOnce([
        sampleIssue("ENG-2", "Updated title"),
      ]);

    render(<IssueBoard loadIssues={loadIssues} />);
    await flushPromises();

    fireEvent.click(screen.getByRole("button", { name: /ENG-2/ }));

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "closed" },
    });

    await flushPromises();

    expect(
      screen.getByRole("button", { name: /ENG-2/ }),
    ).toHaveAttribute("aria-pressed", "true");

    expect(
      screen.getByRole("heading", { name: "Updated title" }),
    ).toBeInTheDocument();
  });

  // Test 5: Selection is cleared when the selected issue disappears.
  it("clears selection when the selected issue disappears", async () => {
    const loadIssues = vi
      .fn()
      .mockResolvedValueOnce([
        sampleIssue("ENG-1"),
        sampleIssue("ENG-2"),
      ])
      .mockResolvedValueOnce([sampleIssue("ENG-1")]);

    render(<IssueBoard loadIssues={loadIssues} />);
    await flushPromises();

    fireEvent.click(screen.getByRole("button", { name: /ENG-2/ }));

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "closed" },
    });

    await flushPromises();

    expect(
      screen.getByText("Select an issue to see its details."),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", { name: "Issue ENG-2" }),
    ).not.toBeInTheDocument();
  });

  // Test 6: An API failure displays an error; Retry successfully reloads issues.
  it("shows an error and retries successfully", async () => {
    const loadIssues = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce([
        sampleIssue("ENG-3", "Recovered issue"),
      ]);

    render(<IssueBoard loadIssues={loadIssues} />);
    await flushPromises();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Issues couldn’t be loaded.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await flushPromises();

    expect(screen.getByText("Recovered issue")).toBeInTheDocument();
    expect(loadIssues).toHaveBeenCalledTimes(2);
  });

  // Test 7: An empty successful response displays the empty state.
  it("shows the empty state after a successful empty response", async () => {
    render(<IssueBoard loadIssues={vi.fn().mockResolvedValue([])} />);

    await flushPromises();

    expect(
      screen.getByRole("heading", { name: "No issues found" }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Try another search or change the status filter.",
      ),
    ).toBeInTheDocument();
  });

  // Test 8: Unmounting the component aborts its pending request.
  it("aborts pending requests when unmounted", async () => {
    const loadIssues = vi.fn(() => new Promise(() => {}));

    const { unmount } = render(
      <IssueBoard loadIssues={loadIssues} />,
    );

    await flushPromises();

    const signal = loadIssues.mock.calls[0][0].signal;
    expect(signal.aborted).toBe(false);

    unmount();

    expect(signal.aborted).toBe(true);
  });
});

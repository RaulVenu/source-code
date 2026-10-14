
const issues = [
  {
    id: "ENG-2048",
    title: "Search results are not updated when filters change",
    description:
      "Changing the status filter leaves the previous results visible until the page is refreshed.",
    status: "open",
    priority: "High",
    assignee: "Olivia Rhye",
    initials: "OR",
    updatedAt: "12 min ago",
    labels: ["Search", "Bug"],
  },
  {
    id: "ENG-2047",
    title: "Add keyboard shortcuts to the command menu",
    description:
      "Let people navigate the command menu without taking their hands off the keyboard.",
    status: "in-progress",
    priority: "Medium",
    assignee: "Phoenix Baker",
    initials: "PB",
    updatedAt: "38 min ago",
    labels: ["Accessibility", "Enhancement"],
  },
  {
    id: "ENG-2046",
    title: "Board columns overflow on smaller screens",
    description:
      "The issue board should remain easy to navigate on tablet and mobile widths.",
    status: "open",
    priority: "Medium",
    assignee: "Lana Steiner",
    initials: "LS",
    updatedAt: "1 hr ago",
    labels: ["Responsive", "UI"],
  },
  {
    id: "ENG-2045",
    title: "Document the public issues API",
    description:
      "Add examples for pagination, status filtering, and request cancellation.",
    status: "closed",
    priority: "Low",
    assignee: "Demi Wilkinson",
    initials: "DW",
    updatedAt: "2 hrs ago",
    labels: ["Documentation"],
  },
  {
    id: "ENG-2044",
    title: "Keep the selected issue when results refresh",
    description:
      "Refreshing a list should not clear a selection that is still present.",
    status: "in-progress",
    priority: "High",
    assignee: "Candice Wu",
    initials: "CW",
    updatedAt: "3 hrs ago",
    labels: ["State", "Enhancement"],
  },
  {
    id: "ENG-2043",
    title: "Show a helpful message when there are no matches",
    description:
      "Give people a clear way to recover when a search or filter has no results.",
    status: "closed",
    priority: "Low",
    assignee: "Natali Craig",
    initials: "NC",
    updatedAt: "Yesterday",
    labels: ["Search", "UX"],
  },
];

export function loadIssues({ query = "", status = "all", signal }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("The request was aborted.", "AbortError"));
      return;
    }

    const abortError = () =>
      new DOMException("The request was aborted.", "AbortError");

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", handleAbort);
    };

    const handleAbort = () => {
      cleanup();
      reject(abortError());
    };

    const timeoutId = window.setTimeout(() => {
      cleanup();

      const normalizedQuery = query.trim().toLowerCase();

      const results = issues.filter((issue) => {
        const searchableText = [
          issue.id,
          issue.title,
          issue.description,
          ...issue.labels,
        ]
          .join(" ")
          .toLowerCase();

        const matchesQuery = searchableText.includes(normalizedQuery);
        const matchesStatus =
          status === "all" || issue.status === status;

        return matchesQuery && matchesStatus;
      });

      resolve(results);
    }, 180);

    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

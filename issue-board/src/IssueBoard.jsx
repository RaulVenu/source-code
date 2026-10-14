
import { useEffect, useRef, useState } from "react";

const statusLabels = {
  open: "Open",
  "in-progress": "In progress",
  closed: "Closed",
};

export default function IssueBoard({ loadIssues }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [issues, setIssues] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const controllerRef = useRef(null);

  // Debounce search input by 300 ms.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  // Cancel the active request immediately when search text changes.
  useEffect(() => {
    if (query.trim() !== debouncedQuery) {
      controllerRef.current?.abort();
      controllerRef.current = null;
      setLoading(true);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let active = true;

    controllerRef.current = controller;

    const isCurrent = () =>
      active &&
      !controller.signal.aborted &&
      controllerRef.current === controller;

    setLoading(true);
    setError(null);

    Promise.resolve()
      .then(() => {
        // Strict Mode may clean up an effect before this runs.
        if (!isCurrent()) return undefined;

        return loadIssues({
          query: debouncedQuery,
          status,
          signal: controller.signal,
        });
      })
      .then((nextIssues) => {
        if (!isCurrent() || nextIssues === undefined) return;

        setIssues(nextIssues);

        // Keep the selection if the issue ID is still in the results.
        setSelectedId((currentId) =>
          currentId != null &&
          nextIssues.some((issue) => issue.id === currentId)
            ? currentId
            : null,
        );
      })
      .catch((requestError) => {
        if (!isCurrent()) return;

        setError(requestError);
      })
      .finally(() => {
        if (!isCurrent()) return;

        setLoading(false);
        controllerRef.current = null;
      });

    return () => {
      active = false;
      controller.abort();

      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    };
  }, [loadIssues, query, debouncedQuery, status, retryCount]);

  const selectedIssue =
    issues.find((issue) => issue.id === selectedId) ?? null;

  return (
    <main className="app">
      <header className="header">
        <div>
          <h1>Issue Board</h1>
          <p>Search and filter your team's issues.</p>
        </div>

        <button type="button">+ New issue</button>
      </header>

      <section className="toolbar" aria-label="Issue filters">
        <label htmlFor="issue-search">Search</label>
        <input
          id="issue-search"
          type="search"
          placeholder="Search by title or ID"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <label htmlFor="issue-status">Status</label>
        <select
          id="issue-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="in-progress">In progress</option>
          <option value="closed">Closed</option>
        </select>

        <span className="count" aria-live="polite">
          {issues.length} {issues.length === 1 ? "issue" : "issues"}
        </span>
      </section>

      <section className="board" aria-label="Issues">
        <div className="issue-list">
          <h2>Issues</h2>

          {loading && (
            <p className="message" role="status">
              Loading issues...
            </p>
          )}

          {!loading && error && (
            <div className="message error" role="alert">
              <span>
                Issues couldn’t be loaded. Please try again.
              </span>

              <button
                type="button"
                onClick={() =>
                  setRetryCount((count) => count + 1)
                }
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && issues.length === 0 && (
            <div className="message">
              <h3>No issues found</h3>
              <p>
                Try another search or change the status filter.
              </p>
            </div>
          )}

          {!loading && !error && issues.length > 0 && (
            <ul>
              {issues.map((issue) => (
                <li key={issue.id}>
                  <button
                    type="button"
                    className={
                      selectedId === issue.id
                        ? "issue selected"
                        : "issue"
                    }
                    aria-pressed={selectedId === issue.id}
                    onClick={() => setSelectedId(issue.id)}
                  >
                    <span>
                      <strong>{issue.id}</strong>
                      <span>{issue.title}</span>
                    </span>

                    <small>
                      {statusLabels[issue.status] ??
                        issue.status}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="details" aria-label="Issue details">
          {selectedIssue ? (
            <>
              <p className="issue-id">{selectedIssue.id}</p>
              <h2>{selectedIssue.title}</h2>
              <p>{selectedIssue.description}</p>

              <dl>
                <div>
                  <dt>Status</dt>
                  <dd>
                    {statusLabels[selectedIssue.status] ??
                      selectedIssue.status}
                  </dd>
                </div>

                <div>
                  <dt>Priority</dt>
                  <dd>{selectedIssue.priority}</dd>
                </div>

                <div>
                  <dt>Assignee</dt>
                  <dd>{selectedIssue.assignee}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="message">
              Select an issue to see its details.
            </p>
          )}
        </aside>
      </section>
    </main>
  );
}

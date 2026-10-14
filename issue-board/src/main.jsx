// import React from "react";
// import { createRoot } from "react-dom/client";
// import IssueBoard from "./IssueBoard.jsx";
// import { loadIssues } from "./issues.js";
// import "./styles.css";

// createRoot(document.getElementById("root")).render(
//   <React.StrictMode>
//     <IssueBoard loadIssues={loadIssues} />
//   </React.StrictMode>,
// );



import React, { useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import IssueBoard from "./IssueBoard.jsx";
import { loadIssues as realLoadIssues } from "./issues.js";
import "./styles.css";

function App() {
  const attempts = useRef(0);

  const loadIssues = useCallback((params) => {
    attempts.current += 1;

    // Simulate failure on the first API request.
    if (attempts.current === 1) {
      return Promise.reject(
        new Error("Simulated network failure")
      );
    }

    // Retry succeeds using your existing issues.js.
    return realLoadIssues(params);
  }, []);

  return <IssueBoard loadIssues={loadIssues} />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


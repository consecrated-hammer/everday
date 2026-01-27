import { Component } from "react";
import { Logger } from "../lib/logger.js";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(_error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    Logger.Error("ErrorBoundary caught error", {
      error: error?.message || String(error),
      stack: error?.stack,
      componentStack: errorInfo?.componentStack
    });
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "var(--color-bg-base)",
          color: "var(--color-text-base)",
          padding: "20px"
        }}>
          <div style={{
            maxWidth: "600px",
            padding: "24px",
            background: "var(--color-surface-base)",
            border: "1px solid var(--color-border-base)",
            borderRadius: "8px"
          }}>
            <h1 style={{ margin: "0 0 16px", fontSize: "24px", color: "var(--color-error)" }}>
              Something went wrong
            </h1>
            <p style={{ margin: "0 0 16px", fontSize: "14px", lineHeight: "1.5" }}>
              The application encountered an unexpected error. Please try refreshing the page.
            </p>
            {this.state.error && (
              <details style={{ marginTop: "16px" }}>
                <summary style={{
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "500",
                  marginBottom: "8px"
                }}>
                  Error details
                </summary>
                <pre style={{
                  fontSize: "12px",
                  background: "var(--color-bg-base)",
                  padding: "12px",
                  borderRadius: "4px",
                  overflow: "auto",
                  margin: "8px 0 0"
                }}>
                  {this.state.error.toString()}
                  {this.state.error.stack && `\n\n${this.state.error.stack}`}
                </pre>
              </details>
            )}
            <div style={{ marginTop: "24px" }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: "8px 16px",
                  background: "var(--color-primary)",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500"
                }}
              >
                Refresh page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

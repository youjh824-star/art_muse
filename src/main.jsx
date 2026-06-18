import "./index.css";
import { StrictMode, Component } from "react";
import { createRoot } from "react-dom/client";
import App from "../artlog-demo.jsx";
import { AppProviders } from "./providers/AppProviders.jsx";

class RootErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "#FAF7F2", padding: "24px", textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#3D3530", marginBottom: 8 }}>
            앱 오류가 발생했습니다
          </div>
          <div style={{
            fontSize: 12, color: "#8C7B72", background: "#F0EBE3",
            borderRadius: 8, padding: "12px 16px", maxWidth: 340,
            wordBreak: "break-all", lineHeight: 1.6, marginBottom: 16,
          }}>
            {this.state.error?.message ?? String(this.state.error)}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "12px 24px", borderRadius: 12, background: "#C17F5B",
              color: "white", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}
          >
            앱 다시 시작
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RootErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </RootErrorBoundary>
  </StrictMode>
);

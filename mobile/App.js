import ErrorBoundary from "./src/components/ErrorBoundary";
import ArtlogWebView from "./src/components/ArtlogWebView";

export default function App() {
  return (
    <ErrorBoundary>
      <ArtlogWebView />
    </ErrorBoundary>
  );
}

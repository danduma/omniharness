import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
  componentStack: string | null;
}

/**
 * Last line of defence around the app tree. React unmounts everything on an
 * uncaught render error, so without this a single throw anywhere — a menu part
 * used outside its required parent, a bad snapshot parse — blanks the window
 * with no clue as to why.
 *
 * Deliberately dependency-light: it must keep working when whatever it caught
 * has already broken the surrounding UI.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null });
    console.error("[omniharness] uncaught render error", error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ error: null, componentStack: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error, componentStack } = this.state;
    if (!error) {
      return this.props.children;
    }

    const details = [error.stack || `${error.name}: ${error.message}`, componentStack]
      .filter(Boolean)
      .join("\n\n");

    return (
      <div role="alert" className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-2xl rounded-lg border border-destructive/30 bg-destructive/[0.03] p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-semibold text-foreground">
                {t("app.crash.title")}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("app.crash.description")}
              </p>
              <p className="mt-3 break-words font-mono text-xs text-destructive">
                {error.message || String(error)}
              </p>
              {details ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    {t("app.crash.details")}
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-2 font-mono text-[10px] leading-4 text-muted-foreground">
                    {details}
                  </pre>
                </details>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={this.handleReload}>
                  {t("app.crash.reload")}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={this.handleRetry}>
                  {t("app.crash.retry")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

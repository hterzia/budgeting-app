import { Component, ReactNode } from "react";

interface WidgetErrorBoundaryProps {
  children: ReactNode;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
}

export class WidgetErrorBoundary extends Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  state: WidgetErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): WidgetErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: WidgetErrorBoundaryProps) {
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-40 items-center justify-center rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          This widget failed to render.
        </div>
      );
    }

    return this.props.children;
  }
}

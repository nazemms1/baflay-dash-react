import { Component, type ReactNode } from "react";
import { RenderErrorScreen } from "./ErrorScreen";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * يلتقط أي خطأ يحدث أثناء رسم الشاشة، فيعرض رسالة مهذبة بدل أن تختفي الصفحة كلها.
 * React يسجّل التفاصيل التقنية في الكونسول تلقائياً، والمستخدم لا يرى إلا الرسالة.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <RenderErrorScreen /> : this.props.children;
  }
}

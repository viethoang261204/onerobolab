import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { messagesFor } from '../../features/i18n/i18n';
import { buttonClass } from './Button';
import { commonMessages } from './common.messages';

interface ErrorBoundaryProps {
  /** Student-facing title ("Level could not be loaded"). */
  title: string;
  children: ReactNode;
  /** Called when the student presses "Try again" (e.g. reload the level). */
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * Catches render errors in a region and shows a friendly message instead of
 * a blank screen. Details go to the developer console only.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[OneRoboLab] ${this.props.title}`, error, info.componentStack);
  }

  private retry = () => {
    this.props.onRetry?.();
    this.setState({ failed: false });
  };

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    const m = messagesFor(commonMessages);
    return (
      <div className="flex h-full w-full items-center justify-center bg-bg p-6">
        <div className="glass max-w-[340px] rounded-[var(--radius-dialog)] p-6 text-center">
          <AlertTriangle className="mx-auto text-warning" size={30} />
          <h2 className="mt-2 font-display text-[18px] font-black uppercase tracking-wide text-white">{this.props.title}</h2>
          <p className="mt-2 text-[13px] text-muted">{m.errorBody}</p>
          <button type="button" onClick={this.retry} className={buttonClass('primary', 'mx-auto mt-4')}>
            <RotateCcw size={15} /> {m.tryAgain}
          </button>
        </div>
      </div>
    );
  }
}

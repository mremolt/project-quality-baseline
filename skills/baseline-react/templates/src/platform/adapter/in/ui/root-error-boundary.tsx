import { Component, type ReactNode } from 'react';

import { ReportErrorContext } from '../../../platform.tokens';
import type { ReportErrorUseCase } from '../../../ports/in/report-error.use-case';
import { ErrorMessage } from './error-message';

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly failed: boolean;
}

/** Last line of defence for render errors outside the router; reports and shows the generic message (REACT-ARCH-15). */
export class RootErrorBoundary extends Component<Props, State> {
  static override readonly contextType = ReportErrorContext;
  declare context: ReportErrorUseCase | null;
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error): void {
    this.context?.report(error);
  }

  override render(): ReactNode {
    return this.state.failed ? <ErrorMessage /> : this.props.children;
  }
}

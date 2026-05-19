import { Component, type ReactNode } from 'react'

interface State { hasError: boolean; error: Error | null }
interface Props { children: ReactNode; fallback?: (error: Error) => ReactNode }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error)
      return (
        <div className="warning-banner" style={{ whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 12 }}>
          {this.state.error.message}
        </div>
      )
    }
    return this.props.children
  }
}

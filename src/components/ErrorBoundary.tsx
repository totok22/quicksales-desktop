import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('错误边界捕获到错误:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-red-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl">
            <h2 className="text-2xl font-bold text-red-600 mb-4">应用出错</h2>
            <div className="bg-red-100 p-4 rounded mb-4">
              <p className="font-mono text-sm text-red-800">
                {this.state.error?.toString()}
              </p>
            </div>
            <p className="text-slate-600 mb-4">
              请刷新页面重试，或查看浏览器控制台(F12)获取更多信息。
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              刷新页面
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

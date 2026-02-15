import { Suspense, lazy } from 'react'
import TopNav from './components/layout/TopNav'
import { useStore } from './stores/useStore'
import { useDataLoader } from './hooks/useDataLoader'
import { ThemeProvider } from './providers/ThemeProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

const OrderEntry = lazy(() => import('./pages/OrderEntry').then(m => ({ default: m.OrderEntry })))
const OrderHistory = lazy(() => import('./pages/OrderHistory').then(m => ({ default: m.OrderHistory })))
const ProductManagement = lazy(() => import('./pages/ProductManagement').then(m => ({ default: m.ProductManagement })))
const CustomerManagement = lazy(() => import('./pages/CustomerManagement').then(m => ({ default: m.CustomerManagement })))
const PresetManagement = lazy(() => import('./pages/PresetManagement').then(m => ({ default: m.PresetManagement })))
const SalesStatistics = lazy(() => import('./pages/SalesStatistics').then(m => ({ default: m.SalesStatistics })))
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })))

function App() {
  const { currentView, setCurrentView, loading } = useStore()

  // 加载数据
  useDataLoader()

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">系统加载中...</p>
        </div>
      </div>
    )
  }

  // 渲染当前视图
  const renderView = () => {
    switch (currentView) {
      case 'order':
        return <OrderEntry />
      case 'history':
        return <OrderHistory />
      case 'products':
        return <ProductManagement />
      case 'customers':
        return <CustomerManagement />
      case 'remark-presets':
        return <PresetManagement />
      case 'analytics':
        return <SalesStatistics />
      case 'settings':
        return <Settings />
      default:
        return <OrderEntry />
    }
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <div className="flex flex-col h-screen w-screen bg-background">
          <TopNav currentView={currentView} onChangeView={setCurrentView} />
          <main className="flex-1 h-full overflow-hidden">
            <Suspense
              fallback={
                <div className="h-full flex items-center justify-center bg-background">
                  <div className="text-center">
                    <div className="inline-block h-7 w-7 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                    <p className="mt-3 text-sm text-muted-foreground">页面加载中...</p>
                  </div>
                </div>
              }
            >
              {renderView()}
            </Suspense>
          </main>
        </div>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App

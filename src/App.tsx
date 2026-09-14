import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Pipeline } from './pages/Pipeline'
import { Demos } from './pages/Demos'
import { DemoDetail } from './pages/DemoDetail'
import { Catalog } from './pages/Catalog'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="demos" element={<Demos />} />
          <Route path="demos/:demoId" element={<DemoDetail />} />
          <Route path="catalog" element={<Catalog />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

// src/renderer/src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { CreateLabel } from './pages/CreateLabel'
import { LabelList } from './pages/LabelList'
import { Scanner } from './pages/Scanner'
import { Inventory } from './pages/Inventory'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/create-label" element={<CreateLabel />} />
        <Route path="/labels" element={<LabelList />} />
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/inventory" element={<Inventory />} />
      </Routes>
    </Layout>
  )
}
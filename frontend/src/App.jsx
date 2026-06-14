import { Routes, Route, Navigate } from 'react-router-dom'
import Auth from './components/Auth'
import Home from './components/Home'
import GroupDetails from './components/GroupDetails'
import RecentActivity from './components/RecentActivity'
import ExpenseDetails from './components/ExpenseDetails'
import './App.css'

function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f5f5f5' }}>
      <Routes>
        {/* Auth Route gets centered styling */}
        <Route path="/auth" element={
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Auth />
          </div>
        } />
        
        <Route path="/" element={<Home />} />
        <Route path="/group/:id" element={<GroupDetails />} />
        <Route path="/activity" element={<RecentActivity />} />
        <Route path="/expense/:id" element={<ExpenseDetails />} />

        {/* Fallback to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App

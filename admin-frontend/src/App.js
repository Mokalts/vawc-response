import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/Login';
import FaceEnroll from './pages/FaceEnroll';
import FaceVerify from './pages/FaceVerify';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import ReportDetail from './pages/ReportDetail';
import AdminManagement from './pages/AdminManagement';
import PrintDocument from './pages/PrintDocument';

import './styles/global.css';

// Requires completed password login only (for face pages)
function LoginRequired({ children }) {
  const user = localStorage.getItem("admin_user");
  if (!user) return <Navigate to="/" replace />;
  return children;
}

// Requires BOTH password login AND completed face verification
function ProtectedRoute({ children }) {
  const user        = localStorage.getItem("admin_user");
  const faceVerified = localStorage.getItem("face_verified");

  if (!user)                        return <Navigate to="/" replace />;
  if (faceVerified !== "true")      return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* Face pages: need password login but not yet face-verified */}
        <Route path="/face-enroll" element={<LoginRequired><FaceEnroll /></LoginRequired>} />
        <Route path="/face-verify" element={<LoginRequired><FaceVerify /></LoginRequired>} />

        {/* Protected pages: need full authentication (password + face) */}
        <Route path="/dashboard"        element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/reports"          element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/reports/:id"      element={<ProtectedRoute><ReportDetail /></ProtectedRoute>} />
        <Route path="/admin-management" element={<ProtectedRoute><AdminManagement /></ProtectedRoute>} />
        <Route path="/print/:type/:caseId" element={<ProtectedRoute><PrintDocument /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;

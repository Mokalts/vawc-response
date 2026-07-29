import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import OTP from './pages/OTP';
import ForgotPassword from './pages/ForgotPassword';
import Home from './pages/Home';
import ReportNow from './pages/ReportNow';
import MyCases from './pages/MyCases';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import ContactUs from './pages/ContactUs';
import VerifyEmail from './pages/VerifyEmail';
import ChangePassword from './pages/ChangePassword';
import Awareness from './pages/Awareness';

import './styles/global.css';

// Redirect to sign-in when no token is present.
// Token expiry / 401s are handled by axios interceptors in api.js.
function RequireAuth({ children }) {
  const location = useLocation();
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/" replace state={{ from: location }} />;
  return children;
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/otp" element={<OTP />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify" element={<VerifyEmail />} />
        <Route path="/awareness" element={<Awareness />} />
        <Route path="/contact" element={<ContactUs />} />

        {/* Protected routes */}
        <Route path="/home"            element={<RequireAuth><Home /></RequireAuth>} />
        <Route path="/report"          element={<RequireAuth><ReportNow /></RequireAuth>} />
        <Route path="/my-reports"      element={<RequireAuth><MyCases /></RequireAuth>} />
        <Route path="/profile"         element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/settings"        element={<RequireAuth><Settings /></RequireAuth>} />
        <Route path="/change-password" element={<RequireAuth><ChangePassword /></RequireAuth>} />
      </Routes>
    </Router>
  );
}

export default App;

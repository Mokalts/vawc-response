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
import Terms from './pages/Terms';
import QuickExit, { useTripleEscape } from './components/QuickExit';

import './styles/global.css';

// The escape control belongs on every screen, including the public ones — she
// may be reading the awareness pages before she ever signs in.
//
// On screens with the bottom bar it IS an item in that bar, so no floating pill
// is rendered: floating above the content is what covered the Submit Report
// button. These are the routes whose pages render <BottomNavbar/>; the rest are
// the sign-in and verification screens, where a bar of in-app links would be
// useless, so they keep the pill.
const NAV_ROUTES = [
  '/home', '/report', '/my-reports', '/profile', '/settings',
  '/terms', '/contact', '/awareness', '/change-password',
];
function GlobalQuickExit() {
  const { pathname } = useLocation();
  useTripleEscape();   // works on every screen, bar or no bar
  if (NAV_ROUTES.includes(pathname)) return null;
  return <QuickExit />;
}

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
        <Route path="/terms" element={<Terms />} />

        {/* Protected routes */}
        <Route path="/home"            element={<RequireAuth><Home /></RequireAuth>} />
        <Route path="/report"          element={<RequireAuth><ReportNow /></RequireAuth>} />
        <Route path="/my-reports"      element={<RequireAuth><MyCases /></RequireAuth>} />
        <Route path="/profile"         element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/settings"        element={<RequireAuth><Settings /></RequireAuth>} />
        <Route path="/change-password" element={<RequireAuth><ChangePassword /></RequireAuth>} />
      </Routes>
      <GlobalQuickExit />
    </Router>
  );
}

export default App;

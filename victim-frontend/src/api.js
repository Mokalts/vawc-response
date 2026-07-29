import axios from "axios";

// Backend base URL — set REACT_APP_API_URL at build time for production.
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const api = axios.create({
    baseURL: API_URL,
});

// ── Token helpers ─────────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem("token"); }
function setToken(t) { localStorage.setItem("token", t); }
function clearSession() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
}

// ── Proactive refresh timer ───────────────────────────────────────────────────
// Victim token uses ACCESS_TOKEN_EXPIRE_MINUTES from settings.
// Default FastAPI setups are commonly 30min–24hr.
// We decode the JWT exp claim to know exactly when it expires.

let _refreshTimer = null;

function getTokenExpiry() {
    const token = getToken();
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.exp ? payload.exp * 1000 : null; // convert to ms
    } catch {
        return null;
    }
}

function scheduleRefresh() {
    if (_refreshTimer) clearTimeout(_refreshTimer);
    const expiry = getTokenExpiry();
    if (!expiry) return;

    const msUntilExpiry = expiry - Date.now();
    if (msUntilExpiry <= 0) {
        // Already expired - clear and redirect
        clearSession();
        window.location.href = "/";
        return;
    }

    // Refresh 2 minutes before expiry, minimum 5s from now
    const delay = Math.max(msUntilExpiry - 2 * 60 * 1000, 5000);
    _refreshTimer = setTimeout(silentRefresh, delay);
}

async function silentRefresh() {
    const token = getToken();
    if (!token) return;
    try {
        const res = await axios.post(
            `${API_URL}/auth/refresh`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const newToken = res.data.access_token;
        setToken(newToken);
        scheduleRefresh(); // schedule next refresh based on new token expiry
    } catch {
        // Token expired or user deactivated - log out
        if (_refreshTimer) clearTimeout(_refreshTimer);
        const hadSession = !!getToken();
        clearSession();
        if (hadSession) window.location.href = "/";
    }
}

// Start refresh cycle on load if session exists
if (getToken()) {
    scheduleRefresh();
}

// ── Re-check token when tab becomes visible again ─────────────────────────────
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && getToken()) {
        const expiry = getTokenExpiry();
        if (!expiry) return;
        const msLeft = expiry - Date.now();
        if (msLeft <= 0) {
            clearSession();
            window.location.href = "/";
        } else if (msLeft < 5 * 60 * 1000) {
            silentRefresh();
        } else {
            scheduleRefresh();
        }
    }
});

// ── Request interceptor - attach Bearer token ─────────────────────────────────
api.interceptors.request.use((config) => {
    const token = getToken();
    if (token) config.headers["Authorization"] = `Bearer ${token}`;
    return config;
}, (error) => Promise.reject(error));

// ── Response interceptor - handle 401 ────────────────────────────────────────
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error.response?.status;
        const url    = error.config?.url || "";

        // Don't loop on the refresh endpoint itself
        if (status === 401 && !url.includes("/auth/refresh")) {
            // Try one silent refresh before giving up
            try {
                const token = getToken();
                const res = await axios.post(
                    `${API_URL}/auth/refresh`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const newToken = res.data.access_token;
                setToken(newToken);
                scheduleRefresh();
                // Retry original request with new token
                error.config.headers["Authorization"] = `Bearer ${newToken}`;
                return api(error.config);
            } catch {
                const hadSession = !!getToken();
                if (_refreshTimer) clearTimeout(_refreshTimer);
                clearSession();
                if (hadSession) window.location.href = "/";
            }
        }

        return Promise.reject(error);
    }
);

export default api;

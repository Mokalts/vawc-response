import axios from "axios";

// Backend base URL — set REACT_APP_API_URL at build time for production.
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
});

// ── Proactive refresh timer ───────────────────────────────────────────────────
// Cookie expires in 8hr (28800s). Refresh 15min (900s) before expiry.
// We store the timer so we can clear and reset it after each refresh.

let _refreshTimer = null;

function scheduleRefresh(msUntilExpiry) {
    if (_refreshTimer) clearTimeout(_refreshTimer);
    // Refresh 15 minutes before the token expires, minimum 5s from now
    const delay = Math.max(msUntilExpiry - 15 * 60 * 1000, 5000);
    _refreshTimer = setTimeout(silentRefresh, delay);
}

async function silentRefresh() {
    try {
        await api.post("/admin/auth/refresh");
        // Refresh succeeded - schedule the next one in ~7h45m
        scheduleRefresh(8 * 60 * 60 * 1000);
    } catch {
        // Refresh failed (token already expired or account deactivated)
        // Clear everything and redirect to login
        localStorage.removeItem("admin_user");
        window.location.href = "/";
    }
}

// Start the refresh cycle when the module loads.
// The admin is either just logged in or returning to a tab.
// We always schedule based on the full 8hr window since we can't
// read the httpOnly cookie expiry directly.
// If the cookie is already expired, the first API call will 401 anyway.
function startRefreshCycle() {
    scheduleRefresh(8 * 60 * 60 * 1000);
}

// Kick off on load if admin session exists
if (localStorage.getItem("admin_user")) {
    startRefreshCycle();
}

// ── Re-check admin token when tab becomes visible again ───────────────────────
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && localStorage.getItem("admin_user")) {
        silentRefresh();
    }
});

// ── Response interceptor - handle 401 ────────────────────────────────────────
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error.response?.status;
        const url = error.config?.url || "";

        // Don't loop on the refresh endpoint itself
        if (status === 401 && !url.includes("/auth/")) {
            // Try one silent refresh before giving up
            try {
                await axios.post(
                    `${API_URL}/admin/auth/refresh`,
                    {},
                    { withCredentials: true }
                );
                // Retry the original request once
                return api(error.config);
            } catch {
                localStorage.removeItem("admin_user");
                if (_refreshTimer) clearTimeout(_refreshTimer);
                window.location.href = "/";
            }
        }

        return Promise.reject(error);
    }
);

export { startRefreshCycle };
export default api;

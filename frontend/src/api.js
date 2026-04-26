const BASE = "https://atompay-production.up.railway.app/api";
// const BASE = "https://atompay.onrender.com/api";
// const BASE = "http://localhost:3000/api";

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (cb) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

export const api = async (path, options = {}, token = null) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res = await fetch(`${BASE}${path}`, { ...options, headers });
  
  // Handling 204 No Content or empty response body just in case
  let data;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    data = { msg: text };
  }

  // Handle 401 Unauthorized by trying to refresh the token
  if (res.status === 401 && token) {
    const refreshToken = localStorage.getItem("refreshToken");
    if (refreshToken) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(`${BASE}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken })
          });
          
          const refreshText = await refreshRes.text();
          let refreshData;
          try {
            refreshData = refreshText ? JSON.parse(refreshText) : {};
          } catch (e) {
            refreshData = {};
          }
          
          if (!refreshRes.ok) {
            // Refresh token failed/expired
            throw new Error("Session expired, please login again");
          }

          const newAccessToken = refreshData.accessToken;
          localStorage.setItem("token", newAccessToken);
          
          if (window.__onTokenRefresh) {
            window.__onTokenRefresh(newAccessToken);
          }

          isRefreshing = false;
          onRefreshed(newAccessToken);
        } catch (err) {
          isRefreshing = false;
          onRefreshed(null); // release waiting requests
          
          // Clear everything and logout
          localStorage.removeItem("token");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("user");
          if (window.__onTokenRefresh) {
            window.__onTokenRefresh(null);
          }
          throw new Error("Session expired, please login again");
        }
      }

      // Wait for the token to be refreshed
      const newToken = await new Promise((resolve) => {
        subscribeTokenRefresh((t) => {
          resolve(t);
        });
      });

      if (newToken) {
        // Retry the original request with the new token
        headers["Authorization"] = `Bearer ${newToken}`;
        res = await fetch(`${BASE}${path}`, { ...options, headers });
        
        const retryText = await res.text();
        try {
          data = retryText ? JSON.parse(retryText) : {};
        } catch (e) {
          data = { msg: retryText };
        }
      } else {
        throw new Error("Session expired, please login again");
      }
    }
  }

  if (!res.ok) throw new Error(data.msg || data.message || "Something went wrong");
  return data;
};

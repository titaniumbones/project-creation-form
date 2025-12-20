// OAuth token management for all services
const TOKEN_STORAGE_KEY = 'project_creator_tokens';
const USER_INFO_KEY = 'project_creator_user';
const OAUTH_RELAY_URL = import.meta.env.VITE_OAUTH_RELAY_URL || 'https://airtable-asana-integration-oauth.netlify.app';

export const tokenManager = {
  getTokens() {
    try {
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  },

  getToken(service) {
    const tokens = this.getTokens();
    return tokens[service] || null;
  },

  setToken(service, tokenData) {
    const tokens = this.getTokens();
    tokens[service] = {
      ...tokenData,
      savedAt: Date.now(),
    };
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  },

  clearToken(service) {
    const tokens = this.getTokens();
    delete tokens[service];
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  },

  clearAll() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_INFO_KEY);
  },

  isTokenValid(service) {
    const token = this.getToken(service);
    if (!token || !token.access_token) return false;
    if (token.expiresAt && Date.now() > token.expiresAt - 60000) return false;
    return true;
  },
};

// User info management (for draft ownership)
export const userManager = {
  getUserInfo() {
    try {
      const stored = localStorage.getItem(USER_INFO_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  setUserInfo(info) {
    localStorage.setItem(USER_INFO_KEY, JSON.stringify(info));
  },

  clearUserInfo() {
    localStorage.removeItem(USER_INFO_KEY);
  },

  getEmail() {
    const info = this.getUserInfo();
    return info?.email || null;
  },
};

// Fetch current user info from Airtable
async function fetchAirtableUserInfo(accessToken) {
  try {
    const response = await fetch('https://api.airtable.com/v0/meta/whoami', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.warn('Failed to fetch Airtable user info');
      return null;
    }

    const data = await response.json();
    return {
      id: data.id,
      email: data.email,
    };
  } catch (err) {
    console.warn('Error fetching Airtable user info:', err);
    return null;
  }
}

// Get current user email (tries Airtable first, then cached)
export async function getCurrentUserEmail() {
  // Check cached user info first
  const cached = userManager.getUserInfo();
  if (cached?.email) {
    return cached.email;
  }

  // Try to fetch from Airtable if connected
  if (tokenManager.isTokenValid('airtable')) {
    const token = tokenManager.getToken('airtable');
    const userInfo = await fetchAirtableUserInfo(token.access_token);
    if (userInfo?.email) {
      userManager.setUserInfo(userInfo);
      return userInfo.email;
    }
  }

  return null;
}

// Get valid access token, refreshing if needed
export async function getValidToken(service) {
  const token = tokenManager.getToken(service);

  if (!token || !token.refresh_token) {
    return null;
  }

  // Check if token still valid (with 1 minute buffer)
  if (token.expiresAt && Date.now() < token.expiresAt - 60000) {
    return token.access_token;
  }

  // Need to refresh
  try {
    const response = await fetch(`${OAUTH_RELAY_URL}/.netlify/functions/${service}-refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: token.refresh_token }),
    });

    const newTokens = await response.json();

    if (newTokens.error) {
      console.error(`[${service}] Token refresh failed:`, newTokens.error);
      tokenManager.clearToken(service);
      return null;
    }

    // Save new tokens
    tokenManager.setToken(service, {
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || token.refresh_token,
      expiresAt: Date.now() + (newTokens.expires_in * 1000),
    });

    return newTokens.access_token;
  } catch (err) {
    console.error(`[${service}] Token refresh error:`, err);
    return null;
  }
}

// OAuth login flow
export function startOAuthFlow(service) {
  return new Promise((resolve, reject) => {
    const popup = window.open(
      `${OAUTH_RELAY_URL}/.netlify/functions/${service}-auth`,
      `${service}-auth`,
      'width=600,height=700'
    );

    if (!popup) {
      reject(new Error('Popup blocked. Please allow popups for this site.'));
      return;
    }

    const messageHandler = (event) => {
      // Verify origin
      if (event.origin !== OAUTH_RELAY_URL) return;

      // Check for our callback type
      const expectedType = `${service}-oauth-callback`;
      if (event.data?.type !== expectedType) return;

      window.removeEventListener('message', messageHandler);
      clearInterval(checkClosed);

      if (event.data.error) {
        reject(new Error(event.data.error));
        return;
      }

      const { access_token, refresh_token, expires_in } = event.data;

      tokenManager.setToken(service, {
        access_token,
        refresh_token,
        expiresAt: Date.now() + (expires_in * 1000),
      });

      // Fetch and cache user info after Airtable authentication
      if (service === 'airtable') {
        fetchAirtableUserInfo(access_token).then((userInfo) => {
          if (userInfo) {
            userManager.setUserInfo(userInfo);
          }
        });
      }

      resolve({ access_token, refresh_token });
    };

    window.addEventListener('message', messageHandler);

    // Check if popup was closed without completing
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', messageHandler);
        reject(new Error('Authentication cancelled'));
      }
    }, 500);
  });
}

// Disconnect a service
export function disconnectService(service) {
  tokenManager.clearToken(service);
}

// Check connection status for all services
export function getConnectionStatus() {
  return {
    airtable: tokenManager.isTokenValid('airtable'),
    asana: tokenManager.isTokenValid('asana'),
    google: tokenManager.isTokenValid('google'),
  };
}

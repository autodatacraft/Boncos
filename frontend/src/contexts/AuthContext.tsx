import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { storage } from '@/src/utils/storage';
import { apiFetch } from '@/src/utils/api';

type User = {
  user_id: string;
  email: string;
  name: string;
  picture: string;
} | null;

type AuthContextType = {
  user: User;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  token: string | null;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  token: null,
});

export const useAuth = () => useContext(AuthContext);

const TOKEN_KEY = 'boncos_session_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Process session_id from URL
  const processSessionId = async (sessionId: string) => {
    try {
      const data = await apiFetch('/auth/session', {
        method: 'POST',
        body: { session_id: sessionId },
      });
      if (data.session_token) {
        if (Platform.OS === 'web') {
          await storage.setItem(TOKEN_KEY, data.session_token);
        } else {
          await storage.secureSet(TOKEN_KEY, data.session_token);
        }
        setToken(data.session_token);
        setUser({
          user_id: data.user_id,
          email: data.email,
          name: data.name,
          picture: data.picture,
        });
      }
    } catch (e) {
      console.error('Error processing session:', e);
    }
  };

  // Check existing session
  const checkSession = async () => {
    try {
      let storedToken: string | null;
      if (Platform.OS === 'web') {
        storedToken = await storage.getItem(TOKEN_KEY, '');
      } else {
        storedToken = await storage.secureGet(TOKEN_KEY, '');
      }
      if (storedToken) {
        const data = await apiFetch('/auth/me', { token: storedToken });
        if (data.user_id) {
          setToken(storedToken);
          setUser(data);
          return;
        }
        // Token invalid, clear it
        if (Platform.OS === 'web') {
          await storage.removeItem(TOKEN_KEY);
        } else {
          await storage.secureRemove(TOKEN_KEY);
        }
      }
    } catch (e) {
      console.error('Error checking session:', e);
    }
  };

  // Handle web redirect
  useEffect(() => {
    const init = async () => {
      if (Platform.OS === 'web') {
        const hash = window.location.hash;
        const search = window.location.search;
        let sessionId = '';
        if (hash.includes('session_id=')) {
          sessionId = hash.split('session_id=')[1]?.split('&')[0] || '';
        } else if (search.includes('session_id=')) {
          sessionId = search.split('session_id=')[1]?.split('&')[0] || '';
        }
        if (sessionId) {
          window.history.replaceState(null, '', window.location.pathname);
          await processSessionId(sessionId);
          setLoading(false);
          return;
        }
      }
      await checkSession();
      setLoading(false);
    };
    init();
  }, []);

  // Handle mobile deep link on cold start
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const checkInitialUrl = async () => {
      const url = await Linking.getInitialURL();
      if (url) {
        const sessionId = extractSessionId(url);
        if (sessionId) await processSessionId(sessionId);
      }
    };
    checkInitialUrl();

    const sub = Linking.addEventListener('url', (event) => {
      const sessionId = extractSessionId(event.url);
      if (sessionId) processSessionId(sessionId);
    });
    return () => sub.remove();
  }, []);

  const extractSessionId = (url: string): string | null => {
    const match = url.match(/session_id=([^&]+)/);
    return match ? match[1] : null;
  };

  const login = async () => {
    const redirectUrl =
      Platform.OS === 'web'
        ? window.location.origin + '/'
        : Linking.createURL('auth');

    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === 'web') {
      window.location.href = authUrl;
    } else {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === 'success' && result.url) {
        const sessionId = extractSessionId(result.url);
        if (sessionId) await processSessionId(sessionId);
      }
    }
  };

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST', token });
    } catch (e) {
      // ignore
    }
    if (Platform.OS === 'web') {
      await storage.removeItem(TOKEN_KEY);
    } else {
      await storage.secureRemove(TOKEN_KEY);
    }
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, token }}>
      {children}
    </AuthContext.Provider>
  );
}

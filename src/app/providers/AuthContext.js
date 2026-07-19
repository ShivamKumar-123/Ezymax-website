import React, { createContext, useState, useEffect, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../../constants';
import { toMessage } from '../../utils/errorMessage';
import logger from '../../utils/logger';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync('token');
      const storedUser = await SecureStore.getItemAsync('user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      logger.error('Error loading auth:', error);
    }
    setLoading(false);
  };

  const login = async (email, password, totpCode = null) => {
    try {
      // Normalise email so login always matches how the account was registered
      // (the backend stores it lower-cased; a stray capital broke login).
      email = (email || '').trim().toLowerCase();
      const body = { email, password };
      if (totpCode) body.totp_code = totpCode;
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      // Backend may signal 2FA via 200 OK with a flag OR via 401 + code.
      if (data?.twofa_required || data?.['2fa_required'] || data?.code === 'twofa_required') {
        return { success: false, twoFactorRequired: true, message: toMessage(data?.detail ?? data?.message, 'Two-factor authentication required') };
      }

      if (response.ok && data.access_token) {
        // TrustEdge backend returns access_token, user_id, role, expires_at
        const userInfo = {
          id: data.user_id,
          email: email,
          role: data.role,
          expires_at: data.expires_at
        };

        await SecureStore.setItemAsync('token', data.access_token);
        await SecureStore.setItemAsync('user', JSON.stringify(userInfo));
        // Persist credentials for silent token refresh on expiry.
        await SecureStore.setItemAsync('savedEmail', email);
        await SecureStore.setItemAsync('savedPassword', password);
        setToken(data.access_token);
        setUser(userInfo);
        return { success: true };
      } else {
        return { success: false, message: toMessage(data.detail ?? data.message, 'Login failed') };
      }
    } catch (error) {
      logger.error('Login error:', error);
      return { success: false, message: 'Network error' };
    }
  };

  const signup = async (userData) => {
    try {
      // Normalise email the same way as login so the two always agree.
      const email = (userData?.email || '').trim().toLowerCase();
      const payload = { ...userData, email };
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.access_token) {
        // TrustEdge backend returns access_token, user_id, role, expires_at
        const userInfo = {
          id: data.user_id,
          email,
          role: data.role,
          expires_at: data.expires_at
        };

        await SecureStore.setItemAsync('token', data.access_token);
        await SecureStore.setItemAsync('user', JSON.stringify(userInfo));
        if (email && userData?.password) {
          await SecureStore.setItemAsync('savedEmail', email);
          await SecureStore.setItemAsync('savedPassword', userData.password);
        }
        setToken(data.access_token);
        setUser(userInfo);
        return { success: true };
      } else {
        return { success: false, message: toMessage(data.detail ?? data.message, 'Signup failed') };
      }
    } catch (error) {
      logger.error('Signup error:', error);
      return { success: false, message: 'Network error' };
    }
  };

  // --- OTP-based signup (register/start -> register/verify) ---

  const registerStart = async (userData) => {
    try {
      const email = (userData?.email || '').trim().toLowerCase();
      const payload = { ...userData, email };
      const response = await fetch(`${API_URL}/auth/register/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        return { success: true, message: data?.message || 'Verification code sent' };
      }
      return { success: false, message: toMessage(data?.detail ?? data?.message, 'Could not start signup') };
    } catch (error) {
      logger.error('register/start error:', error);
      return { success: false, message: 'Network error' };
    }
  };

  const registerVerify = async (email, otp, password) => {
    try {
      const e = (email || '').trim().toLowerCase();
      const response = await fetch(`${API_URL}/auth/register/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, otp: String(otp || '').trim() }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok && data?.access_token) {
        const userInfo = { id: data.user_id, email: e, role: data.role, expires_at: data.expires_at };
        await SecureStore.setItemAsync('token', data.access_token);
        await SecureStore.setItemAsync('user', JSON.stringify(userInfo));
        await SecureStore.setItemAsync('savedEmail', e);
        if (password) await SecureStore.setItemAsync('savedPassword', password);
        setToken(data.access_token);
        setUser(userInfo);
        return { success: true };
      }

      if (response.ok) {
        // Account verified but no token returned — log in with the credentials.
        if (password) return await login(e, password);
        return { success: true, needLogin: true };
      }

      return { success: false, message: toMessage(data?.detail ?? data?.message, 'Verification failed') };
    } catch (error) {
      logger.error('register/verify error:', error);
      return { success: false, message: 'Network error' };
    }
  };

  const registerResend = async (email) => {
    try {
      const e = (email || '').trim().toLowerCase();
      const response = await fetch(`${API_URL}/auth/register/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e }),
      });
      const data = await response.json().catch(() => ({}));
      return {
        success: response.ok,
        message: toMessage(data?.detail ?? data?.message, response.ok ? 'Code resent' : 'Could not resend code'),
      };
    } catch (error) {
      logger.error('register/resend error:', error);
      return { success: false, message: 'Network error' };
    }
  };

  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('user');
      await SecureStore.deleteItemAsync('savedEmail');
      await SecureStore.deleteItemAsync('savedPassword');
      setToken(null);
      setUser(null);
    } catch (error) {
      logger.error('Logout error:', error);
    }
  };

  const updateUser = async (updatedUser) => {
    try {
      await SecureStore.setItemAsync('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error) {
      logger.error('Update user error:', error);
    }
  };

  // Memoized on state only: every auth method above is state-free (reads
  // nothing but setters/constants — verified), so re-capturing identities on
  // state change is safe, and consumers stop re-rendering on unrelated
  // provider renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      signup,
      registerStart,
      registerVerify,
      registerResend,
      logout,
      updateUser,
    }),
    [user, token, loading],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

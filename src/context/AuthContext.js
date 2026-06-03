import React, { createContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config';

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
      console.error('Error loading auth:', error);
    }
    setLoading(false);
  };

  const login = async (email, password, totpCode = null) => {
    try {
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
        return { success: false, twoFactorRequired: true, message: data?.detail || data?.message || 'Two-factor authentication required' };
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
        return { success: false, message: data.detail || data.message || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Network error' };
    }
  };

  const signup = async (userData) => {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (response.ok && data.access_token) {
        // TrustEdge backend returns access_token, user_id, role, expires_at
        const userInfo = {
          id: data.user_id,
          email: userData.email,
          role: data.role,
          expires_at: data.expires_at
        };
        
        await SecureStore.setItemAsync('token', data.access_token);
        await SecureStore.setItemAsync('user', JSON.stringify(userInfo));
        if (userData?.email && userData?.password) {
          await SecureStore.setItemAsync('savedEmail', userData.email);
          await SecureStore.setItemAsync('savedPassword', userData.password);
        }
        setToken(data.access_token);
        setUser(userInfo);
        return { success: true };
      } else {
        return { success: false, message: data.detail || data.message || 'Signup failed' };
      }
    } catch (error) {
      console.error('Signup error:', error);
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
      console.error('Logout error:', error);
    }
  };

  const updateUser = async (updatedUser) => {
    try {
      await SecureStore.setItemAsync('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error) {
      console.error('Update user error:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        signup,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

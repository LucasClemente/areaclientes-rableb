import React, { createContext, useContext, useState, useEffect } from 'react'
import { api, isLocalhost } from '../api'

const DEV_BYPASS = 'dev-bypass'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('panel_token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    if (token === DEV_BYPASS) {
      try {
        const saved = localStorage.getItem('panel_user')
        if (saved) setUser(JSON.parse(saved))
        else setToken(null)
      } catch {
        setToken(null)
      }
      setLoading(false)
      return
    }
    api('me', {}, token)
      .then((data) => {
        if (data.ok && data.user) setUser(data.user)
        else setToken(null)
      })
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [token])

  const loginDevBypass = (email) => {
    const mail = email.trim().toLowerCase()
    const userData = {
      id: 1,
      email: mail,
      role: mail === 'info@rableb.com' ? 'super_admin' : 'user',
      name: mail.split('@')[0],
    }
    localStorage.setItem('panel_token', DEV_BYPASS)
    localStorage.setItem('panel_user', JSON.stringify(userData))
    setToken(DEV_BYPASS)
    setUser(userData)
  }

  const loginWithBypass = (email) => {
    return api('login-request', { email }).then((data) => {
      if (data.ok && data.bypass && data.token) {
        localStorage.setItem('panel_token', data.token)
        setToken(data.token)
        setUser(data.user)
        return { ok: true }
      }
      if (data.ok && !data.bypass) return { ok: true, needCode: true }
      throw new Error(data.error || 'Error al iniciar sesión')
    })
  }

  const requestCode = (email) => {
    return api('login-request', { email }).then((data) => {
      if (!data.ok) throw new Error(data.error || 'Error')
      return data
    })
  }

  const verifyCode = (email, code) => {
    return api('login-verify', { email, code }).then((data) => {
      if (data.ok && data.token) {
        localStorage.setItem('panel_token', data.token)
        setToken(data.token)
        setUser(data.user)
        return { ok: true }
      }
      throw new Error(data.error || 'Código inválido')
    })
  }

  const logout = () => {
    localStorage.removeItem('panel_token')
    localStorage.removeItem('panel_user')
    setToken(null)
    setUser(null)
  }

  const value = {
    user,
    token,
    loading,
    isSuperAdmin: user?.role === 'super_admin',
    isLocalhost: isLocalhost(),
    loginWithBypass,
    loginDevBypass,
    requestCode,
    verifyCode,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}

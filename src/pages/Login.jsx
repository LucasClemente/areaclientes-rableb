import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './Login.module.css'

export default function Login() {
  const { user, loading, isLocalhost, loginWithBypass, loginDevBypass, requestCode, verifyCode } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('email')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  if (user && !loading) return <Navigate to="/" replace />

  const handleSubmitEmail = async (e) => {
    e.preventDefault()
    setError('')
    const mail = email.trim().toLowerCase()
    if (!mail) {
      setError('Introduce tu correo electrónico')
      return
    }
    setSending(true)
    try {
      const result = await loginWithBypass(mail)
      if (result.ok && result.needCode) {
        setStep('code')
      } else if (result.ok) {
        navigate('/', { replace: true })
      }
    } catch (err) {
      if (isLocalhost) {
        loginDevBypass(mail)
        navigate('/', { replace: true })
      } else {
        setError(err.message || 'Error al iniciar sesión')
      }
    } finally {
      setSending(false)
    }
  }

  const handleRequestCode = async (e) => {
    e.preventDefault()
    setError('')
    setSending(true)
    try {
      await requestCode(email.trim().toLowerCase())
      setStep('code')
    } catch (err) {
      setError(err.message || 'Error al enviar el código')
    } finally {
      setSending(false)
    }
  }

  const handleVerifyCode = async (e) => {
    e.preventDefault()
    setError('')
    if (!code.trim()) {
      setError('Introduce el código')
      return
    }
    setSending(true)
    try {
      await verifyCode(email.trim().toLowerCase(), code.trim())
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Código inválido o expirado')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.card}>Cargando…</div>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Área de clientes</h1>
          <p className={styles.subtitle}>Rableb</p>
        </div>

        {isLocalhost && (
          <p className={styles.bypassNotice}>
            Modo local: ingresa tu correo y entra sin código.
          </p>
        )}

        {step === 'email' && (
          <form onSubmit={handleSubmitEmail} className={styles.form}>
            <label className={styles.label}>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="tu@email.com"
              autoComplete="email"
              autoFocus
            />
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.button} disabled={sending}>
              {sending ? 'Entrando…' : 'Continuar'}
            </button>
          </form>
        )}

        {step === 'code' && !isLocalhost && (
          <form onSubmit={handleVerifyCode} className={styles.form}>
            <p className={styles.codeInfo}>
              Hemos enviado un código a <strong>{email}</strong>. Tienes 10 minutos para ingresarlo.
            </p>
            <label className={styles.label}>Código</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={styles.input}
              placeholder="000000"
              maxLength={6}
              autoComplete="one-time-code"
              autoFocus
            />
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.button} disabled={sending}>
              {sending ? 'Verificando…' : 'Entrar'}
            </button>
            <button
              type="button"
              className={styles.linkButton}
              onClick={handleRequestCode}
              disabled={sending}
            >
              Reenviar código
            </button>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => { setStep('email'); setError(''); setCode(''); }}
            >
              Usar otro correo
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

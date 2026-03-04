import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const { isSuperAdmin } = useAuth()

  return (
    <div className={styles.dashboard}>
      <h2 className={styles.greeting}>Bienvenido al panel</h2>
      <p className={styles.subtitle}>¿Qué te gustaría hacer hoy?</p>

      <div className={styles.cards}>
        <Link to="/clientes" className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            </span>
            <h3 className={styles.cardTitle}>{isSuperAdmin ? 'Empresas' : 'Mis Informes'}</h3>
          </div>
          <p className={styles.cardDesc}>
            {isSuperAdmin ? 'Administrá empresas, clientes y subí informes PDF.' : 'Accedé a los informes de tus empresas vinculadas.'}
          </p>
          <span className={styles.cardAction}>Ver empresas →</span>
        </Link>
        {isSuperAdmin && (
          <Link to="/usuarios" className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              </span>
              <h3 className={styles.cardTitle}>Usuarios</h3>
            </div>
            <p className={styles.cardDesc}>Gestioná quién tiene acceso al panel, crea administradores o clientes.</p>
            <span className={styles.cardAction}>Gestionar usuarios →</span>
          </Link>
        )}
      </div>
    </div>
  )
}

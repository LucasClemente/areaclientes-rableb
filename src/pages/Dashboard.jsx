import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const { isSuperAdmin } = useAuth()

  return (
    <div className={styles.dashboard}>
      <div className={styles.cards}>
        <Link to="/clientes" className={styles.card}>
          <span className={styles.cardIcon}>◧</span>
          <div>
            <h3 className={styles.cardTitle}>Clientes</h3>
            <p className={styles.cardDesc}>
              {isSuperAdmin ? 'Administrá clientes y subí informes PDF.' : 'Accedé a tus informes y reportes.'}
            </p>
          </div>
        </Link>
        {isSuperAdmin && (
          <Link to="/usuarios" className={styles.card}>
            <span className={styles.cardIcon}>◉</span>
            <div>
              <h3 className={styles.cardTitle}>Usuarios</h3>
              <p className={styles.cardDesc}>Gestioná quién tiene acceso al panel.</p>
            </div>
          </Link>
        )}
      </div>
    </div>
  )
}

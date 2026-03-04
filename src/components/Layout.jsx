import React from 'react'
import { NavLink, useNavigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './Layout.module.css'

const LOGO_URL = 'https://rableb.com/images/logo-principal-rableb-black_1765025803.webp'

const PAGE_TITLES = {
  '/': 'Inicio',
  '/clientes': 'Empresas',
  '/usuarios': 'Usuarios',
}

export default function Layout() {
  const { user, logout, isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const title = Object.entries(PAGE_TITLES)
    .reverse()
    .find(([path]) => pathname.startsWith(path))?.[1] ?? 'Panel'

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img src={LOGO_URL} alt="Rableb" className={styles.logo} />
          <span className={styles.brandSub}>Área de clientes</span>
        </div>

        <nav className={styles.nav}>
          <NavLink to="/" end className={({ isActive }) => isActive ? styles.navActive : styles.navLink}>
            Inicio
          </NavLink>
          <NavLink to="/clientes" className={({ isActive }) => isActive ? styles.navActive : styles.navLink}>
            Empresas
          </NavLink>
          {isSuperAdmin && (
            <NavLink to="/usuarios" className={({ isActive }) => isActive ? styles.navActive : styles.navLink}>
              Usuarios
            </NavLink>
          )}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <span className={styles.userEmail}>{user?.email}</span>
            {isSuperAdmin && <span className={styles.badge}>Super admin</span>}
          </div>
          <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.pageTitle}>{title}</h1>
        </header>
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}

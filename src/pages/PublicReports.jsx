import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { api, downloadUrl, formatBytes, formatPeriod } from '../api'
import styles from './PublicReports.module.css'

export default function PublicReports() {
  const { slug } = useParams()
  const [client, setClient] = useState(null)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api('clients-get', { slug }),
      api('reports-list', { slug }),
    ])
      .then(([cl, rp]) => {
        if (!cl.ok) { setError('Cliente no encontrado'); return }
        setClient(cl.client)
        if (rp.ok) setReports(rp.reports)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [slug])

  const grouped = reports.reduce((acc, r) => {
    if (!acc[r.period_date]) acc[r.period_date] = []
    acc[r.period_date].push(r)
    return acc
  }, {})
  const periods = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <p className={styles.loading}>Cargando informes…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.errorCard}>
            <h2>No encontrado</h2>
            <p>{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <img
            src="https://rableb.com/images/logo-principal-rableb-black_1765025803.webp"
            alt="Rableb"
            className={styles.logo}
          />
          <h1 className={styles.clientName}>{client.name}</h1>
          <p className={styles.subtitle}>Informes y reportes</p>
        </header>

        <main>
          {reports.length === 0 ? (
            <div className={styles.empty}>
              <p>Todavía no hay informes disponibles.</p>
            </div>
          ) : (
            periods.map(period => (
              <div key={period} className={styles.periodGroup}>
                <h2 className={styles.periodLabel}>{formatPeriod(period)}</h2>
                <div className={styles.reportList}>
                  {grouped[period].map(rep => (
                    <PublicReportRow key={rep.id} rep={rep} slug={slug} />
                  ))}
                </div>
              </div>
            ))
          )}
        </main>

        <footer className={styles.footer}>
          <a href="https://rableb.com" target="_blank" rel="noopener noreferrer">
            Powered by Rableb
          </a>
        </footer>
      </div>
    </div>
  )
}

function PublicReportRow({ rep, slug }) {
  const url = downloadUrl(rep.id, { slug })

  return (
    <div className={styles.reportRow}>
      <div className={styles.reportIcon}>PDF</div>
      <div className={styles.reportInfo}>
        <span className={styles.reportTitle}>{rep.title}</span>
        <span className={styles.reportMeta}>
          {rep.original_name} · {formatBytes(rep.file_size)}
        </span>
      </div>
      {url ? (
        <a href={url} className={styles.btnDownload} download>
          ↓ Descargar
        </a>
      ) : (
        <span className={styles.unavailable}>No disponible</span>
      )}
    </div>
  )
}

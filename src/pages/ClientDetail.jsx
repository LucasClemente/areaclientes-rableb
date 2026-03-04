import React, { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api, apiUpload, downloadUrl, formatBytes, formatPeriod } from '../api'
import styles from './ClientDetail.module.css'

export default function ClientDetail() {
  const { id } = useParams()
  const clientId = Number(id)
  const { token, isSuperAdmin, user } = useAuth()
  const navigate = useNavigate()

  const [client, setClient] = useState(null)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Form de subida
  const [showUpload, setShowUpload] = useState(false)
  const [uploadForm, setUploadForm] = useState({ title: '', period_date: '' })
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const fileRef = useRef()

  // Usuarios vinculados
  const [linkedUsers, setLinkedUsers] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [showUsersPanel, setShowUsersPanel] = useState(true)
  const [addingUserId, setAddingUserId] = useState('')
  const [userError, setUserError] = useState('')

  // Edición nombre
  const [editName, setEditName] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', notes: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  const loadReports = () =>
    api('reports-list', { client_id: clientId }, token)
      .then(d => { if (d.ok) setReports(d.reports) })
      .catch(() => {})

  useEffect(() => {
    Promise.all([
      api('clients-list', {}, token),
      api('reports-list', { client_id: clientId }, token),
    ])
      .then(([cl, rp]) => {
        const found = cl.ok ? cl.clients.find(c => c.id === clientId) : null
        if (!found) { setError('Cliente no encontrado'); return }
        setClient(found)
        setEditForm({ name: found.name, notes: found.notes || '' })
        if (rp.ok) setReports(rp.reports)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [clientId, token])

  const loadLinkedUsers = () => {
    Promise.all([
      api('client-users-list', { client_id: clientId }, token),
      api('users-list', {}, token),
    ]).then(([lu, au]) => {
      if (lu.ok) setLinkedUsers(lu.users)
      if (au.ok) setAllUsers(au.users)
    }).catch(() => {})
  }

  useEffect(() => {
    if (isSuperAdmin) loadLinkedUsers()
  }, [clientId, token, isSuperAdmin])

  /* ─── Upload ── */
  const handleUpload = async (e) => {
    e.preventDefault()
    setUploadError('')
    setUploadSuccess('')
    if (!uploadForm.title.trim()) { setUploadError('Título requerido'); return }
    if (!uploadForm.period_date) { setUploadError('Período requerido'); return }
    if (!file) { setUploadError('Seleccioná un archivo PDF'); return }
    if (!file.name.toLowerCase().endsWith('.pdf')) { setUploadError('Solo se permiten archivos PDF'); return }

    setUploading(true)
    const fd = new FormData()
    fd.append('action', 'report-upload')
    fd.append('client_id', clientId)
    fd.append('title', uploadForm.title)
    fd.append('period_date', uploadForm.period_date)
    fd.append('file', file)

    try {
      const d = await apiUpload(fd, token)
      if (d.ok) {
        setUploadSuccess('Informe subido correctamente.')
        setUploadForm({ title: '', period_date: '' })
        setFile(null)
        if (fileRef.current) fileRef.current.value = ''
        setShowUpload(false)
        loadReports()
      }
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (rep) => {
    if (!window.confirm(`¿Eliminar "${rep.title}"?`)) return
    try {
      await api('report-delete', { id: rep.id }, token)
      setReports(prev => prev.filter(r => r.id !== rep.id))
    } catch (err) {
      alert(err.message)
    }
  }

  /* ─── Users ── */
  const handleAddUser = async () => {
    if (!addingUserId) return
    setUserError('')
    try {
      await api('client-users-add', { client_id: clientId, user_id: Number(addingUserId) }, token)
      setAddingUserId('')
      loadLinkedUsers()
    } catch (err) { setUserError(err.message) }
  }

  const handleRemoveUser = async (uid) => {
    try {
      await api('client-users-remove', { client_id: clientId, user_id: uid }, token)
      loadLinkedUsers()
    } catch (err) { alert(err.message) }
  }

  /* ─── Edit ── */
  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editForm.name.trim()) return
    setSavingEdit(true)
    try {
      await api('clients-update', { id: clientId, ...editForm }, token)
      setClient(prev => ({ ...prev, name: editForm.name, notes: editForm.notes }))
      setEditName(false)
    } catch (err) { alert(err.message) }
    finally { setSavingEdit(false) }
  }

  const publicUrl = client
    ? `${window.location.origin}/p/${client.slug}`
    : ''

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(publicUrl) }
    catch { prompt('Copia el enlace:', publicUrl) }
  }

  /* ─── Group reports by period ── */
  const grouped = reports.reduce((acc, r) => {
    const key = r.period_date || 'sin-periodo'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})
  const periods = Object.keys(grouped).sort((a, b) => (a === 'sin-periodo' ? 1 : b === 'sin-periodo' ? -1 : b.localeCompare(a)))

  const unavailableUsers = linkedUsers.map(u => u.id)
  const availableUsers = allUsers.filter(u => u.role !== 'super_admin' && !unavailableUsers.includes(u.id))

  if (loading) return <p className={styles.msg}>Cargando…</p>
  if (error) return (
    <div>
      <p className={styles.errorMsg}>{error}</p>
      <Link to="/clientes" className={styles.back}>← Volver a empresas</Link>
    </div>
  )

  return (
    <div className={styles.wrapper}>
      {/* ─ Header del cliente ─ */}
      <div className={styles.clientHeader}>
        <Link to="/clientes" className={styles.back}>← Empresas</Link>
        {!editName ? (
          <div className={styles.clientTitleRow}>
            <h2 className={styles.clientTitle}>{client.name}</h2>
            {isSuperAdmin && (
              <button className={styles.btnGhost} onClick={() => setEditName(true)}>Editar</button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSaveEdit} className={styles.editForm}>
            <input className={styles.input} value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} placeholder="Nombre" />
            <input className={styles.input} value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notas internas" />
            <button className={styles.btnPrimary} type="submit" disabled={savingEdit}>Guardar</button>
            <button className={styles.btnGhost} type="button" onClick={() => setEditName(false)}>Cancelar</button>
          </form>
        )}
        {client.notes && !editName && <p className={styles.clientNotes}>{client.notes}</p>}

        <div className={styles.publicLinkRow}>
          <span className={styles.publicLinkLabel}>Enlace público:</span>
          <code className={styles.publicLinkCode}>{publicUrl}</code>
          <button className={styles.btnCopy} onClick={copyLink}>Copiar</button>
        </div>
      </div>

      {/* ─ Sección usuarios vinculados ─ */}
      {isSuperAdmin && (
        <div className={styles.section}>
          <button
            className={styles.sectionToggle}
            onClick={() => setShowUsersPanel(v => !v)}
          >
            Clientes asignados a esta empresa {showUsersPanel ? '▲' : '▼'}
            <span className={styles.countBadge}>{linkedUsers.length}</span>
          </button>

          {showUsersPanel && (
            <div className={styles.usersPanel}>
              <p className={styles.msgSmall}>Los clientes asignados podrán ver y descargar los informes de esta empresa al entrar al panel (y por el enlace público).</p>
              {linkedUsers.length === 0 ? (
                <p className={styles.msgSmall}>Ninguno asignado todavía. Agregá usuarios debajo.</p>
              ) : (
                <div className={styles.userList}>
                  {linkedUsers.map(u => (
                    <div key={u.id} className={styles.userRow}>
                      <span className={styles.userEmail}>{u.email}</span>
                      <span className={styles.userName}>{u.name}</span>
                      <button className={styles.btnRemove} onClick={() => handleRemoveUser(u.id)}>Quitar</button>
                    </div>
                  ))}
                </div>
              )}
              {availableUsers.length > 0 && (
                <div className={styles.addUser}>
                  <select
                    className={styles.select}
                    value={addingUserId}
                    onChange={e => setAddingUserId(e.target.value)}
                  >
                    <option value="">— Asignar cliente a esta empresa —</option>
                    {availableUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.email} ({u.name})</option>
                    ))}
                  </select>
                  <button className={styles.btnPrimary} onClick={handleAddUser} disabled={!addingUserId}>
                    Asignar
                  </button>
                </div>
              )}
              {userError && <p className={styles.error}>{userError}</p>}
            </div>
          )}
        </div>
      )}

      {/* ─ Subir informe ─ */}
      {isSuperAdmin && (
        <div className={styles.section}>
          {!showUpload ? (
            <button className={styles.btnPrimary} onClick={() => { setShowUpload(true); setUploadError(''); setUploadSuccess('') }}>
              + Subir informe PDF
            </button>
          ) : (
            <form onSubmit={handleUpload} className={styles.uploadForm}>
              <h3 className={styles.formTitle}>Subir informe</h3>
              <div className={styles.uploadGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Título *</label>
                  <input
                    className={styles.input}
                    value={uploadForm.title}
                    onChange={e => setUploadForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="ej: Informe SEO"
                    autoFocus
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Mes y año del informe *</label>
                  <div className={styles.monthYearRow}>
                    <select
                      className={styles.select}
                      value={uploadForm.period_date ? uploadForm.period_date.split('-')[1] : ''}
                      onChange={e => {
                        const y = uploadForm.period_date ? uploadForm.period_date.split('-')[0] : new Date().getFullYear()
                        setUploadForm(p => ({ ...p, period_date: `${y}-${e.target.value}` }))
                      }}
                      required
                    >
                      <option value="">Mes</option>
                      {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                        <option key={m} value={m}>{['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][i]}</option>
                      ))}
                    </select>
                    <select
                      className={styles.select}
                      value={uploadForm.period_date ? uploadForm.period_date.split('-')[0] : ''}
                      onChange={e => {
                        const m = uploadForm.period_date ? uploadForm.period_date.split('-')[1] : '01'
                        setUploadForm(p => ({ ...p, period_date: `${e.target.value}-${m}` }))
                      }}
                      required
                    >
                      <option value="">Año</option>
                      {Array.from({ length: 2040 - 2023 + 1 }, (_, i) => 2023 + i).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Archivo PDF *</label>
                <label className={styles.fileLabel}>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className={styles.fileInput}
                    onChange={e => setFile(e.target.files[0] || null)}
                  />
                  <span className={styles.filePlaceholder}>
                    {file ? file.name : 'Seleccionar PDF… (se comprimirá automáticamente)'}
                  </span>
                </label>
              </div>

              {uploadError && <p className={styles.error}>{uploadError}</p>}
              {uploadSuccess && <p className={styles.success}>{uploadSuccess}</p>}

              <div className={styles.btnRow}>
                <button className={styles.btnPrimary} type="submit" disabled={uploading}>
                  {uploading ? 'Subiendo…' : 'Subir informe'}
                </button>
                <button className={styles.btnGhost} type="button" onClick={() => setShowUpload(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ─ Lista de informes ─ */}
      <div className={styles.reports}>
        <h3 className={styles.reportsTitle}>
          Informes
          <span className={styles.countBadge}>{reports.length}</span>
        </h3>

        {reports.length === 0 ? (
          <p className={styles.msgSmall}>
            {isSuperAdmin ? 'Todavía no hay informes. Subí el primero arriba.' : 'Todavía no hay informes disponibles.'}
          </p>
        ) : (
          periods.map(period => (
            <div key={period} className={styles.periodGroup}>
              <h4 className={styles.periodLabel}>{formatPeriod(period)}</h4>
              <div className={styles.reportList}>
                {grouped[period].map(rep => (
                  <ReportRow
                    key={rep.id}
                    rep={rep}
                    token={token}
                    isSuperAdmin={isSuperAdmin}
                    onDelete={() => handleDelete(rep)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function ReportRow({ rep, token, isSuperAdmin, onDelete }) {
  const url = downloadUrl(rep.id, { token })
  const isDev = token === 'dev-bypass'

  return (
    <div className={styles.reportRow}>
      <div className={styles.reportIcon}>PDF</div>
      <div className={styles.reportInfo}>
        <span className={styles.reportTitle}>{rep.title}</span>
        <span className={styles.reportMeta}>
          {rep.original_name} · {formatBytes(rep.file_size)}
          {rep.uploaded_by_name && ` · Subido por ${rep.uploaded_by_name}`}
        </span>
      </div>
      <div className={styles.reportActions}>
        {isDev ? (
          <span className={styles.devNote} title="Descarga disponible con servidor PHP">
            Descarga (PHP)
          </span>
        ) : (
          <a href={url} className={styles.btnDownload} download>
            ↓ Descargar
          </a>
        )}
        {isSuperAdmin && (
          <button className={styles.btnRemove} onClick={onDelete}>✕</button>
        )}
      </div>
    </div>
  )
}

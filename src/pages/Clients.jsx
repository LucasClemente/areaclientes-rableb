import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'
import styles from './Clients.module.css'

export default function Clients() {
  const { token, isSuperAdmin } = useAuth()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', notes: '', user_email: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [copied, setCopied] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [modalForm, setModalForm] = useState({ name: '', notes: '' })
  const [modalAssigned, setModalAssigned] = useState([])
  const [modalSaving, setModalSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  const load = () => {
    api('clients-list', {}, token)
      .then(d => { if (d.ok) setClients(d.clients); else setError(d.error || 'Error') })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [token])

  const publicUrl = (slug) =>
    `${window.location.origin}/p/${slug}`

  const copyLink = async (slug) => {
    try {
      await navigator.clipboard.writeText(publicUrl(slug))
      setCopied(slug)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      prompt('Copia este enlace:', publicUrl(slug))
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!form.name.trim()) { setFormError('El nombre es obligatorio'); return }
    setSaving(true)
    try {
      const d = await api('clients-create', form, token)
      if (d.ok) {
        setClients(prev => [...prev, d.client].sort((a, b) => a.name.localeCompare(b.name)))
        setForm({ name: '', notes: '', user_email: '' })
        setShowForm(false)
      }
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const openEditModal = (client) => {
    setEditModal(client)
    setModalForm({ name: client.name, notes: client.notes || '' })
    setModalError('')
    setModalAssigned([])
    if (isSuperAdmin) {
      api('client-users-list', { client_id: client.id }, token)
        .then(d => { if (d.ok) setModalAssigned(d.users) })
        .catch(() => {})
    }
  }

  const handleModalSave = async (e) => {
    e.preventDefault()
    if (!editModal || !modalForm.name.trim()) return
    setModalSaving(true)
    setModalError('')
    try {
      await api('clients-update', { id: editModal.id, name: modalForm.name, notes: modalForm.notes }, token)
      setClients(prev => prev.map(c => c.id === editModal.id ? { ...c, name: modalForm.name, notes: modalForm.notes } : c))
      setEditModal(null)
    } catch (err) {
      setModalError(err.message)
    } finally {
      setModalSaving(false)
    }
  }

  const handleDelete = async (client) => {
    if (!window.confirm(`¿Eliminar "${client.name}"? Se borrarán todos sus informes.`)) return
    setDeleting(client.id)
    try {
      await api('clients-delete', { id: client.id }, token)
      setClients(prev => prev.filter(c => c.id !== client.id))
    } catch (err) {
      alert(err.message)
    } finally {
      setDeleting(null)
    }
  }

  if (loading) return <p className={styles.msg}>Cargando clientes…</p>

  return (
    <div className={styles.wrapper}>
      <p className={styles.intro}>
        Cada empresa tiene su propio enlace público para que tus clientes vean y descarguen informes sin entrar al panel.
      </p>

      {isSuperAdmin && (
        <div className={styles.toolbar}>
          <button
            className={styles.btnPrimary}
            onClick={() => { setShowForm(v => !v); setFormError('') }}
          >
            {showForm ? 'Cancelar' : '+ Nueva empresa'}
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className={styles.form}>
          <h3 className={styles.formTitle}>Nueva empresa</h3>
          <p className={styles.formHint}>Creá la cuenta (empresa/negocio). Opcionalmente asigná un usuario que tendrá acceso a sus informes.</p>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Nombre de la empresa *</label>
              <input
                className={styles.input}
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Mi Marca S.A."
                autoFocus
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Notas internas</label>
              <input
                className={styles.input}
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Email del responsable (opcional)</label>
            <input
              type="email"
              className={styles.input}
              value={form.user_email}
              onChange={e => setForm(p => ({ ...p, user_email: e.target.value }))}
              placeholder="Si existe, se vincula; si no, se crea el usuario"
            />
          </div>
          {formError && <p className={styles.error}>{formError}</p>}
          <button className={styles.btnPrimary} type="submit" disabled={saving}>
            {saving ? 'Creando…' : 'Crear empresa'}
          </button>
        </form>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {clients.length === 0 ? (
        <div className={styles.empty}>
          <p>Sin empresas todavía.</p>
          {isSuperAdmin && <p>Creá la primera con el botón de arriba.</p>}
        </div>
      ) : (
        <div className={styles.grid}>
          {clients.map(c => (
            <div key={c.id} className={styles.card}>
              <div className={styles.cardTop}>
                <Link to={`/clientes/${c.id}`} className={styles.clientName}>
                  {c.name}
                </Link>
                {c.notes && <p className={styles.clientNotes}>{c.notes}</p>}
              </div>
              <div className={styles.cardActions}>
                {isSuperAdmin && (
                  <button
                    type="button"
                    className={styles.btnEdit}
                    onClick={() => openEditModal(c)}
                    title="Ver detalle y editar"
                  >
                    Editar
                  </button>
                )}
                <button
                  className={styles.btnCopy}
                  onClick={() => copyLink(c.slug)}
                  title="Copiar enlace público"
                >
                  {copied === c.slug ? '✓ Copiado' : '⎘ Enlace público'}
                </button>
                <Link to={`/clientes/${c.id}`} className={styles.btnView}>
                  Ver informes →
                </Link>
                {isSuperAdmin && (
                  <button
                    className={styles.btnDanger}
                    onClick={() => handleDelete(c)}
                    disabled={deleting === c.id}
                    title="Eliminar empresa"
                  >
                    {deleting === c.id ? '…' : '✕'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editModal && (
        <div className={styles.modalOverlay} onClick={() => setEditModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Detalle de la empresa</h3>
              <button type="button" className={styles.modalClose} onClick={() => setEditModal(null)} aria-label="Cerrar">×</button>
            </div>
            <form onSubmit={handleModalSave}>
              <div className={styles.modalBody}>
                <div className={styles.field}>
                  <label className={styles.label}>Nombre</label>
                  <input
                    className={styles.input}
                    value={modalForm.name}
                    onChange={e => setModalForm(p => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Notas internas</label>
                  <input
                    className={styles.input}
                    value={modalForm.notes}
                    onChange={e => setModalForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Opcional"
                  />
                </div>
                <div className={styles.modalLinkRow}>
                  <span className={styles.label}>Enlace público</span>
                  <div className={styles.modalLinkWrap}>
                    <code className={styles.publicLinkCode}>{publicUrl(editModal.slug)}</code>
                    <button type="button" className={styles.btnCopy} onClick={() => copyLink(editModal.slug)}>
                      {copied === editModal.slug ? '✓ Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>
                <div className={styles.assignedBlock}>
                  <span className={styles.label}>Clientes asignados a esta empresa</span>
                  {modalAssigned.length === 0 ? (
                    <p className={styles.msgSmall}>Ninguno. Podés asignarlos entrando a &quot;Ver informes&quot;.</p>
                  ) : (
                    <ul className={styles.assignedListModal}>
                      {modalAssigned.map(u => (
                        <li key={u.id}>{u.email} {u.name && <span className={styles.assignedName}>({u.name})</span>}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className={styles.modalFooter}>
                <Link to={`/clientes/${editModal.id}`} className={styles.btnView} onClick={() => setEditModal(null)}>
                  Ver informes →
                </Link>
                <button type="submit" className={styles.btnPrimary} disabled={modalSaving}>
                  {modalSaving ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button type="button" className={styles.btnGhost} onClick={() => setEditModal(null)}>
                  Cerrar
                </button>
              </div>
              {modalError && <p className={styles.error}>{modalError}</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

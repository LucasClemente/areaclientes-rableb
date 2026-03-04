import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'
import styles from './Users.module.css'

export default function Users() {
  const { token } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', name: '', role: 'user' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({ email: '', name: '', role: 'user' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')
  const [userAssignedClients, setUserAssignedClients] = useState([])
  const [allClients, setAllClients] = useState([])
  const [addingClientId, setAddingClientId] = useState('')

  const load = () => {
    api('users-list', {}, token)
      .then(d => { if (d.ok) setUsers(d.users); else setError(d.error || 'Error') })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [token])

  const handleCreate = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!form.email.trim()) { setFormError('El email es obligatorio'); return }
    setSaving(true)
    try {
      const d = await api('users-create', form, token)
      if (d.ok) {
        setUsers(prev => [d.user, ...prev])
        setForm({ email: '', name: '', role: 'user' })
        setShowForm(false)
      }
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (u) => {
    setEditing(u.id)
    setEditForm({ email: u.email, name: u.name || '', role: u.role })
    setEditError('')
    setAddingClientId('')
    Promise.all([
      api('user-clients-list', { user_id: u.id }, token),
      api('clients-list', {}, token),
    ]).then(([uc, cl]) => {
      if (uc.ok) setUserAssignedClients(uc.clients || [])
      if (cl.ok) setAllClients(cl.clients || [])
    }).catch(() => { setUserAssignedClients([]); setAllClients([]) })
  }

  const assignUserToClient = async () => {
    if (!addingClientId || !editing) return
    try {
      await api('client-users-add', { client_id: Number(addingClientId), user_id: editing }, token)
      const res = await api('user-clients-list', { user_id: editing }, token)
      if (res.ok) setUserAssignedClients(res.clients || [])
      setAddingClientId('')
    } catch (e) { setEditError(e.message) }
  }

  const unassignUserFromClient = async (clientId) => {
    try {
      await api('client-users-remove', { client_id: clientId, user_id: editing }, token)
      setUserAssignedClients(prev => prev.filter(c => c.id !== clientId))
    } catch (e) { setEditError(e.message) }
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    setEditError('')
    setSavingEdit(true)
    try {
      await api('users-update', { id: editing, ...editForm }, token)
      setUsers(prev => prev.map(u => u.id === editing ? { ...u, ...editForm } : u))
      setEditing(null)
      setUserAssignedClients([])
    } catch (err) {
      setEditError(err.message)
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async (u) => {
    if (!window.confirm(`¿Eliminar al usuario "${u.email}"?`)) return
    setDeleting(u.id)
    try {
      await api('users-delete', { id: u.id }, token)
      setUsers(prev => prev.filter(x => x.id !== u.id))
    } catch (err) {
      alert(err.message)
    } finally {
      setDeleting(null)
    }
  }

  if (loading) return <p className={styles.msg}>Cargando usuarios…</p>

  return (
    <div className={styles.wrapper}>
      <div className={styles.permissionsInfo}>
        <strong>Permisos por rol</strong>
        <ul>
          <li><strong>Super admin:</strong> acceso total al panel (gestión de empresas, informes y usuarios). Ve todas las empresas y puede asignar clientes a cada una.</li>
          <li><strong>Cliente:</strong> solo ve las empresas que le hayas asignado. Puede entrar al panel y descargar los informes de esas empresas; también puede usar el enlace público de cada empresa sin iniciar sesión.</li>
        </ul>
      </div>

      <div className={styles.toolbar}>
        <button
          className={styles.btnPrimary}
          onClick={() => { setShowForm(v => !v); setFormError('') }}
        >
          {showForm ? 'Cancelar' : '+ Nuevo usuario'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className={styles.form}>
          <h3 className={styles.formTitle}>Nuevo usuario</h3>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Email *</label>
              <input
                type="email"
                className={styles.input}
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="correo@cliente.com"
                autoFocus
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Nombre</label>
              <input
                className={styles.input}
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Nombre y apellido"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Rol</label>
              <select
                className={styles.select}
                value={form.role}
                onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              >
                <option value="user">Cliente</option>
                <option value="super_admin">Super admin</option>
              </select>
            </div>
          </div>
          {formError && <p className={styles.error}>{formError}</p>}
          <button className={styles.btnPrimary} type="submit" disabled={saving}>
            {saving ? 'Creando…' : 'Crear usuario'}
          </button>
        </form>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {users.length === 0 ? (
        <p className={styles.msg}>Sin usuarios.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Registro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  {editing === u.id ? (
                    <td colSpan={5}>
                      <form onSubmit={handleEdit} className={styles.editForm}>
                        <div className={styles.editRow}>
                          <input
                            type="email"
                            className={styles.input}
                            value={editForm.email}
                            onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                            placeholder="Email"
                            required
                          />
                          <input
                            className={styles.input}
                            value={editForm.name}
                            onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                            placeholder="Nombre"
                          />
                          <select
                            className={styles.select}
                            value={editForm.role}
                            onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}
                          >
                            <option value="user">Cliente</option>
                            <option value="super_admin">Super admin</option>
                          </select>
                          <button type="submit" className={styles.btnPrimary} disabled={savingEdit}>
                            {savingEdit ? '…' : 'Guardar'}
                          </button>
                          <button type="button" className={styles.btnGhost} onClick={() => { setEditing(null); setUserAssignedClients([]) }}>
                            Cancelar
                          </button>
                        </div>
                        {editForm.role === 'user' && (
                          <div className={styles.assignedSection}>
                            <div className={styles.assignedLabel}>Empresas asignadas</div>
                            {userAssignedClients.length === 0 ? (
                              <p className={styles.msgSmall}>Ninguna. Este cliente solo verá las empresas que asignes aquí o desde cada empresa.</p>
                            ) : (
                              <div className={styles.assignedList}>
                                {userAssignedClients.map(c => (
                                  <span key={c.id} className={styles.assignedChip}>
                                    {c.name}
                                    <button type="button" className={styles.chipRemove} onClick={() => unassignUserFromClient(c.id)}>×</button>
                                  </span>
                                ))}
                              </div>
                            )}
                            {allClients.filter(c => !userAssignedClients.some(a => a.id === c.id)).length > 0 && (
                              <div className={styles.addAssign}>
                                <select
                                  className={styles.select}
                                  value={addingClientId}
                                  onChange={e => setAddingClientId(e.target.value)}
                                >
                                  <option value="">— Agregar a empresa —</option>
                                  {allClients.filter(c => !userAssignedClients.some(a => a.id === c.id)).map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                                </select>
                                <button type="button" className={styles.btnPrimary} onClick={assignUserToClient} disabled={!addingClientId}>
                                  Asignar
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        {editError && <span className={styles.error}>{editError}</span>}
                      </form>
                    </td>
                  ) : (
                    <>
                      <td>{u.email}</td>
                      <td>{u.name || '—'}</td>
                      <td>
                        <span className={u.role === 'super_admin' ? styles.badgeAdmin : styles.badgeUser}>
                          {u.role === 'super_admin' ? 'Super admin' : 'Cliente'}
                        </span>
                      </td>
                      <td className={styles.dateCell}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('es-AR') : '—'}
                      </td>
                      <td className={styles.actionsCell}>
                        <button className={styles.btnEdit} onClick={() => openEdit(u)} title="Editar">
                          Editar
                        </button>
                        {u.email !== 'info@rableb.com' && (
                          <button
                            className={styles.btnDanger}
                            onClick={() => handleDelete(u)}
                            disabled={deleting === u.id}
                          >
                            {deleting === u.id ? '…' : 'Eliminar'}
                          </button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

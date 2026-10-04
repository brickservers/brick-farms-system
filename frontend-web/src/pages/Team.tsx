import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { createTeamUser, deactivateTeamUser, listTeamUsers, TeamRole, updateTeamUser } from '../api/farm'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../contexts/AuthContext'

const teamRoles: TeamRole[] = ['admin', 'agronomist', 'field_worker', 'accountant', 'investor', 'auditor', 'gov_viewer']

const roleLabels: Record<TeamRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  agronomist: 'Agronomist',
  field_worker: 'Field worker',
  accountant: 'Accountant',
  investor: 'Investor',
  auditor: 'Auditor',
  gov_viewer: 'Government viewer',
}

export default function TeamPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [form, setForm] = useState({ email: '', password: '', role: 'field_worker' as TeamRole })
  const [message, setMessage] = useState<string | null>(null)
  const teamQuery = useQuery({ queryKey: ['team-users'], queryFn: listTeamUsers })
  const team = teamQuery.data || []

  const stats = useMemo(() => ({
    active: team.filter(item => item.is_active).length,
    admins: team.filter(item => item.role === 'owner' || item.role === 'admin').length,
    viewers: team.filter(item => item.role === 'investor' || item.role === 'auditor' || item.role === 'gov_viewer').length,
  }), [team])

  const createMutation = useMutation({
    mutationFn: () => {
      if (!form.email.trim()) throw new Error('Email is required.')
      if (!form.password.trim()) throw new Error('Password is required.')
      return createTeamUser({ email: form.email.trim(), password: form.password, role: form.role })
    },
    onSuccess: async () => {
      setMessage('Team user created.')
      setForm({ email: '', password: '', role: 'field_worker' })
      await queryClient.invalidateQueries({ queryKey: ['team-users'] })
    },
    onError: error => setMessage(error instanceof Error ? error.message : 'Could not create team user.'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, role, is_active }: { id: string; role?: TeamRole; is_active?: boolean }) => updateTeamUser(id, { role, is_active }),
    onSuccess: async () => {
      setMessage('Team user updated.')
      await queryClient.invalidateQueries({ queryKey: ['team-users'] })
    },
    onError: error => setMessage(error instanceof Error ? error.message : 'Could not update team user.'),
  })

  const deactivateMutation = useMutation({
    mutationFn: deactivateTeamUser,
    onSuccess: async () => {
      setMessage('Team user deactivated.')
      await queryClient.invalidateQueries({ queryKey: ['team-users'] })
    },
    onError: error => setMessage(error instanceof Error ? error.message : 'Could not deactivate team user.'),
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    createMutation.mutate()
  }

  return (
    <div className="page-stack">
      <PageHeader title="Team access" description="Create login users for this tenant and control who can manage operations, finance, reports, and viewer access." />

      <section className="stat-grid team-stat-grid">
        <div className="stat-tile stat-green"><span>Active users</span><strong>{stats.active}</strong><small>Can log in</small></div>
        <div className="stat-tile stat-brown"><span>Admins</span><strong>{stats.admins}</strong><small>Manage workspace</small></div>
        <div className="stat-tile stat-ink"><span>Viewers</span><strong>{stats.viewers}</strong><small>Investor and audit access</small></div>
        <div className="stat-tile stat-white"><span>Total users</span><strong>{team.length}</strong><small>Tenant accounts</small></div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Add user</h2>
          <span>Owner and admin only</span>
        </div>
        <form className="entity-form team-form" onSubmit={submit}>
          <label><span>Email</span><input value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} placeholder="team@example.com" /></label>
          <label><span>Temporary password</span><input type="password" value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} placeholder="Minimum 6 characters" /></label>
          <label><span>Role</span><select value={form.role} onChange={event => setForm(current => ({ ...current, role: event.target.value as TeamRole }))}>{teamRoles.map(role => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label>
          <button className="primary-action" type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create user'}</button>
        </form>
        {message ? <div className="form-note">{message}</div> : null}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Tenant users</h2>
          <span>{teamQuery.isFetching ? 'Refreshing...' : `${team.length} records`}</span>
        </div>
        <div className="team-list">
          {team.map(item => (
            <article className="team-row" key={item.id}>
              <div>
                <strong>{item.email}</strong>
                <span>{item.id === user?.sub ? 'Current session' : item.is_active ? 'Active account' : 'Deactivated'}</span>
              </div>
              <label><span>Role</span><select value={item.role} disabled={item.role === 'owner'} onChange={event => updateMutation.mutate({ id: item.id, role: event.target.value as TeamRole })}>
                {(['owner', ...teamRoles] as TeamRole[]).map(role => <option key={role} value={role}>{roleLabels[role]}</option>)}
              </select></label>
              <div><small>Status</small><span className={`status-chip ${item.is_active ? 'status-active' : 'status-inactive'}`}>{item.is_active ? 'Active' : 'Inactive'}</span></div>
              <div className="row-actions">
                {!item.is_active ? (
                  <button className="secondary-action" type="button" onClick={() => updateMutation.mutate({ id: item.id, is_active: true })}>Reactivate</button>
                ) : (
                  <button className="secondary-action" type="button" onClick={() => deactivateMutation.mutate(item.id)} disabled={item.id === user?.sub || item.role === 'owner' || deactivateMutation.isPending}>Deactivate</button>
                )}
              </div>
            </article>
          ))}
          {team.length === 0 ? <p className="empty-state">No team users found yet.</p> : null}
        </div>
      </section>
    </div>
  )
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { createTask, createTeamUser, createWorker, deactivateTeamUser, deactivateWorker, FarmWorkerPayload, listFarms, listTeamUsers, listWorkers, TeamRole, updateTeamUser, updateWorker, WorkerStatus } from '../api/farm'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../contexts/AuthContext'

const workerStatuses: Array<WorkerStatus | 'all'> = ['all', 'active', 'on_leave', 'inactive']
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

const emptyForm = {
  full_name: '',
  role: 'field_worker',
  farm_id: '',
  phone: '',
  email: '',
  status: 'active' as WorkerStatus,
  hourly_rate: '',
  currency: 'NGN',
  hired_at: '',
  emergency_contact: '',
  skills: '',
  notes: '',
}

function toPayload(form: typeof emptyForm): FarmWorkerPayload {
  return {
    full_name: form.full_name.trim(),
    role: form.role.trim() || 'field_worker',
    farm_id: form.farm_id || null,
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    status: form.status,
    hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
    currency: form.currency.trim().toUpperCase() || 'NGN',
    hired_at: form.hired_at || null,
    emergency_contact: form.emergency_contact.trim() || null,
    skills: form.skills.split(',').map(skill => skill.trim()).filter(Boolean),
    notes: form.notes.trim() || null,
  }
}

export default function WorkersPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [status, setStatus] = useState<WorkerStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [taskForm, setTaskForm] = useState({ title: '', due_at: '' })
  const [teamForm, setTeamForm] = useState({ email: '', password: '', role: 'field_worker' as TeamRole })
  const [message, setMessage] = useState<string | null>(null)

  const farmsQuery = useQuery({ queryKey: ['farms'], queryFn: listFarms })
  const workersQuery = useQuery({ queryKey: ['workers', status, search], queryFn: () => listWorkers({ status, search: search.trim() || undefined }) })
  const teamQuery = useQuery({ queryKey: ['team-users'], queryFn: listTeamUsers })
  const workers = workersQuery.data || []
  const team = teamQuery.data || []

  const stats = useMemo(() => ({
    active: workers.filter(worker => worker.status === 'active').length,
    onLeave: workers.filter(worker => worker.status === 'on_leave').length,
    openTasks: workers.reduce((total, worker) => total + Number(worker.open_tasks || 0), 0),
    teamUsers: team.filter(item => item.is_active).length,
  }), [team, workers])
  const selectedWorker = useMemo(() => workers.find(worker => worker.id === selectedWorkerId) || null, [selectedWorkerId, workers])

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = toPayload(form)
      if (!payload.full_name) throw new Error('Worker name is required.')
      return editingId ? updateWorker(editingId, payload) : createWorker(payload)
    },
    onSuccess: async () => {
      setMessage(editingId ? 'Worker updated.' : 'Worker created.')
      setEditingId(null)
      setForm(emptyForm)
      await queryClient.invalidateQueries({ queryKey: ['workers'] })
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: error => setMessage(error instanceof Error ? error.message : 'Could not save worker.'),
  })

  const deactivateMutation = useMutation({
    mutationFn: deactivateWorker,
    onSuccess: async () => {
      setMessage('Worker marked inactive.')
      await queryClient.invalidateQueries({ queryKey: ['workers'] })
    },
    onError: error => setMessage(error instanceof Error ? error.message : 'Could not deactivate worker.'),
  })

  const quickTaskMutation = useMutation({
    mutationFn: () => {
      if (!selectedWorker) throw new Error('Select a worker first.')
      if (!taskForm.title.trim()) throw new Error('Task title is required.')
      return createTask({
        title: taskForm.title.trim(),
        worker_id: selectedWorker.id,
        due_at: taskForm.due_at || undefined,
        meta: { source: 'workers_page', worker_name: selectedWorker.full_name },
      })
    },
    onSuccess: async () => {
      setMessage('Task assigned to worker.')
      setTaskForm({ title: '', due_at: '' })
      await queryClient.invalidateQueries({ queryKey: ['workers'] })
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: error => setMessage(error instanceof Error ? error.message : 'Could not assign task.'),
  })

  const createTeamMutation = useMutation({
    mutationFn: () => {
      if (!teamForm.email.trim()) throw new Error('Email is required.')
      if (!teamForm.password.trim()) throw new Error('Temporary password is required.')
      return createTeamUser({ email: teamForm.email.trim(), password: teamForm.password, role: teamForm.role })
    },
    onSuccess: async () => {
      setMessage('Workspace login user created.')
      setTeamForm({ email: '', password: '', role: 'field_worker' })
      await queryClient.invalidateQueries({ queryKey: ['team-users'] })
    },
    onError: error => setMessage(error instanceof Error ? error.message : 'Could not create workspace user.'),
  })

  const updateTeamMutation = useMutation({
    mutationFn: ({ id, role, is_active }: { id: string; role?: TeamRole; is_active?: boolean }) => updateTeamUser(id, { role, is_active }),
    onSuccess: async () => {
      setMessage('Workspace user updated.')
      await queryClient.invalidateQueries({ queryKey: ['team-users'] })
    },
    onError: error => setMessage(error instanceof Error ? error.message : 'Could not update workspace user.'),
  })

  const deactivateTeamMutation = useMutation({
    mutationFn: deactivateTeamUser,
    onSuccess: async () => {
      setMessage('Workspace user deactivated.')
      await queryClient.invalidateQueries({ queryKey: ['team-users'] })
    },
    onError: error => setMessage(error instanceof Error ? error.message : 'Could not deactivate workspace user.'),
  })

  function editWorker(workerId: string) {
    const worker = workers.find(item => item.id === workerId)
    if (!worker) return
    setEditingId(worker.id)
    setForm({
      full_name: worker.full_name,
      role: worker.role || 'field_worker',
      farm_id: worker.farm_id || '',
      phone: worker.phone || '',
      email: worker.email || '',
      status: worker.status,
      hourly_rate: worker.hourly_rate ? String(worker.hourly_rate) : '',
      currency: worker.currency || 'NGN',
      hired_at: worker.hired_at || '',
      emergency_contact: worker.emergency_contact || '',
      skills: (worker.skills || []).join(', '),
      notes: worker.notes || '',
    })
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    saveMutation.mutate()
  }

  function submitQuickTask(event: React.FormEvent) {
    event.preventDefault()
    quickTaskMutation.mutate()
  }

  function submitTeamUser(event: React.FormEvent) {
    event.preventDefault()
    createTeamMutation.mutate()
  }

  return (
    <div className="page-stack">
      <PageHeader title="Farm workers" description="Manage field teams, contact details, pay rates, farm assignments, and availability." />

      <section className="stat-grid worker-stat-grid">
        <div className="stat-tile stat-green"><span>Active workers</span><strong>{stats.active}</strong><small>Ready for assignment</small></div>
        <div className="stat-tile stat-brown"><span>On leave</span><strong>{stats.onLeave}</strong><small>Unavailable today</small></div>
        <div className="stat-tile stat-ink"><span>Open tasks</span><strong>{stats.openTasks}</strong><small>Assigned to workers</small></div>
        <div className="stat-tile stat-white"><span>Login users</span><strong>{stats.teamUsers}</strong><small>Workspace access</small></div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>{editingId ? 'Edit worker' : 'New worker'}</h2>
          <span>Profiles sync with task assignment</span>
        </div>
        <form className="entity-form worker-form" onSubmit={submit}>
          <label><span>Full name</span><input value={form.full_name} onChange={event => setForm(current => ({ ...current, full_name: event.target.value }))} placeholder="Amina Orseer" /></label>
          <label><span>Role</span><select value={form.role} onChange={event => setForm(current => ({ ...current, role: event.target.value }))}>{teamRoles.map(role => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label>
          <label><span>Farm</span><select value={form.farm_id} onChange={event => setForm(current => ({ ...current, farm_id: event.target.value }))}><option value="">Unassigned</option>{(farmsQuery.data || []).map(farm => <option value={farm.id} key={farm.id}>{farm.name}</option>)}</select></label>
          <label><span>Status</span><select value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value as WorkerStatus }))}><option value="active">Active</option><option value="on_leave">On leave</option><option value="inactive">Inactive</option></select></label>
          <label><span>Phone</span><input value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} placeholder="+234..." /></label>
          <label><span>Email</span><input value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} placeholder="worker@farm.ng" /></label>
          <label><span>Hourly rate</span><input value={form.hourly_rate} onChange={event => setForm(current => ({ ...current, hourly_rate: event.target.value }))} inputMode="decimal" placeholder="2500" /></label>
          <label><span>Currency</span><input value={form.currency} maxLength={3} onChange={event => setForm(current => ({ ...current, currency: event.target.value.toUpperCase() }))} placeholder="NGN" /></label>
          <label><span>Hired date</span><input type="date" value={form.hired_at} onChange={event => setForm(current => ({ ...current, hired_at: event.target.value }))} /></label>
          <label><span>Emergency contact</span><input value={form.emergency_contact} onChange={event => setForm(current => ({ ...current, emergency_contact: event.target.value }))} placeholder="Name and phone" /></label>
          <label className="wide-field"><span>Skills</span><input value={form.skills} onChange={event => setForm(current => ({ ...current, skills: event.target.value }))} placeholder="spraying, irrigation, harvesting" /></label>
          <label className="wide-field"><span>Notes</span><input value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} placeholder="Availability, certifications, payroll notes" /></label>
          <div className="form-actions">
            {editingId ? <button className="secondary-action" type="button" onClick={() => { setEditingId(null); setForm(emptyForm) }}>Cancel</button> : null}
            <button className="primary-action" type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : editingId ? 'Save worker' : 'Create worker'}</button>
          </div>
        </form>
        {message ? <div className="form-note">{message}</div> : null}
      </section>

      <section className="worker-directory-grid">
        <div className="panel">
          <div className="panel-heading">
            <h2>Worker directory</h2>
            <span>{workersQuery.isFetching ? 'Refreshing...' : `${workers.length} records`}</span>
          </div>
          <div className="worker-toolbar">
            <label><span>Status</span><select value={status} onChange={event => setStatus(event.target.value as WorkerStatus | 'all')}>{workerStatuses.map(item => <option value={item} key={item}>{item.replace('_', ' ')}</option>)}</select></label>
            <label><span>Search</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, role, or phone" /></label>
          </div>
          <div className="worker-list">
            {workers.map(worker => (
              <article className={`worker-row ${selectedWorkerId === worker.id ? 'selected' : ''}`} key={worker.id}>
                <div>
                  <strong>{worker.full_name}</strong>
                  <span>{worker.role.replace('_', ' ')}{worker.farm_name ? ` - ${worker.farm_name}` : ''}</span>
                </div>
                <div><small>Status</small><span className={`status-chip status-${worker.status}`}>{worker.status.replace('_', ' ')}</span></div>
                <div><small>Contact</small><span>{worker.phone || worker.email || 'Not recorded'}</span></div>
                <div><small>Rate</small><span>{worker.hourly_rate ? `${worker.currency} ${worker.hourly_rate.toLocaleString()}/hr` : 'Not set'}</span></div>
                <div><small>Tasks</small><span>{worker.open_tasks || 0} open</span></div>
                <div className="row-actions">
                  <button className="secondary-action" type="button" onClick={() => setSelectedWorkerId(worker.id)}>Details</button>
                  <button className="secondary-action" type="button" onClick={() => editWorker(worker.id)}>Edit</button>
                  <button className="secondary-action" type="button" onClick={() => deactivateMutation.mutate(worker.id)} disabled={worker.status === 'inactive' || deactivateMutation.isPending}>Deactivate</button>
                </div>
              </article>
            ))}
            {workers.length === 0 ? <p className="empty-state">No workers match this view yet.</p> : null}
          </div>
        </div>

        <aside className="panel worker-detail-panel">
          <div className="panel-heading">
            <h2>Assignment desk</h2>
            <span>{selectedWorker ? selectedWorker.status.replace('_', ' ') : 'Select worker'}</span>
          </div>
          {selectedWorker ? (
            <>
              <div className="worker-profile-card">
                <strong>{selectedWorker.full_name}</strong>
                <span>{selectedWorker.role.replace('_', ' ')}</span>
                <small>{selectedWorker.farm_name || 'No farm assigned'}</small>
              </div>
              <div className="worker-detail-list">
                <div><span>Contact</span><strong>{selectedWorker.phone || selectedWorker.email || 'Not recorded'}</strong></div>
                <div><span>Open tasks</span><strong>{selectedWorker.open_tasks || 0}</strong></div>
                <div><span>Pay rate</span><strong>{selectedWorker.hourly_rate ? `${selectedWorker.currency} ${selectedWorker.hourly_rate.toLocaleString()}/hr` : 'Not set'}</strong></div>
                <div><span>Skills</span><strong>{selectedWorker.skills?.length ? selectedWorker.skills.join(', ') : 'None recorded'}</strong></div>
              </div>
              <form className="quick-task-form" onSubmit={submitQuickTask}>
                <label><span>Task title</span><input value={taskForm.title} onChange={event => setTaskForm(current => ({ ...current, title: event.target.value }))} placeholder="Assign field inspection" /></label>
                <label><span>Due date</span><input type="date" value={taskForm.due_at} onChange={event => setTaskForm(current => ({ ...current, due_at: event.target.value }))} /></label>
                <button className="primary-action" type="submit" disabled={selectedWorker.status !== 'active' || quickTaskMutation.isPending}>
                  {quickTaskMutation.isPending ? 'Assigning...' : 'Assign task'}
                </button>
              </form>
            </>
          ) : (
            <p className="panel-copy">Choose a worker to review contact details, availability, skills, and assign a task directly.</p>
          )}
        </aside>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Workspace access</h2>
          <span>Login users for this tenant</span>
        </div>
        <form className="entity-form team-form" onSubmit={submitTeamUser}>
          <label><span>Email</span><input value={teamForm.email} onChange={event => setTeamForm(current => ({ ...current, email: event.target.value }))} placeholder="team@example.com" /></label>
          <label><span>Temporary password</span><input type="password" value={teamForm.password} onChange={event => setTeamForm(current => ({ ...current, password: event.target.value }))} placeholder="Minimum 6 characters" /></label>
          <label><span>Role</span><select value={teamForm.role} onChange={event => setTeamForm(current => ({ ...current, role: event.target.value as TeamRole }))}>{teamRoles.map(role => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label>
          <button className="primary-action" type="submit" disabled={createTeamMutation.isPending}>{createTeamMutation.isPending ? 'Creating...' : 'Create user'}</button>
        </form>
        <div className="team-list compact-team-list">
          {team.map(item => (
            <article className="team-row" key={item.id}>
              <div>
                <strong>{item.email}</strong>
                <span>{item.id === user?.sub ? 'Current session' : item.is_active ? 'Active account' : 'Deactivated'}</span>
              </div>
              <label><span>Role</span><select value={item.role} disabled={item.role === 'owner'} onChange={event => updateTeamMutation.mutate({ id: item.id, role: event.target.value as TeamRole })}>
                {(['owner', ...teamRoles] as TeamRole[]).map(role => <option key={role} value={role}>{roleLabels[role]}</option>)}
              </select></label>
              <div><small>Status</small><span className={`status-chip ${item.is_active ? 'status-active' : 'status-inactive'}`}>{item.is_active ? 'Active' : 'Inactive'}</span></div>
              <div className="row-actions">
                {!item.is_active ? (
                  <button className="secondary-action" type="button" onClick={() => updateTeamMutation.mutate({ id: item.id, is_active: true })}>Reactivate</button>
                ) : (
                  <button className="secondary-action" type="button" onClick={() => deactivateTeamMutation.mutate(item.id)} disabled={item.id === user?.sub || item.role === 'owner' || deactivateTeamMutation.isPending}>Deactivate</button>
                )}
              </div>
            </article>
          ))}
          {team.length === 0 ? <p className="empty-state">No login users found yet.</p> : null}
        </div>
      </section>
    </div>
  )
}

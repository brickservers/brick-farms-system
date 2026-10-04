import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useToast } from '../contexts/ToastContext'
import { createTask, listTasks, listWorkers } from '../api/farm'
import PageHeader from '../components/ui/PageHeader'
import { useDeviceLocation } from '../hooks/useDeviceLocation'

export default function TasksPage() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['tasks'], queryFn: listTasks })
  const workersQuery = useQuery({ queryKey: ['workers', 'active', 'task-form'], queryFn: () => listWorkers({ status: 'active' }) })
  const tasks = query.data || []
  const [form, setForm] = useState({ title: '', worker_id: '', due_at: '', lat: '', lng: '' })
  const { showToast } = useToast()
  const deviceLocation = useDeviceLocation()

  const createMutation = useMutation({
    mutationFn: () => createTask({
      title: form.title.trim(),
      worker_id: form.worker_id || undefined,
      due_at: form.due_at || undefined,
      lat: form.lat ? Number(form.lat) : undefined,
      lng: form.lng ? Number(form.lng) : undefined,
      meta: { source: 'tasks_page' },
    }),
    onSuccess: async () => {
      showToast({ type: 'success', message: 'Task created.' })
      setForm({ title: '', worker_id: '', due_at: '', lat: '', lng: '' })
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
      await queryClient.invalidateQueries({ queryKey: ['map', 'tasks'] })
    },
    onError: error => showToast({ type: 'error', message: error instanceof Error ? error.message : 'Could not create task.' }),
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.title.trim()) {
      showToast({ type: 'error', message: 'Task title is required.' })
      return
    }
    createMutation.mutate()
  }

  async function useCurrentLocation() {
    try {
      const location = await deviceLocation.requestLocation()
      setForm(current => ({
        ...current,
        lat: location.lat.toFixed(6),
        lng: location.lng.toFixed(6),
      }))
      showToast({ type: 'success', message: `Device location added${location.accuracy ? ` within about ${Math.round(location.accuracy)}m` : ''}.` })
    } catch (error) {
      showToast({ type: 'error', message: error instanceof Error ? error.message : 'Could not read device location.' })
    }
  }

  const grouped = useMemo(() => {
    const source = tasks
    return {
      pending: source.filter((task: any) => !task.status || task.status === 'pending' || task.status === 'Due today' || task.status === 'Open'),
      in_progress: source.filter((task: any) => task.status === 'in_progress' || task.status === 'Review'),
      done: source.filter((task: any) => task.status === 'done' || task.status === 'completed'),
    }
  }, [tasks])

  return (
    <div className="page-stack">
      <PageHeader title="Tasks" description="Plan field work, assign responsibilities, and keep observations attached to the right plot." />
      <section className="panel">
        <div className="panel-heading">
          <h2>New task</h2>
          <span>Optional GPS point appears on the map</span>
        </div>
        <form className="entity-form task-form" onSubmit={submit}>
          <label><span>Task title</span><input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="Inspect cassava ridges" /></label>
          <label><span>Worker</span><select value={form.worker_id} onChange={event => setForm(current => ({ ...current, worker_id: event.target.value }))}><option value="">Unassigned</option>{(workersQuery.data || []).map(worker => <option value={worker.id} key={worker.id}>{worker.full_name}</option>)}</select></label>
          <label><span>Due date</span><input type="datetime-local" value={form.due_at} onChange={event => setForm(current => ({ ...current, due_at: event.target.value }))} /></label>
          <label><span>Latitude</span><input value={form.lat} onChange={event => setForm(current => ({ ...current, lat: event.target.value }))} inputMode="decimal" placeholder="7.7300" /></label>
          <label><span>Longitude</span><input value={form.lng} onChange={event => setForm(current => ({ ...current, lng: event.target.value }))} inputMode="decimal" placeholder="8.5200" /></label>
          <button className="secondary-action" type="button" onClick={useCurrentLocation} disabled={deviceLocation.isLocating}>
            {deviceLocation.isLocating ? 'Reading GPS...' : 'Use my location'}
          </button>
          <button className="primary-action" type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create task'}</button>
        </form>
        {/* device location errors are surfaced as toasts */}
      </section>
      <section className="kanban">
        {['pending', 'in_progress', 'done'].map(status => (
          <div className="kanban-column" key={status}>
            <h2>{status.replace('_', ' ')}</h2>
            {(grouped[status as keyof typeof grouped] as any[]).slice(0, 8).map((task: any) => (
              <article className="task-card" key={`${status}-${task.id || task.name}`}>
                <strong>{task.name}</strong>
                <span>{task.worker_name ? `Assigned to ${task.worker_name}` : task.description || task.owner || 'Field operation'}</span>
                <small>{task.status || status}</small>
              </article>
            ))}
            {grouped[status as keyof typeof grouped].length === 0 ? <p className="empty-state">No tasks here yet.</p> : null}
          </div>
        ))}
      </section>
    </div>
  )
}

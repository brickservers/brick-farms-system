import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useToast } from '../contexts/ToastContext'
import {
  createFarmPlan,
  createFarmPlanActivity,
  downloadFarmPlanTemplate,
  listAnimalGroups,
  listFarmPlanActivities,
  listFarmPlans,
  listFarms,
  listPlots,
  uploadFarmPlanTemplate,
} from '../api/farm'
import PageHeader from '../components/ui/PageHeader'

const scopes = ['workspace', 'farm', 'plot', 'crop', 'animal']
const periods = ['day', 'week', 'month', 'season', 'year']
const priorities = ['low', 'normal', 'high', 'urgent']
const activityTypes = ['land_preparation', 'planting', 'fertilization', 'irrigation', 'spraying', 'inspection', 'feeding', 'vaccination', 'harvest', 'maintenance']
const workerRoles = ['admin', 'agronomist', 'field_worker', 'accountant', 'auditor']

export default function FarmPlansPage() {
  const queryClient = useQueryClient()
  const plansQuery = useQuery({ queryKey: ['farm-plans'], queryFn: listFarmPlans })
  const farmsQuery = useQuery({ queryKey: ['farms'], queryFn: listFarms })
  const plotsQuery = useQuery({ queryKey: ['plots'], queryFn: listPlots })
  const animalsQuery = useQuery({ queryKey: ['animal-groups'], queryFn: () => listAnimalGroups() })
  const plans = plansQuery.data || []
  const farms = farmsQuery.data || []
  const plots = plotsQuery.data || []
  const animals = animalsQuery.data || []
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [planForm, setPlanForm] = useState({ name: '', farm_id: '', scope_type: 'farm', period_type: 'season', starts_on: '', ends_on: '', notes: '' })
  const [activityForm, setActivityForm] = useState({ title: '', farm_id: '', plot_id: '', animal_group_id: '', crop: '', activity_type: 'inspection', due_on: '', worker_role: 'field_worker', estimated_cost: '', priority: 'normal', description: '' })
  const { showToast } = useToast()
  const activitiesQuery = useQuery({ queryKey: ['farm-plan-activities', selectedPlanId], queryFn: () => listFarmPlanActivities(selectedPlanId), enabled: Boolean(selectedPlanId) })
  const activities = activitiesQuery.data || []

  const stats = useMemo(() => ({
    plans: plans.length,
    active: plans.filter(plan => plan.status === 'active').length,
    activities: plans.reduce((total, plan) => total + Number(plan.activity_count || 0), 0),
    selected: activities.length,
  }), [plans, activities])

  const createPlanMutation = useMutation({
    mutationFn: () => createFarmPlan({
      name: planForm.name.trim(),
      farm_id: planForm.farm_id || undefined,
      scope_type: planForm.scope_type,
      period_type: planForm.period_type,
      starts_on: planForm.starts_on || undefined,
      ends_on: planForm.ends_on || undefined,
      notes: planForm.notes || undefined,
      status: 'draft',
    }),
    onSuccess: async (plan: any) => {
      showToast({ type: 'success', message: 'Farm plan created.' })
      setSelectedPlanId(plan.id)
      setPlanForm({ name: '', farm_id: '', scope_type: 'farm', period_type: 'season', starts_on: '', ends_on: '', notes: '' })
      await queryClient.invalidateQueries({ queryKey: ['farm-plans'] })
    },
    onError: error => showToast({ type: 'error', message: error instanceof Error ? error.message : 'Could not create farm plan.' }),
  })

  const createActivityMutation = useMutation({
    mutationFn: () => {
      if (!selectedPlanId) throw new Error('Select or create a farm plan first.')
      if (!activityForm.title.trim()) throw new Error('Activity title is required.')
      return createFarmPlanActivity(selectedPlanId, {
        title: activityForm.title.trim(),
        farm_id: activityForm.farm_id || undefined,
        plot_id: activityForm.plot_id || undefined,
        animal_group_id: activityForm.animal_group_id || undefined,
        crop: activityForm.crop || undefined,
        activity_type: activityForm.activity_type || undefined,
        due_on: activityForm.due_on || undefined,
        worker_role: activityForm.worker_role || undefined,
        estimated_cost: activityForm.estimated_cost ? Number(activityForm.estimated_cost) : undefined,
        priority: activityForm.priority,
        description: activityForm.description || undefined,
        create_task: true,
      })
    },
    onSuccess: async () => {
      showToast({ type: 'success', message: 'Plan activity added and task created.' })
      setActivityForm({ title: '', farm_id: '', plot_id: '', animal_group_id: '', crop: '', activity_type: 'inspection', due_on: '', worker_role: 'field_worker', estimated_cost: '', priority: 'normal', description: '' })
      await queryClient.invalidateQueries({ queryKey: ['farm-plan-activities', selectedPlanId] })
      await queryClient.invalidateQueries({ queryKey: ['farm-plans'] })
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: error => showToast({ type: 'error', message: error instanceof Error ? error.message : 'Could not create activity.' }),
  })

  const uploadMutation = useMutation({
    mutationFn: uploadFarmPlanTemplate,
    onSuccess: async (result: any) => {
      showToast({ type: 'success', message: `Imported ${result.activities || 0} activities across ${result.plans || 0} plans.` })
      await queryClient.invalidateQueries({ queryKey: ['farm-plans'] })
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: error => showToast({ type: 'error', message: error instanceof Error ? error.message : 'Could not upload plan template.' }),
  })

  async function downloadTemplate() {
    const blob = await downloadFarmPlanTemplate()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'farm-plan-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page-stack">
      <PageHeader title="Farm Plans" description="Build reusable agronomic activity plans by workspace, farm, plot, crop, animal group, season, month, week, or year." />

      <section className="stat-grid">
        <div className="stat-tile stat-green"><span>Plans</span><strong>{stats.plans}</strong><small>Saved templates and schedules</small></div>
        <div className="stat-tile stat-brown"><span>Active</span><strong>{stats.active}</strong><small>Currently in execution</small></div>
        <div className="stat-tile stat-ink"><span>Activities</span><strong>{stats.activities}</strong><small>Planned work items</small></div>
        <div className="stat-tile stat-white"><span>Selected</span><strong>{stats.selected}</strong><small>Activities in focus</small></div>
      </section>

      <section className="asset-editor-grid">
        <div className="panel">
          <div className="panel-heading"><h2>New farm plan</h2><span>Crop, animal, plot, or workspace scope</span></div>
          <form className="asset-form" onSubmit={event => { event.preventDefault(); createPlanMutation.mutate() }}>
            <label><span>Plan name</span><input value={planForm.name} onChange={event => setPlanForm(current => ({ ...current, name: event.target.value }))} placeholder="Dry season maize plan" /></label>
            <label><span>Farm</span><select value={planForm.farm_id} onChange={event => setPlanForm(current => ({ ...current, farm_id: event.target.value }))}><option value="">Workspace-wide</option>{farms.map(farm => <option key={farm.id} value={farm.id}>{farm.name}</option>)}</select></label>
            <label><span>Scope</span><select value={planForm.scope_type} onChange={event => setPlanForm(current => ({ ...current, scope_type: event.target.value }))}>{scopes.map(scope => <option key={scope} value={scope}>{scope}</option>)}</select></label>
            <label><span>Duration</span><select value={planForm.period_type} onChange={event => setPlanForm(current => ({ ...current, period_type: event.target.value }))}>{periods.map(period => <option key={period} value={period}>{period}</option>)}</select></label>
            <label><span>Starts</span><input type="date" value={planForm.starts_on} onChange={event => setPlanForm(current => ({ ...current, starts_on: event.target.value }))} /></label>
            <label><span>Ends</span><input type="date" value={planForm.ends_on} onChange={event => setPlanForm(current => ({ ...current, ends_on: event.target.value }))} /></label>
            <label className="wide-field"><span>Notes</span><input value={planForm.notes} onChange={event => setPlanForm(current => ({ ...current, notes: event.target.value }))} placeholder="Soil, crop cycle, labour, and expected outcome notes" /></label>
            <button className="primary-action" type="submit" disabled={createPlanMutation.isPending}>{createPlanMutation.isPending ? 'Creating...' : 'Create plan'}</button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-heading"><h2>Template workflow</h2><span>Reusable agronomist plans</span></div>
          <div className="template-actions">
            <p className="panel-copy">Download the CSV template, fill activities in a spreadsheet, then upload it to create the plan and matching tasks.</p>
            <button className="secondary-action" type="button" onClick={downloadTemplate}>Download CSV template</button>
            <label className="upload-control">
              <span>Upload populated CSV</span>
              <input type="file" accept=".csv,text/csv" onChange={event => {
                const file = event.target.files?.[0]
                if (file) uploadMutation.mutate(file)
              }} />
            </label>
          </div>
        </div>
      </section>

      <section className="asset-list-grid">
        <div className="panel">
          <div className="panel-heading"><h2>Plan library</h2><span>{plansQuery.isFetching ? 'Refreshing...' : `${plans.length} plans`}</span></div>
          <div className="asset-list">
            {plans.map(plan => (
              <button className={`asset-row plan-row ${selectedPlanId === plan.id ? 'selected' : ''}`} key={plan.id} type="button" onClick={() => setSelectedPlanId(plan.id)}>
                <strong>{plan.name}</strong>
                <span>{plan.farm_name || 'Workspace'} · {plan.scope_type} · {plan.period_type}</span>
                <small>{plan.activity_count || 0} activities · {plan.status}</small>
              </button>
            ))}
            {plans.length === 0 ? <p className="empty-state">No farm plans yet. Create one or upload a template.</p> : null}
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading"><h2>Add activity</h2><span>{selectedPlanId ? 'Creates matching task' : 'Select a plan'}</span></div>
          <form className="asset-form" onSubmit={event => { event.preventDefault(); createActivityMutation.mutate() }}>
            <label><span>Activity title</span><input value={activityForm.title} onChange={event => setActivityForm(current => ({ ...current, title: event.target.value }))} placeholder="Apply basal fertilizer" /></label>
            <label><span>Farm</span><select value={activityForm.farm_id} onChange={event => setActivityForm(current => ({ ...current, farm_id: event.target.value }))}><option value="">From plan</option>{farms.map(farm => <option key={farm.id} value={farm.id}>{farm.name}</option>)}</select></label>
            <label><span>Plot</span><select value={activityForm.plot_id} onChange={event => setActivityForm(current => ({ ...current, plot_id: event.target.value }))}><option value="">No plot</option>{plots.map(plot => <option key={plot.id} value={plot.id}>{plot.name}</option>)}</select></label>
            <label><span>Animal group</span><select value={activityForm.animal_group_id} onChange={event => setActivityForm(current => ({ ...current, animal_group_id: event.target.value }))}><option value="">No animal group</option>{animals.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
            <label><span>Crop</span><input value={activityForm.crop} onChange={event => setActivityForm(current => ({ ...current, crop: event.target.value }))} placeholder="maize, cassava, rice" /></label>
            <label><span>Activity type</span><select value={activityForm.activity_type} onChange={event => setActivityForm(current => ({ ...current, activity_type: event.target.value }))}>{activityTypes.map(type => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}</select></label>
            <label><span>Due date</span><input type="date" value={activityForm.due_on} onChange={event => setActivityForm(current => ({ ...current, due_on: event.target.value }))} /></label>
            <label><span>Role</span><select value={activityForm.worker_role} onChange={event => setActivityForm(current => ({ ...current, worker_role: event.target.value }))}>{workerRoles.map(role => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}</select></label>
            <label><span>Cost estimate</span><input value={activityForm.estimated_cost} onChange={event => setActivityForm(current => ({ ...current, estimated_cost: event.target.value }))} inputMode="decimal" /></label>
            <label><span>Priority</span><select value={activityForm.priority} onChange={event => setActivityForm(current => ({ ...current, priority: event.target.value }))}>{priorities.map(priority => <option key={priority} value={priority}>{priority}</option>)}</select></label>
            <label className="wide-field"><span>Description</span><input value={activityForm.description} onChange={event => setActivityForm(current => ({ ...current, description: event.target.value }))} placeholder="Operational instructions, timing, inputs, and quality checks" /></label>
            <button className="primary-action" type="submit" disabled={!selectedPlanId || createActivityMutation.isPending}>{createActivityMutation.isPending ? 'Adding...' : 'Add activity and task'}</button>
          </form>
        </div>
      </section>

      {/* form feedback moved to global toasts */}

      <section className="panel">
        <div className="panel-heading"><h2>Selected plan activities</h2><span>{activitiesQuery.isFetching ? 'Loading...' : `${activities.length} activities`}</span></div>
        <div className="plan-activity-list">
          {activities.map(activity => (
            <article className="asset-row" key={activity.id}>
              <strong>{activity.title}</strong>
              <span>{activity.activity_type || 'activity'} · {activity.crop || activity.animal_group_name || activity.plot_name || activity.farm_name || 'workspace'}</span>
              <small>{activity.due_on || 'No due date'} · {activity.worker_role || 'unassigned'} · {activity.priority || 'normal'}</small>
            </article>
          ))}
          {!selectedPlanId ? <p className="empty-state">Select a farm plan to view activities.</p> : null}
          {selectedPlanId && activities.length === 0 ? <p className="empty-state">No activities on this plan yet.</p> : null}
        </div>
      </section>
    </div>
  )
}

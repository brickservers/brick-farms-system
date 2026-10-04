import { useQuery } from '@tanstack/react-query'
import PageHeader from '../components/ui/PageHeader'
import StatTile from '../components/ui/StatTile'
import { listInvestments, listPlots, listSensorDevices, listTasks } from '../api/farm'
import { useLanguage } from '../contexts/LanguageContext'

export default function OverviewPage() {
  const { t } = useLanguage()
  const plotsQuery = useQuery({ queryKey: ['plots'], queryFn: listPlots, staleTime: 60_000 })
  const tasksQuery = useQuery({ queryKey: ['tasks'], queryFn: listTasks, staleTime: 60_000 })
  const sensorsQuery = useQuery({ queryKey: ['sensor-devices'], queryFn: listSensorDevices, staleTime: 60_000 })
  const investmentsQuery = useQuery({ queryKey: ['investments'], queryFn: listInvestments, staleTime: 60_000 })

  const plots = plotsQuery.data || []
  const tasks = tasksQuery.data || []
  const sensors = sensorsQuery.data || []
  const investments = (investmentsQuery.data || []) as any[]
  const activeTasks = tasks.filter((task: any) => !['done', 'completed', 'cancelled'].includes(String(task.status || '').toLowerCase()))
  const capital = investments.reduce((total, item) => total + Number(item.amount || 0), 0)

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Live Farm Workspace"
        title={t('overview')}
        description="A focused operations surface for farms, plots, work orders, sensors, finance, and investor reporting."
      />

      <div className="stat-grid">
        <StatTile label={t('plots')} value={String(plots.length)} detail="Mapped production areas" tone="green" />
        <StatTile label={t('activeTasks')} value={String(activeTasks.length)} detail="Field and office work" tone="brown" />
        <StatTile label={t('sensorHealth')} value={`${sensors.length} devices`} detail="Telemetry network" tone="ink" />
        <StatTile label={t('revenue')} value={`N ${capital.toLocaleString()}`} detail="Recorded capital" tone="white" />
      </div>

      <section className="dashboard-grid">
        <div className="panel panel-large">
          <div className="panel-heading">
            <h2>Season priorities</h2>
            <span>Operational</span>
          </div>
          <div className="priority-list">
            {activeTasks.slice(0, 6).map((task: any) => (
              <div className="list-row" key={task.id || task.name}>
                <div>
                  <strong>{task.name}</strong>
                  <span>{task.worker_name ? `Assigned to ${task.worker_name}` : task.description || 'Field operation'}</span>
                </div>
                <small>{task.status}</small>
              </div>
            ))}
            {activeTasks.length === 0 ? <p className="empty-state">No active tasks yet.</p> : null}
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h2>Plot pulse</h2>
            <span>Live</span>
          </div>
          {plots.slice(0, 6).map(plot => (
            <div className="list-row compact" key={plot.id}>
              <div>
                <strong>{plot.name}</strong>
                <span>{plot.crop_type || 'Crop not set'}</span>
              </div>
              <small>{plot.area_ha ? `${Number(plot.area_ha).toFixed(2)} ha` : 'Area pending'}</small>
            </div>
          ))}
          {plots.length === 0 ? <p className="empty-state">No plots mapped yet. Use the map to draw your first plot.</p> : null}
        </div>
      </section>
    </div>
  )
}

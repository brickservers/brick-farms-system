import PageHeader from '../components/ui/PageHeader'
import { usePlan } from '../contexts/PlanContext'

export default function DemoPage() {
  const { mode, limits } = usePlan()

  return (
    <div className="page-stack">
      <PageHeader title="Demo workspace" description="A guided customer trial area with realistic farm data, free-mode limits, and upgrade paths." />
      <section className="panel">
        <div className="panel-heading">
          <h2>{mode} limits</h2>
          <span>Retention plan</span>
        </div>
        <div className="limit-grid">
          <div><strong>{limits.farms}</strong><span>Farms</span></div>
          <div><strong>{limits.plots}</strong><span>Plots</span></div>
          <div><strong>{limits.sensors}</strong><span>Sensors</span></div>
          <div><strong>{limits.users}</strong><span>Users</span></div>
        </div>
      </section>
    </div>
  )
}

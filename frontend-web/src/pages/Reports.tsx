import { useQuery } from '@tanstack/react-query'
import { downloadReport, getActivitySummary, getCarbonMetrics, getForecast } from '../api/farm'
import PageHeader from '../components/ui/PageHeader'
import { useState } from 'react'

export default function ReportsPage() {
  const forecast = useQuery({ queryKey: ['reports', 'forecast'], queryFn: getForecast })
  const activity = useQuery({ queryKey: ['reports', 'activity'], queryFn: getActivitySummary })
  const carbon = useQuery({ queryKey: ['reports', 'carbon'], queryFn: getCarbonMetrics })
  const [message, setMessage] = useState<string | null>(null)
  const forecastSeries = Array.isArray(forecast.data) ? forecast.data : []
  const firstForecast = forecastSeries[0]
  const forecastPoints = firstForecast?.points || []
  const activityCounts = (activity.data as any)?.activity_counts || {}
  const carbonTonnes = Number((carbon.data as any)?.co2e_tonnes || 0)

  async function exportReport(format: 'csv' | 'pdf') {
    try {
      setMessage(`Preparing ${format.toUpperCase()} export...`)
      const blob = await downloadReport(format)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `brickfarm-report.${format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setMessage(`${format.toUpperCase()} export downloaded.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not download report.')
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Reports"
        description="Yield forecasts, field activity, carbon metrics, exports, and stakeholder summaries."
        actions={<div className="page-actions"><button className="secondary-action" onClick={() => exportReport('csv')} type="button">CSV</button><button className="primary-action" onClick={() => exportReport('pdf')} type="button">PDF</button></div>}
      />
      {message ? <div className="form-note">{message}</div> : null}
      <section className="dashboard-grid">
        <div className="panel">
          <div className="panel-heading"><h2>Forecast</h2><span>{forecast.isLoading ? 'Loading' : 'Ready'}</span></div>
          <div className="metric-row"><span>Forecast points</span><strong>{forecastPoints.length}</strong></div>
          <div className="metric-row"><span>Estimated yield</span><strong>{forecastPoints.reduce((total: number, point: any) => total + Number(point.yield_kg || 0), 0).toFixed(2)} kg</strong></div>
          {forecastPoints.length === 0 ? <p className="empty-state">No yield history yet. Forecasts will improve as harvest data is recorded.</p> : null}
        </div>
        <div className="panel">
          <div className="panel-heading"><h2>Activity</h2><span>{activity.isLoading ? 'Loading' : 'Ready'}</span></div>
          {Object.entries(activityCounts).map(([key, value]) => <div className="metric-row" key={key}><span>{key}</span><strong>{String(value)}</strong></div>)}
          {Object.keys(activityCounts).length === 0 ? <p className="empty-state">No activity events recorded yet.</p> : null}
        </div>
        <div className="panel">
          <div className="panel-heading"><h2>Carbon</h2><span>{carbon.isLoading ? 'Loading' : 'Ready'}</span></div>
          <div className="metric-row"><span>Estimated CO2e</span><strong>{carbonTonnes.toFixed(4)} tonnes</strong></div>
          <p className="panel-copy">Carbon estimates use recorded activity factors and will become richer as operations data grows.</p>
        </div>
      </section>
    </div>
  )
}

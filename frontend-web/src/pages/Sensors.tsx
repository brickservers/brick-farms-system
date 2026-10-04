import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useToast } from '../contexts/ToastContext'
import { createSensorDevice, listFarms, listPlots, listSensorDevices, listSensorReadings } from '../api/farm'
import PageHeader from '../components/ui/PageHeader'

export default function SensorsPage() {
  const queryClient = useQueryClient()
  const farmsQuery = useQuery({ queryKey: ['farms'], queryFn: listFarms })
  const plotsQuery = useQuery({ queryKey: ['plots'], queryFn: listPlots })
  const devicesQuery = useQuery({ queryKey: ['sensor-devices'], queryFn: listSensorDevices })
  const readingsQuery = useQuery({ queryKey: ['sensor-readings'], queryFn: () => listSensorReadings() })
  const devices = devicesQuery.data || []
  const readings = readingsQuery.data || []
  const [form, setForm] = useState({ farmId: '', plotId: '', name: '', protocol: 'http', apiKey: '' })
  const { showToast } = useToast()

  useEffect(() => {
    const firstFarm = farmsQuery.data?.[0]?.id
    if (firstFarm && !form.farmId) setForm(current => ({ ...current, farmId: firstFarm }))
  }, [farmsQuery.data, form.farmId])

  const createMutation = useMutation({
    mutationFn: () => createSensorDevice({
      farm_id: form.farmId,
      plot_id: form.plotId || null,
      name: form.name.trim(),
      protocol: form.protocol,
      api_key: form.apiKey.trim(),
    }),
      onSuccess: async device => {
      showToast({ type: 'success', message: `${device.name} added.` })
      setForm(current => ({ ...current, plotId: '', name: '', apiKey: '' }))
      await queryClient.invalidateQueries({ queryKey: ['sensor-devices'] })
      await queryClient.invalidateQueries({ queryKey: ['map', 'sensor-readings'] })
    },
    onError: error => showToast({ type: 'error', message: error instanceof Error ? error.message : 'Could not add sensor device.' }),
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.farmId) {
      showToast({ type: 'error', message: 'Create or select a farm before adding sensors.' })
      return
    }
    if (!form.name.trim() || !form.apiKey.trim()) {
      showToast({ type: 'error', message: 'Device name and API key are required.' })
      return
    }
    createMutation.mutate()
  }

  return (
    <div className="page-stack">
      <PageHeader title="Sensors" description="Monitor field devices, telemetry freshness, moisture, rainfall, and field exceptions." />
      <section className="panel">
        <div className="panel-heading">
          <h2>Add device</h2>
          <span>HTTP, MQTT, CoAP ready</span>
        </div>
        <form className="entity-form sensor-form" onSubmit={submit}>
          <label><span>Farm</span><select value={form.farmId} onChange={event => setForm(current => ({ ...current, farmId: event.target.value }))}>
            <option value="">Select farm</option>
            {(farmsQuery.data || []).map(farm => <option value={farm.id} key={farm.id}>{farm.name}</option>)}
          </select></label>
          <label><span>Plot</span><select value={form.plotId} onChange={event => setForm(current => ({ ...current, plotId: event.target.value }))}>
            <option value="">None</option>
            {(plotsQuery.data || []).map(plot => <option value={plot.id} key={plot.id}>{plot.name}</option>)}
          </select></label>
          <label><span>Name</span><input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="Soil moisture A1" /></label>
          <label><span>Protocol</span><select value={form.protocol} onChange={event => setForm(current => ({ ...current, protocol: event.target.value }))}>
            <option value="http">HTTP</option>
            <option value="mqtt">MQTT</option>
            <option value="coap">CoAP</option>
          </select></label>
          <label><span>API key</span><input value={form.apiKey} onChange={event => setForm(current => ({ ...current, apiKey: event.target.value }))} placeholder="Device secret" /></label>
          <button className="primary-action" type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Adding...' : 'Add device'}</button>
        </form>
        {/* feedback shown via global toasts */}
      </section>
      <div className="dashboard-grid">
        <section className="panel panel-large">
          <div className="panel-heading">
            <h2>Device network</h2>
            <span>{devices.length} devices</span>
          </div>
          {devices.map((device: any) => (
            <div className="list-row" key={device.id || device.name}>
              <div>
                <strong>{device.name}</strong>
                <span>{device.protocol || device.status}</span>
              </div>
              <small>{device.metric || 'Ready'}</small>
            </div>
          ))}
          {!devicesQuery.isLoading && devices.length === 0 ? <p className="empty-state">No sensor devices yet. Add a device to begin telemetry.</p> : null}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Recent readings</h2>
            <span>{readings.length}</span>
          </div>
          {readings.slice(0, 6).map((reading: any) => (
            <div className="metric-row" key={reading.id || reading.name}>
              <span>{reading.metric || reading.name}</span>
              <strong>{reading.value ? `${reading.value} ${reading.unit || ''}` : reading.metric}</strong>
            </div>
          ))}
          {!readingsQuery.isLoading && readings.length === 0 ? <p className="empty-state">No sensor readings received yet.</p> : null}
        </section>
      </div>
    </div>
  )
}

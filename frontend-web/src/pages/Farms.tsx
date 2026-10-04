import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'
import { createFarm, listFarms } from '../api/farm'
import PageHeader from '../components/ui/PageHeader'
import { nigeriaLgas, nigeriaStates } from '../data/nigeria'
import { getTenantSlug, tenantPath } from '../utils/tenantRouting'

export default function FarmsPage() {
  const queryClient = useQueryClient()
  const farmsQuery = useQuery({ queryKey: ['farms'], queryFn: listFarms })
  const farms = farmsQuery.data || []
  const location = useLocation()
  const tenantSlug = getTenantSlug(location.pathname)
  const [form, setForm] = useState({ name: '', country: 'NG', country_code: '', state: '', lga: '', farm_type: 'crop' })
  const { showToast } = useToast()
  const isNigeria = form.country === 'NG'
  const lgaOptions = isNigeria && form.state ? nigeriaLgas[form.state] || [] : []

  const createMutation = useMutation({
    mutationFn: () => createFarm({
      name: form.name.trim(),
      country: form.country === 'NG' ? 'NG' : (form.country_code.trim().toUpperCase() || 'NG'),
      state: form.state.trim() || undefined,
      lga: form.lga.trim() || undefined,
      farm_type: form.farm_type,
    }),
    onSuccess: async farm => {
      showToast({ type: 'success', message: `${farm.name} created.` })
      setForm({ name: '', country: 'NG', country_code: '', state: '', lga: '', farm_type: 'crop' })
      await queryClient.invalidateQueries({ queryKey: ['farms'] })
      await queryClient.invalidateQueries({ queryKey: ['map', 'farms'] })
    },
    onError: error => showToast({ type: 'error', message: error instanceof Error ? error.message : 'Could not create farm.' }),
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.name.trim()) {
      showToast({ type: 'error', message: 'Farm name is required.' })
      return
    }
    createMutation.mutate()
  }

  return (
    <div className="page-stack">
      <PageHeader title="Farms" description="Create, compare, and manage farm operating units across tenants and regions." />
      <section className="panel">
        <div className="panel-heading">
          <h2>New farm</h2>
          <span>Feeds plots, tasks, sensors, and finance</span>
        </div>
        <form className="entity-form" onSubmit={submit}>
          <label><span>Farm name</span><input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="Primary Farm" /></label>
          <label><span>Country</span><select value={form.country} onChange={event => setForm(current => ({ ...current, country: event.target.value, state: '', lga: '' }))}><option value="NG">Nigeria</option><option value="OTHER">Other country</option></select></label>
          {isNigeria ? (
            <>
              <label><span>State</span><select value={form.state} onChange={event => setForm(current => ({ ...current, state: event.target.value, lga: '' }))}><option value="">Select state</option>{nigeriaStates.map(state => <option key={state} value={state}>{state}</option>)}</select></label>
              <label><span>LGA</span><select value={form.lga} onChange={event => setForm(current => ({ ...current, lga: event.target.value }))} disabled={!form.state}><option value="">Select LGA</option>{lgaOptions.map(lga => <option key={lga} value={lga}>{lga}</option>)}</select></label>
            </>
          ) : (
            <>
              <label><span>Country code</span><input value={form.country_code} onChange={event => setForm(current => ({ ...current, country_code: event.target.value.toUpperCase().slice(0, 2) }))} placeholder="GH, KE, US" maxLength={2} /></label>
              <label><span>State/region</span><input value={form.state} onChange={event => setForm(current => ({ ...current, state: event.target.value }))} placeholder="Region" /></label>
              <label><span>Local area</span><input value={form.lga} onChange={event => setForm(current => ({ ...current, lga: event.target.value }))} placeholder="District" /></label>
            </>
          )}
          <label><span>Farm type</span><select value={form.farm_type} onChange={event => setForm(current => ({ ...current, farm_type: event.target.value }))}><option value="crop">Crop</option><option value="animal">Animal</option><option value="mixed">Mixed</option></select></label>
          <button className="primary-action" type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create farm'}</button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Farm registry</h2>
          <span>{farmsQuery.isLoading ? 'Loading' : `${farms.length || 1} shown`}</span>
        </div>
        <div className="data-table">
          <div className="table-row table-head"><span>Name</span><span>Type</span><span>State</span><span>Country</span></div>
          {farms.map(farm => (
            <div className="table-row" key={farm.id}>
              <span><strong>{farm.name}</strong><Link className="inline-row-link" to={tenantPath(`/map?farm=${farm.id}`, tenantSlug)}>Map</Link></span>
              <span>{farm.farm_type || 'crop'}</span>
              <span>{farm.state || '-'}</span>
              <span>{farm.country || '-'}</span>
            </div>
          ))}
          {farms.length === 0 ? <p className="empty-state">No farms yet. Create your first farm to begin.</p> : null}
        </div>
      </section>
    </div>
  )
}

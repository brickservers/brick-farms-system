import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'
import { createAnimalGroup, createAsset, listAnimalGroups, listAssets, listFarms, listPlots } from '../api/farm'
import PageHeader from '../components/ui/PageHeader'
import { getTenantSlug, tenantPath } from '../utils/tenantRouting'

const assetTypes = ['tool', 'machinery', 'building', 'structure', 'plot', 'vehicle', 'equipment', 'storage', 'animal_housing', 'other']
const speciesOptions = ['cattle', 'goat', 'sheep', 'poultry', 'pig', 'fish', 'rabbit', 'other']

export default function AssetsPage() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const tenantSlug = getTenantSlug(location.pathname)
  const farmsQuery = useQuery({ queryKey: ['farms'], queryFn: listFarms })
  const plotsQuery = useQuery({ queryKey: ['plots'], queryFn: listPlots })
  const assetsQuery = useQuery({ queryKey: ['assets'], queryFn: () => listAssets() })
  const animalsQuery = useQuery({ queryKey: ['animal-groups'], queryFn: () => listAnimalGroups() })
  const farms = farmsQuery.data || []
  const plots = plotsQuery.data || []
  const assets = assetsQuery.data || []
  const animals = animalsQuery.data || []
  const [assetForm, setAssetForm] = useState({ farm_id: '', plot_id: '', name: '', asset_type: 'tool', quantity: '1', unit: '', value: '', location_note: '' })
  const [animalForm, setAnimalForm] = useState({ farm_id: '', plot_id: '', housing_asset_id: '', name: '', species: 'cattle', breed: '', count: '', age_value: '', age_unit: 'months', sex: '', health_status: 'healthy', purpose: '' })
  const { showToast } = useToast()

  const stats = useMemo(() => ({
    buildings: assets.filter(item => item.asset_type === 'building' || item.asset_type === 'structure' || item.asset_type === 'animal_housing').length,
    machinery: assets.filter(item => item.asset_type === 'machinery' || item.asset_type === 'vehicle' || item.asset_type === 'equipment').length,
    animals: animals.reduce((total, item) => total + Number(item.count || 0), 0),
    value: assets.reduce((total, item) => total + Number(item.value || 0), 0),
  }), [assets, animals])

  const assetMutation = useMutation({
    mutationFn: () => {
      if (!assetForm.farm_id) throw new Error('Select a farm.')
      if (!assetForm.name.trim()) throw new Error('Asset name is required.')
      return createAsset({
        farm_id: assetForm.farm_id,
        plot_id: assetForm.plot_id || undefined,
        name: assetForm.name.trim(),
        asset_type: assetForm.asset_type,
        quantity: Number(assetForm.quantity || 1),
        unit: assetForm.unit || undefined,
        value: assetForm.value ? Number(assetForm.value) : undefined,
        currency: 'NGN',
        location_note: assetForm.location_note || undefined,
      })
    },
    onSuccess: async () => {
      showToast({ type: 'success', message: 'Asset created.' })
      setAssetForm({ farm_id: '', plot_id: '', name: '', asset_type: 'tool', quantity: '1', unit: '', value: '', location_note: '' })
      await queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
    onError: error => showToast({ type: 'error', message: error instanceof Error ? error.message : 'Could not create asset.' }),
  })

  const animalMutation = useMutation({
    mutationFn: () => {
      if (!animalForm.farm_id) throw new Error('Select a farm.')
      if (!animalForm.name.trim()) throw new Error('Animal group name is required.')
      return createAnimalGroup({
        farm_id: animalForm.farm_id,
        plot_id: animalForm.plot_id || undefined,
        housing_asset_id: animalForm.housing_asset_id || undefined,
        name: animalForm.name.trim(),
        species: animalForm.species,
        breed: animalForm.breed || undefined,
        count: Number(animalForm.count || 0),
        age_value: animalForm.age_value ? Number(animalForm.age_value) : undefined,
        age_unit: animalForm.age_unit || undefined,
        sex: animalForm.sex || undefined,
        health_status: animalForm.health_status || undefined,
        purpose: animalForm.purpose || undefined,
      })
    },
    onSuccess: async () => {
      showToast({ type: 'success', message: 'Animal group created.' })
      setAnimalForm({ farm_id: '', plot_id: '', housing_asset_id: '', name: '', species: 'cattle', breed: '', count: '', age_value: '', age_unit: 'months', sex: '', health_status: 'healthy', purpose: '' })
      await queryClient.invalidateQueries({ queryKey: ['animal-groups'] })
    },
    onError: error => showToast({ type: 'error', message: error instanceof Error ? error.message : 'Could not create animal group.' }),
  })

  const housingAssets = assets.filter(asset => asset.asset_type === 'building' || asset.asset_type === 'structure' || asset.asset_type === 'animal_housing')

  return (
    <div className="page-stack">
      <PageHeader title="Assets and animals" description="Manage farm assets, structures, tools, machinery, animal housing, and livestock groups by farm and plot." />
      <section className="stat-grid">
        <div className="stat-tile stat-green"><span>Buildings</span><strong>{stats.buildings}</strong><small>Structures and housing</small></div>
        <div className="stat-tile stat-brown"><span>Machinery</span><strong>{stats.machinery}</strong><small>Equipment fleet</small></div>
        <div className="stat-tile stat-ink"><span>Animals</span><strong>{stats.animals}</strong><small>Total recorded count</small></div>
        <div className="stat-tile stat-white"><span>Asset value</span><strong>NGN {stats.value.toLocaleString()}</strong><small>Recorded value</small></div>
      </section>

      <section className="asset-editor-grid">
        <div className="panel">
          <div className="panel-heading"><h2>New asset</h2><span>Tools, buildings, machinery, plots</span></div>
          <form className="asset-form" onSubmit={event => { event.preventDefault(); assetMutation.mutate() }}>
            <label><span>Farm</span><select value={assetForm.farm_id} onChange={event => setAssetForm(current => ({ ...current, farm_id: event.target.value }))}><option value="">Select farm</option>{farms.map(farm => <option key={farm.id} value={farm.id}>{farm.name}</option>)}</select></label>
            <label><span>Plot</span><select value={assetForm.plot_id} onChange={event => setAssetForm(current => ({ ...current, plot_id: event.target.value }))}><option value="">Whole farm</option>{plots.map(plot => <option key={plot.id} value={plot.id}>{plot.name}</option>)}</select></label>
            <label><span>Name</span><input value={assetForm.name} onChange={event => setAssetForm(current => ({ ...current, name: event.target.value }))} placeholder="Layer house / Tractor / Borehole" /></label>
            <label><span>Type</span><select value={assetForm.asset_type} onChange={event => setAssetForm(current => ({ ...current, asset_type: event.target.value }))}>{assetTypes.map(type => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}</select></label>
            <label><span>Quantity</span><input value={assetForm.quantity} onChange={event => setAssetForm(current => ({ ...current, quantity: event.target.value }))} inputMode="decimal" /></label>
            <label><span>Unit</span><input value={assetForm.unit} onChange={event => setAssetForm(current => ({ ...current, unit: event.target.value }))} placeholder="units, sqm, ha" /></label>
            <label><span>Value</span><input value={assetForm.value} onChange={event => setAssetForm(current => ({ ...current, value: event.target.value }))} inputMode="decimal" /></label>
            <label><span>Location note</span><input value={assetForm.location_note} onChange={event => setAssetForm(current => ({ ...current, location_note: event.target.value }))} placeholder="North edge of Plot A" /></label>
            <button className="primary-action" type="submit" disabled={assetMutation.isPending}>{assetMutation.isPending ? 'Creating...' : 'Create asset'}</button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-heading"><h2>New animal group</h2><span>Livestock, fish, poultry, mixed farms</span></div>
          <form className="asset-form" onSubmit={event => { event.preventDefault(); animalMutation.mutate() }}>
            <label><span>Farm</span><select value={animalForm.farm_id} onChange={event => setAnimalForm(current => ({ ...current, farm_id: event.target.value }))}><option value="">Select farm</option>{farms.map(farm => <option key={farm.id} value={farm.id}>{farm.name}</option>)}</select></label>
            <label><span>Plot/area</span><select value={animalForm.plot_id} onChange={event => setAnimalForm(current => ({ ...current, plot_id: event.target.value }))}><option value="">Whole farm</option>{plots.map(plot => <option key={plot.id} value={plot.id}>{plot.name}</option>)}</select></label>
            <label><span>Housing</span><select value={animalForm.housing_asset_id} onChange={event => setAnimalForm(current => ({ ...current, housing_asset_id: event.target.value }))}><option value="">Not assigned</option>{housingAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
            <label><span>Group name</span><input value={animalForm.name} onChange={event => setAnimalForm(current => ({ ...current, name: event.target.value }))} placeholder="Layer batch A" /></label>
            <label><span>Species</span><select value={animalForm.species} onChange={event => setAnimalForm(current => ({ ...current, species: event.target.value }))}>{speciesOptions.map(species => <option key={species} value={species}>{species}</option>)}</select></label>
            <label><span>Breed</span><input value={animalForm.breed} onChange={event => setAnimalForm(current => ({ ...current, breed: event.target.value }))} placeholder="Noiler, Friesian, etc." /></label>
            <label><span>Count</span><input value={animalForm.count} onChange={event => setAnimalForm(current => ({ ...current, count: event.target.value }))} inputMode="numeric" /></label>
            <label><span>Age</span><input value={animalForm.age_value} onChange={event => setAnimalForm(current => ({ ...current, age_value: event.target.value }))} inputMode="decimal" /></label>
            <label><span>Age unit</span><select value={animalForm.age_unit} onChange={event => setAnimalForm(current => ({ ...current, age_unit: event.target.value }))}><option value="days">days</option><option value="weeks">weeks</option><option value="months">months</option><option value="years">years</option></select></label>
            <label><span>Health</span><input value={animalForm.health_status} onChange={event => setAnimalForm(current => ({ ...current, health_status: event.target.value }))} placeholder="healthy, treatment, quarantine" /></label>
            <label><span>Purpose</span><input value={animalForm.purpose} onChange={event => setAnimalForm(current => ({ ...current, purpose: event.target.value }))} placeholder="eggs, dairy, breeding, meat" /></label>
            <button className="primary-action" type="submit" disabled={animalMutation.isPending}>{animalMutation.isPending ? 'Creating...' : 'Create animal group'}</button>
          </form>
        </div>
      </section>

      {/* feedback surfaced as global toasts */}

      <section className="asset-list-grid">
        <div className="panel">
          <div className="panel-heading"><h2>Asset register</h2><span>{assets.length} records</span></div>
          <div className="asset-list">{assets.map(asset => <article className="asset-row" key={asset.id}><strong>{asset.name}</strong><span>{asset.asset_type.replace('_', ' ')} · {asset.farm_name || 'Farm'}{asset.plot_name ? ` · ${asset.plot_name}` : ''}</span><small>{asset.quantity} {asset.unit || 'unit'} · {asset.status}</small><Link className="inline-row-link" to={tenantPath(`/map?${asset.plot_id ? `plot=${asset.plot_id}` : `farm=${asset.farm_id}`}`, tenantSlug)}>View on map</Link></article>)}{assets.length === 0 ? <p className="empty-state">No assets recorded yet.</p> : null}</div>
        </div>
        <div className="panel">
          <div className="panel-heading"><h2>Animal register</h2><span>{animals.length} groups</span></div>
          <div className="asset-list">{animals.map(group => <article className="asset-row" key={group.id}><strong>{group.name}</strong><span>{group.species}{group.breed ? ` · ${group.breed}` : ''} · {group.farm_name || 'Farm'}</span><small>{group.count} animals · {group.health_status || 'status pending'}</small><Link className="inline-row-link" to={tenantPath(`/map?${group.plot_id ? `plot=${group.plot_id}` : `farm=${group.farm_id}`}`, tenantSlug)}>View on map</Link></article>)}{animals.length === 0 ? <p className="empty-state">No animal groups recorded yet.</p> : null}</div>
        </div>
      </section>
    </div>
  )
}

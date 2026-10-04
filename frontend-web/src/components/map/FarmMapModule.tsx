import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import Map from 'ol/Map'
import View from 'ol/View'
import Feature from 'ol/Feature'
import GeoJSON from 'ol/format/GeoJSON'
import MVT from 'ol/format/MVT'
import Point from 'ol/geom/Point'
import Polygon from 'ol/geom/Polygon'
import Geometry from 'ol/geom/Geometry'
import Draw from 'ol/interaction/Draw'
import Modify from 'ol/interaction/Modify'
import Select from 'ol/interaction/Select'
import { defaults as defaultControls } from 'ol/control'
import { fromLonLat, toLonLat } from 'ol/proj'
import { Cluster, OSM, Vector as VectorSource, VectorTile as VectorTileSource, XYZ } from 'ol/source'
import { Heatmap as HeatmapLayer, Tile as TileLayer, Vector as VectorLayer, VectorTile as VectorTileLayer } from 'ol/layer'
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style'
import { API_BASE } from '../../api/client'
import { createFarm, createObservation, createPlot, createTask, deletePlot, listAnimalGroups, listAssets, listFarms, listPlots, listSensorReadings, listTasks, Plot, updatePlot } from '../../api/farm'
import { useLanguage } from '../../contexts/LanguageContext'
import { useAuth } from '../../contexts/AuthContext'
import { useDeviceLocation } from '../../hooks/useDeviceLocation'
import { getTenantSlug, tenantPath } from '../../utils/tenantRouting'
import 'ol/ol.css'
import '../../styles/map.css'

type MapMode = 'select' | 'draw' | 'edit'
type BaseMap = 'osm' | 'satellite'
type PlotFormState = {
  farmId: string
  name: string
  crop: string
  description: string
}

const geoJson = new GeoJSON()

function plotToFeature(plot: Plot) {
  if (!plot.geom_geojson) return null
  const feature = geoJson.readFeature({
    type: 'Feature',
    geometry: plot.geom_geojson,
    properties: {
      id: plot.id,
      farmId: plot.farm_id,
      name: plot.name,
      crop: plot.crop_type || 'Crop',
      area: plot.area_ha ? `${Number(plot.area_ha).toFixed(1)} ha` : 'Area pending',
      description: plot.description || '',
      kind: 'plot',
    },
  }, { featureProjection: 'EPSG:3857' }) as Feature<Polygon>
  return feature
}

function plotStyle(feature: any) {
  const name = feature.get('name') || 'Plot'
  const crop = feature.get('crop') || ''
  const area = feature.get('area') || ''
  return new Style({
    stroke: new Stroke({ color: '#173f24', width: 2 }),
    fill: new Fill({ color: 'rgba(64, 102, 48, 0.26)' }),
    text: new Text({
      text: `${name}\n${crop} ${area}`.trim(),
      font: '600 12px Inter, system-ui, sans-serif',
      fill: new Fill({ color: '#102415' }),
      stroke: new Stroke({ color: '#ffffff', width: 3 }),
      overflow: true,
    }),
  })
}

function taskClusterStyle(feature: any) {
  const features = feature.get('features') as Feature[] | undefined
  const count = features?.length || 1
  return new Style({
    image: new CircleStyle({
      radius: Math.min(18, 9 + count),
      fill: new Fill({ color: '#2b1b0f' }),
      stroke: new Stroke({ color: '#ffffff', width: 2 }),
    }),
    text: new Text({
      text: String(count),
      fill: new Fill({ color: '#ffffff' }),
      font: '700 12px Inter, system-ui, sans-serif',
    }),
  })
}

function deviceLocationStyle() {
  return new Style({
    image: new CircleStyle({
      radius: 8,
      fill: new Fill({ color: '#1d4ed8' }),
      stroke: new Stroke({ color: '#ffffff', width: 3 }),
    }),
    text: new Text({
      text: 'You',
      offsetY: -18,
      fill: new Fill({ color: '#102415' }),
      stroke: new Stroke({ color: '#ffffff', width: 3 }),
      font: '800 12px Inter, system-ui, sans-serif',
    }),
  })
}

export default function FarmMapModule() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const tenantSlug = getTenantSlug(location.pathname)
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const focusedFarmId = searchParams.get('farm') || ''
  const focusedPlotId = searchParams.get('plot') || ''
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const plotSourceRef = useRef(new VectorSource<any>())
  const taskSourceRef = useRef(new VectorSource<any>())
  const heatSourceRef = useRef(new VectorSource<any>())
  const deviceLocationSourceRef = useRef(new VectorSource<any>())
  const drawRef = useRef<Draw | null>(null)
  const modifyRef = useRef<Modify | null>(null)
  const selectRef = useRef<Select | null>(null)
  const selectedFeatureRef = useRef<Feature<Geometry> | null>(null)
  const tileLayerRef = useRef<VectorTileLayer | null>(null)
  const taskLayerRef = useRef<VectorLayer<any> | null>(null)
  const heatLayerRef = useRef<HeatmapLayer | null>(null)

  const [mode, setMode] = useState<MapMode>('select')
  const [baseMap, setBaseMap] = useState<BaseMap>('osm')
  const [selectedPlot, setSelectedPlot] = useState<Record<string, string> | null>(null)
  const [plotForm, setPlotForm] = useState<PlotFormState>({ farmId: '', name: '', crop: '', description: '' })
  const [mapMessage, setMapMessage] = useState<string | null>(null)
  const [showSensors, setShowSensors] = useState(true)
  const [showTasks, setShowTasks] = useState(true)
  const [showTiles, setShowTiles] = useState(true)
  const deviceLocation = useDeviceLocation()

  const farmsQuery = useQuery({ queryKey: ['map', 'farms'], queryFn: listFarms, staleTime: 60_000 })
  const plotsQuery = useQuery({ queryKey: ['map', 'plots'], queryFn: listPlots, staleTime: 45_000 })
  const tasksQuery = useQuery({ queryKey: ['map', 'tasks'], queryFn: listTasks, staleTime: 45_000 })
  const readingsQuery = useQuery({ queryKey: ['map', 'sensor-readings'], queryFn: () => listSensorReadings(), staleTime: 45_000 })
  const assetsQuery = useQuery({ queryKey: ['map', 'assets'], queryFn: () => listAssets(), staleTime: 45_000 })
  const animalsQuery = useQuery({ queryKey: ['map', 'animal-groups'], queryFn: () => listAnimalGroups(), staleTime: 45_000 })
  const tileProbeQuery = useQuery({
    queryKey: ['map', 'tile-probe', showTiles],
    queryFn: async () => {
      const token = localStorage.getItem('bf_access_token')
      const response = await fetch(`${API_BASE}/tiles/0/0/0/plots`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      return { ok: response.ok, bytes: Number(response.headers.get('content-length') || 0) }
    },
    enabled: showTiles,
    staleTime: 120_000,
  })

  useEffect(() => {
    const firstFarm = farmsQuery.data?.[0]?.id
    if (firstFarm && !plotForm.farmId) {
      setPlotForm(current => ({ ...current, farmId: firstFarm }))
    }
  }, [farmsQuery.data, plotForm.farmId])

  const savePlotMutation = useMutation({
    mutationFn: async () => {
      const feature = selectedFeatureRef.current
      const geometry = feature?.getGeometry()
      if (!feature || !geometry) throw new Error('Select or draw a plot first.')
      if (!user?.tenant_id) throw new Error('Login is required to save plots.')
      if (!plotForm.farmId) throw new Error('Create or select a farm before saving a plot.')

      const geom_geojson = geoJson.writeGeometryObject(geometry, {
        featureProjection: 'EPSG:3857',
        dataProjection: 'EPSG:4326',
      }) as any

      const existingId = feature.get('id') as string | undefined
      const isRealExisting = existingId && !existingId.startsWith('demo-') && !existingId.startsWith('new-')
      if (isRealExisting) {
        return updatePlot(existingId, {
          name: plotForm.name || 'Untitled plot',
          description: plotForm.description,
          crop_type: plotForm.crop,
          geom_geojson,
        } as any)
      }

      return createPlot({
        tenant_id: user.tenant_id,
        farm_id: plotForm.farmId,
        name: plotForm.name || 'Untitled plot',
        description: plotForm.description,
        crop_type: plotForm.crop,
        geom_geojson,
      })
    },
    onSuccess: async () => {
      setMapMessage('Plot saved.')
      await queryClient.invalidateQueries({ queryKey: ['map', 'plots'] })
      await queryClient.invalidateQueries({ queryKey: ['plots'] })
    },
    onError: error => setMapMessage(error instanceof Error ? error.message : 'Could not save plot.'),
  })

  const createDefaultFarmMutation = useMutation({
    mutationFn: () => createFarm({ name: 'Primary Farm', country: 'NG', state: 'Benue', lga: 'Makurdi' }),
    onSuccess: async farm => {
      setPlotForm(current => ({ ...current, farmId: farm.id }))
      setMapMessage('Default farm created. You can now save plots.')
      await queryClient.invalidateQueries({ queryKey: ['map', 'farms'] })
      await queryClient.invalidateQueries({ queryKey: ['farms'] })
    },
    onError: error => setMapMessage(error instanceof Error ? error.message : 'Could not create farm.'),
  })

  const deletePlotMutation = useMutation({
    mutationFn: async () => {
      const id = selectedPlot?.id
      if (!id || id === '-' || id.startsWith('demo-') || id.startsWith('new-')) throw new Error('Only saved plots can be deleted.')
      return deletePlot(id)
    },
    onSuccess: async () => {
      setSelectedPlot(null)
      selectedFeatureRef.current = null
      setMapMessage('Plot deleted.')
      await queryClient.invalidateQueries({ queryKey: ['map', 'plots'] })
      await queryClient.invalidateQueries({ queryKey: ['plots'] })
    },
    onError: error => setMapMessage(error instanceof Error ? error.message : 'Could not delete plot.'),
  })

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const feature = selectedFeatureRef.current
      if (!feature) throw new Error('Select a plot first.')
      const [lng, lat] = getFeatureCenterLonLat(feature)
      return createTask({
        title: `Inspect ${plotForm.name || selectedPlot?.name || 'plot'}`,
        lat,
        lng,
        meta: { plot_id: selectedPlot?.id, crop_type: plotForm.crop },
      })
    },
    onSuccess: async () => {
      setMapMessage('Task created for selected plot.')
      await queryClient.invalidateQueries({ queryKey: ['map', 'tasks'] })
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: error => setMapMessage(error instanceof Error ? error.message : 'Could not create task.'),
  })

  const createReportMutation = useMutation({
    mutationFn: async () => {
      const feature = selectedFeatureRef.current
      if (!feature) throw new Error('Select a plot first.')
      const id = selectedPlot?.id
      if (!id || id.startsWith('demo-') || id.startsWith('new-')) throw new Error('Save the plot before attaching a report.')
      const [lng, lat] = getFeatureCenterLonLat(feature)
      return createObservation({
        plot_id: id,
        notes: `Field report for ${plotForm.name || selectedPlot?.name || 'plot'}`,
        metrics: { crop_type: plotForm.crop, source: 'map_panel' },
        lat,
        lng,
      })
    },
    onSuccess: () => setMapMessage('Report attached to selected plot.'),
    onError: error => setMapMessage(error instanceof Error ? error.message : 'Could not attach report.'),
  })

  async function focusDeviceLocation() {
    try {
      const location = await deviceLocation.requestLocation()
      const coordinates = fromLonLat([location.lng, location.lat])
      const marker = new Feature({
        geometry: new Point(coordinates),
        name: 'Current location',
      })
      deviceLocationSourceRef.current.clear()
      deviceLocationSourceRef.current.addFeature(marker)
      mapRef.current?.getView().animate({ center: coordinates, zoom: 16, duration: 450 })
      setMapMessage(`Device location found${location.accuracy ? ` within about ${Math.round(location.accuracy)}m` : ''}.`)
    } catch (error) {
      setMapMessage(error instanceof Error ? error.message : 'Could not read device location.')
    }
  }

  const baseLayers = useMemo(() => ({
    osm: new TileLayer({ source: new OSM(), visible: baseMap === 'osm' }),
    satellite: new TileLayer({
      source: new XYZ({ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' }),
      visible: baseMap === 'satellite',
    }),
  }), [])

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return

    const mvtFormat = new MVT()
    const vectorTiles = new VectorTileLayer({
      visible: showTiles,
      source: new VectorTileSource({
        format: mvtFormat,
        url: `${API_BASE}/tiles/{z}/{x}/{y}/plots`,
        tileLoadFunction: (tile: any, url) => {
          tile.setLoader((extent: unknown, _resolution: unknown, projection: unknown) => {
            const token = localStorage.getItem('bf_access_token')
            fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
              .then(response => response.ok ? response.arrayBuffer() : new ArrayBuffer(0))
              .then(data => {
                if (!data.byteLength) {
                  tile.setFeatures([])
                  return
                }
                const features = mvtFormat.readFeatures(data, { extent: extent as any, featureProjection: projection as any })
                tile.setFeatures(features)
              })
              .catch(() => tile.setFeatures([]))
          })
        },
      }),
      style: new Style({
        stroke: new Stroke({ color: '#0f2d1a', width: 1 }),
        fill: new Fill({ color: 'rgba(23, 63, 36, 0.16)' }),
      }),
    })

    const plotLayer = new VectorLayer({ source: plotSourceRef.current, style: plotStyle })
    const taskLayer = new VectorLayer({
      source: new Cluster({ distance: 42, source: taskSourceRef.current }),
      style: taskClusterStyle,
      visible: showTasks,
    })
    const heatLayer = new HeatmapLayer({
      source: heatSourceRef.current,
      blur: 22,
      radius: 12,
      weight: feature => Number(feature.get('weight') || 0.35),
      visible: showSensors,
    })
    const deviceLocationLayer = new VectorLayer({
      source: deviceLocationSourceRef.current,
      style: deviceLocationStyle,
    })
    tileLayerRef.current = vectorTiles
    taskLayerRef.current = taskLayer
    heatLayerRef.current = heatLayer

    const map = new Map({
      target: mapEl.current,
      controls: defaultControls({ attribution: false, zoom: true, rotate: false }),
      layers: [baseLayers.osm, baseLayers.satellite, vectorTiles, heatLayer, plotLayer, taskLayer, deviceLocationLayer],
      view: new View({
        center: fromLonLat([8.52, 7.73]),
        zoom: 8,
      }),
    })

    selectRef.current = new Select({ layers: [plotLayer] })
    selectRef.current.on('select', event => {
      const feature = event.selected[0] as Feature<Geometry> | undefined
      selectedFeatureRef.current = feature || null
      setSelectedPlot(feature ? {
        name: feature.get('name') || 'Plot',
        crop: feature.get('crop') || '-',
        area: feature.get('area') || '-',
        id: feature.get('id') || '-',
        farmId: feature.get('farmId') || '',
      } : null)
      setPlotForm(current => ({
        farmId: feature?.get('farmId') || current.farmId || farmsQuery.data?.[0]?.id || '',
        name: feature?.get('name') || '',
        crop: feature?.get('crop') || '',
        description: feature?.get('description') || '',
      }))
    })
    map.addInteraction(selectRef.current)

    mapRef.current = map
    setTimeout(() => map.updateSize(), 50)
    return () => {
      map.setTarget(undefined)
      mapRef.current = null
    }
  }, [baseLayers, farmsQuery.data, showSensors, showTasks, showTiles])

  useEffect(() => {
    baseLayers.osm.setVisible(baseMap === 'osm')
    baseLayers.satellite.setVisible(baseMap === 'satellite')
  }, [baseLayers, baseMap])

  useEffect(() => {
    plotSourceRef.current.clear()
    const plotData = plotsQuery.data || []
    const filteredPlots = focusedFarmId && plotsQuery.data?.length ? plotData.filter((plot: any) => plot.farm_id === focusedFarmId) : plotData
    const features = filteredPlots.map(plotToFeature).filter(Boolean) as Feature[]
    plotSourceRef.current.addFeatures(features)
    const map = mapRef.current
    if (map && features.length) {
      const target = focusedPlotId ? features.find(feature => feature.get('id') === focusedPlotId) : null
      const extent = target?.getGeometry()?.getExtent() || plotSourceRef.current.getExtent()
      if (extent && extent.every(Number.isFinite)) {
        map.getView().fit(extent, { padding: [48, 48, 48, 48], maxZoom: target ? 17 : 14, duration: 450 })
      }
      if (target) {
        selectedFeatureRef.current = target
        setSelectedPlot({
          id: target.get('id') || '-',
          farmId: target.get('farmId') || '',
          name: target.get('name') || 'Plot',
          crop: target.get('crop') || '-',
          area: target.get('area') || '-',
        })
        setPlotForm(current => ({
          ...current,
          farmId: target.get('farmId') || current.farmId,
          name: target.get('name') || '',
          crop: target.get('crop') || '',
          description: target.get('description') || '',
        }))
      }
    }
  }, [plotsQuery.data, focusedFarmId, focusedPlotId])

  useEffect(() => {
    taskSourceRef.current.clear()
    const taskData = tasksQuery.data || []
    const features = taskData
      .filter(task => task.location?.type === 'Point')
      .map(task => {
        const feature = geoJson.readFeature({
          type: 'Feature',
          geometry: task.location,
          properties: { name: task.name, status: task.status, kind: 'task' },
        }, { featureProjection: 'EPSG:3857' }) as Feature<Point>
        return feature
      })
    taskSourceRef.current.addFeatures(features)
  }, [tasksQuery.data])

  useEffect(() => {
    heatSourceRef.current.clear()
    const readingData = readingsQuery.data || []
    const features = readingData
      .filter(reading => reading.location?.type === 'Point')
      .map(reading => {
        const feature = geoJson.readFeature({
          type: 'Feature',
          geometry: reading.location,
          properties: { weight: Math.min(1, Math.max(0.1, Number(reading.value || 1) / 100)) },
        }, { featureProjection: 'EPSG:3857' }) as Feature<Point>
        return feature
      })
    heatSourceRef.current.addFeatures(features)
  }, [readingsQuery.data])

  useEffect(() => {
    tileLayerRef.current?.setVisible(showTiles)
  }, [showTiles])

  useEffect(() => {
    taskLayerRef.current?.setVisible(showTasks)
  }, [showTasks])

  useEffect(() => {
    heatLayerRef.current?.setVisible(showSensors)
  }, [showSensors])

  const selectedPlotAssets = useMemo(() => {
    const id = selectedPlot?.id
    if (!id || id.startsWith('demo-') || id.startsWith('new-')) return []
    return (assetsQuery.data || []).filter(asset => asset.plot_id === id)
  }, [assetsQuery.data, selectedPlot?.id])

  const selectedPlotAnimals = useMemo(() => {
    const id = selectedPlot?.id
    if (!id || id.startsWith('demo-') || id.startsWith('new-')) return []
    return (animalsQuery.data || []).filter(group => group.plot_id === id)
  }, [animalsQuery.data, selectedPlot?.id])

  function goTo(path: string) {
    navigate(tenantPath(path, tenantSlug))
  }

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (drawRef.current) map.removeInteraction(drawRef.current)
    if (modifyRef.current) map.removeInteraction(modifyRef.current)

    drawRef.current = null
    modifyRef.current = null

    if (mode === 'draw') {
      drawRef.current = new Draw({ source: plotSourceRef.current, type: 'Polygon' })
      drawRef.current.on('drawend', event => {
        const id = `new-${Date.now()}`
        event.feature.setProperties({
          id,
          name: 'New plot',
          crop: 'Crop',
          area: 'Unsaved',
          kind: 'plot',
        })
        selectedFeatureRef.current = event.feature as Feature<Geometry>
        setSelectedPlot({ id, name: 'New plot', crop: 'Crop', area: 'Unsaved' })
        setPlotForm(current => ({ ...current, name: 'New plot', crop: 'Crop' }))
        setMapMessage('Drawn plot is ready. Fill details and save it.')
      })
      map.addInteraction(drawRef.current)
    }

    if (mode === 'edit') {
      modifyRef.current = new Modify({ source: plotSourceRef.current })
      map.addInteraction(modifyRef.current)
    }
  }, [mode])

  return (
    <section className="farm-map-shell">
      <div className="map-toolbar" aria-label="Map controls">
        <div className="segmented">
          <button className={mode === 'select' ? 'active' : ''} onClick={() => setMode('select')} type="button">{t('select')}</button>
          <button className={mode === 'draw' ? 'active' : ''} onClick={() => setMode('draw')} type="button">{t('drawPlot')}</button>
          <button className={mode === 'edit' ? 'active' : ''} onClick={() => setMode('edit')} type="button">{t('editPlot')}</button>
        </div>
        <div className="segmented">
          <button className={baseMap === 'osm' ? 'active' : ''} onClick={() => setBaseMap('osm')} type="button">Street</button>
          <button className={baseMap === 'satellite' ? 'active' : ''} onClick={() => setBaseMap('satellite')} type="button">Satellite</button>
        </div>
        <label><input checked={showTiles} onChange={event => setShowTiles(event.target.checked)} type="checkbox" /> Tiles</label>
        <label><input checked={showSensors} onChange={event => setShowSensors(event.target.checked)} type="checkbox" /> Heatmap</label>
        <label><input checked={showTasks} onChange={event => setShowTasks(event.target.checked)} type="checkbox" /> Tasks</label>
        <button className="map-tool-button" type="button" onClick={focusDeviceLocation} disabled={deviceLocation.isLocating}>
          {deviceLocation.isLocating ? 'Reading GPS...' : 'My location'}
        </button>
      </div>

      <div className="map-workbench">
        <div ref={mapEl} className="farm-map-canvas" />
        <aside className="map-side-panel">
          <div className="panel-heading">
            <h2>{t('plotDetails')}</h2>
            <span>{tileProbeQuery.data?.ok ? 'Tiles ready' : `${plotsQuery.data?.length || 0} plots`}</span>
          </div>
          {selectedPlot ? (
            <>
              <div className="plot-detail-list">
                <label><span>Farm</span><select value={plotForm.farmId} onChange={event => setPlotForm(current => ({ ...current, farmId: event.target.value }))}>
                  <option value="">Select farm</option>
                  {(farmsQuery.data || []).map(farm => <option key={farm.id} value={farm.id}>{farm.name}</option>)}
                </select></label>
                {farmsQuery.data?.length === 0 ? (
                  <button className="secondary-action" type="button" onClick={() => createDefaultFarmMutation.mutate()} disabled={createDefaultFarmMutation.isPending}>
                    {createDefaultFarmMutation.isPending ? 'Creating farm...' : 'Create default farm'}
                  </button>
                ) : null}
                <label><span>Name</span><input value={plotForm.name} onChange={event => setPlotForm(current => ({ ...current, name: event.target.value }))} /></label>
                <label><span>{t('crop')}</span><input value={plotForm.crop} onChange={event => setPlotForm(current => ({ ...current, crop: event.target.value }))} /></label>
                <label><span>Description</span><textarea value={plotForm.description} onChange={event => setPlotForm(current => ({ ...current, description: event.target.value }))} rows={3} /></label>
                <div><span>{t('area')}</span><strong>{selectedPlot.area}</strong></div>
                <div><span>ID</span><strong>{selectedPlot.id}</strong></div>
              </div>
              <div className="map-linked-records">
                <div>
                  <span>Assets on plot</span>
                  <strong>{selectedPlotAssets.length}</strong>
                  {selectedPlotAssets.slice(0, 3).map(asset => <small key={asset.id}>{asset.name} · {asset.asset_type}</small>)}
                </div>
                <div>
                  <span>Animal groups</span>
                  <strong>{selectedPlotAnimals.length}</strong>
                  {selectedPlotAnimals.slice(0, 3).map(group => <small key={group.id}>{group.name} · {group.count}</small>)}
                </div>
              </div>
            </>
          ) : (
            <p className="panel-copy">Select a plot or draw a new polygon to inspect actions, crop labels, area, and telemetry context.</p>
          )}
          {mapMessage ? <div className="map-message">{mapMessage}</div> : null}
          <div className="map-actions">
            <button className="primary-action" type="button" onClick={() => savePlotMutation.mutate()} disabled={savePlotMutation.isPending}>
              {savePlotMutation.isPending ? 'Saving...' : 'Save plot'}
            </button>
            <button className="secondary-action" type="button" onClick={() => createTaskMutation.mutate()} disabled={!selectedPlot || createTaskMutation.isPending}>
              Create task
            </button>
            <button className="secondary-action" type="button" onClick={() => createReportMutation.mutate()} disabled={!selectedPlot || createReportMutation.isPending}>
              Attach report
            </button>
            <button className="secondary-action" type="button" onClick={() => goTo('/assets')} disabled={!selectedPlot}>
              Manage assets
            </button>
            <button className="secondary-action" type="button" onClick={() => goTo('/farm-plans')} disabled={!selectedPlot}>
              Plan activities
            </button>
            <button className="danger-action" type="button" onClick={() => deletePlotMutation.mutate()} disabled={!selectedPlot || deletePlotMutation.isPending}>
              Delete plot
            </button>
          </div>
        </aside>
      </div>
    </section>
  )
}

function getFeatureCenterLonLat(feature: Feature<Geometry>) {
  const geometry = feature.getGeometry()
  if (geometry instanceof Polygon) {
    return toLonLat(geometry.getInteriorPoint().getCoordinates())
  }
  const extent = geometry?.getExtent()
  if (!extent) return [8.52, 7.73]
  return toLonLat([(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2])
}

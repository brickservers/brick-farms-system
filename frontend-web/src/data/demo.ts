export const demoPlots = [
  { name: 'Cassava North', crop: 'Cassava', variety: 'TMS 30572', area: '12.8 ha', status: 'Healthy' },
  { name: 'Rice Basin', crop: 'Rice', variety: 'FARO 44', area: '8.4 ha', status: 'Irrigation due' },
  { name: 'Maize Block C', crop: 'Maize', variety: 'SAMMAZ 52', area: '16.1 ha', status: 'Scout today' },
]

export const demoTasks = [
  { name: 'Inspect cassava ridges', owner: 'Agronomist', status: 'Due today' },
  { name: 'Upload sensor calibration photos', owner: 'Field team', status: 'Open' },
  { name: 'Approve investor report', owner: 'Owner', status: 'Review' },
]

export const demoSensors = [
  { name: 'Soil moisture A1', metric: '31%', status: 'Online' },
  { name: 'Rain gauge West', metric: '4 mm', status: 'Online' },
  { name: 'Temperature C2', metric: '29 C', status: 'Check battery' },
]

export const demoMapPlots = [
  {
    id: 'demo-plot-cassava',
    tenant_id: 'demo',
    farm_id: 'demo-farm',
    name: 'Cassava North',
    crop_type: 'Cassava / TMS 30572',
    area_ha: 12.8,
    geom_geojson: {
      type: 'Polygon',
      coordinates: [[
        [8.47, 7.78],
        [8.55, 7.78],
        [8.56, 7.72],
        [8.49, 7.70],
        [8.47, 7.78],
      ]],
    },
  },
  {
    id: 'demo-plot-rice',
    tenant_id: 'demo',
    farm_id: 'demo-farm',
    name: 'Rice Basin',
    crop_type: 'Rice / FARO 44',
    area_ha: 8.4,
    geom_geojson: {
      type: 'Polygon',
      coordinates: [[
        [8.58, 7.76],
        [8.64, 7.75],
        [8.65, 7.70],
        [8.59, 7.69],
        [8.58, 7.76],
      ]],
    },
  },
]

export const demoMapTasks = [
  { id: 'demo-task-1', name: 'Scout cassava ridges', status: 'pending', location: { type: 'Point', coordinates: [8.52, 7.74] } },
  { id: 'demo-task-2', name: 'Check rice inlet', status: 'in_progress', location: { type: 'Point', coordinates: [8.62, 7.72] } },
  { id: 'demo-task-3', name: 'Collect pest photo', status: 'pending', location: { type: 'Point', coordinates: [8.53, 7.76] } },
]

export const demoMapReadings = [
  { id: 'demo-reading-1', device_id: 'demo-device-1', metric: 'moisture', value: 31, unit: '%', location: { type: 'Point', coordinates: [8.51, 7.74] } },
  { id: 'demo-reading-2', device_id: 'demo-device-2', metric: 'moisture', value: 72, unit: '%', location: { type: 'Point', coordinates: [8.62, 7.72] } },
  { id: 'demo-reading-3', device_id: 'demo-device-3', metric: 'temperature', value: 42, unit: 'C', location: { type: 'Point', coordinates: [8.55, 7.71] } },
]

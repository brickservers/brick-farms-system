import api from './client'

export type GeoJsonGeometry = {
  type: string
  coordinates: unknown
}

export type Plot = {
  id: string
  tenant_id: string
  farm_id: string
  name: string
  description?: string | null
  crop_type?: string | null
  area_ha?: number | null
  geom_geojson?: GeoJsonGeometry | null
  created_at?: string
  updated_at?: string
}

export type Task = {
  id: string
  farm_id?: string | null
  name: string
  description?: string | null
  status?: string
  assignee_id?: string | null
  worker_id?: string | null
  worker_name?: string | null
  due_at?: string | null
  location?: GeoJsonGeometry | null
}

export type WorkerStatus = 'active' | 'on_leave' | 'inactive'

export type FarmWorker = {
  id: string
  tenant_id: string
  farm_id?: string | null
  farm_name?: string | null
  full_name: string
  role: string
  phone?: string | null
  email?: string | null
  status: WorkerStatus
  hourly_rate?: number | null
  currency: string
  hired_at?: string | null
  emergency_contact?: string | null
  skills: string[]
  notes?: string | null
  open_tasks?: number
  created_at?: string
  updated_at?: string
}

export type SensorDevice = {
  id: string
  farm_id?: string | null
  plot_id?: string | null
  name: string
  protocol: string
  api_key?: string
}

export type SensorReading = {
  id: string
  device_id: string
  metric: string
  value: number
  unit?: string | null
  timestamp?: string
  location?: GeoJsonGeometry | null
}

export type Farm = {
  id: string
  tenant_id: string
  name: string
  country?: string
  state?: string
  lga?: string
  farm_type?: 'crop' | 'animal' | 'mixed' | string
}

export type TenantProfile = {
  id: string
  name: string
  plan: 'free' | 'growth' | 'enterprise' | 'demo' | string
  user_name?: string | null
  user_email?: string | null
  limits?: Record<string, number | 'unlimited'>
}

export type TeamRole = 'owner' | 'admin' | 'agronomist' | 'field_worker' | 'accountant' | 'investor' | 'auditor' | 'gov_viewer'

export type TeamUser = {
  id: string
  tenant_id: string
  email: string
  role: TeamRole
  is_active: boolean
}

export type PlotCreatePayload = {
  tenant_id: string
  farm_id: string
  name: string
  description?: string | null
  crop_type?: string | null
  geom_geojson: GeoJsonGeometry
}

export type TaskCreatePayload = {
  title: string
  worker_id?: string
  lat?: number
  lng?: number
  due_at?: string
  meta?: Record<string, unknown>
}

export type FarmWorkerPayload = {
  farm_id?: string | null
  full_name: string
  role?: string
  phone?: string | null
  email?: string | null
  status?: WorkerStatus
  hourly_rate?: number | null
  currency?: string
  hired_at?: string | null
  emergency_contact?: string | null
  skills?: string[]
  notes?: string | null
}

export type FarmAsset = {
  id: string
  tenant_id: string
  farm_id: string
  farm_name?: string | null
  plot_id?: string | null
  plot_name?: string | null
  name: string
  asset_type: string
  status: string
  quantity: number
  unit?: string | null
  value?: number | null
  currency: string
  acquired_at?: string | null
  location_note?: string | null
  meta?: Record<string, unknown>
}

export type AnimalGroup = {
  id: string
  tenant_id: string
  farm_id: string
  farm_name?: string | null
  plot_id?: string | null
  plot_name?: string | null
  name: string
  species: string
  breed?: string | null
  count: number
  age_value?: number | null
  age_unit?: string | null
  sex?: string | null
  health_status?: string | null
  purpose?: string | null
  housing_asset_id?: string | null
  housing_asset_name?: string | null
  meta?: Record<string, unknown>
}

export type TeamUserPayload = {
  email: string
  password: string
  role: TeamRole
}

export type ObservationCreatePayload = {
  plot_id?: string
  task_id?: string
  notes?: string
  metrics?: Record<string, unknown>
  lat?: number
  lng?: number
}

export type SensorDeviceCreatePayload = {
  farm_id: string
  plot_id?: string | null
  name: string
  protocol: string
  api_key: string
}

export type InvestmentCreatePayload = {
  name: string
  amount: number
  currency?: string
  meta?: Record<string, unknown>
}

export type PayoutCreatePayload = {
  investment_id: string
  amount: number
  currency?: string
  note?: string
}

export type FarmPlan = {
  id: string
  tenant_id: string
  farm_id?: string | null
  farm_name?: string | null
  name: string
  plan_type: string
  scope_type: string
  period_type: string
  starts_on?: string | null
  ends_on?: string | null
  status: string
  notes?: string | null
  activity_count?: number
}

export type FarmPlanActivity = {
  id: string
  plan_id: string
  farm_id?: string | null
  farm_name?: string | null
  plot_id?: string | null
  plot_name?: string | null
  animal_group_id?: string | null
  animal_group_name?: string | null
  crop?: string | null
  title: string
  description?: string | null
  activity_type?: string | null
  starts_on?: string | null
  due_on?: string | null
  repeat_rule?: string | null
  worker_role?: string | null
  estimated_cost?: number | null
  priority?: string | null
  task_id?: string | null
}

export function listFarms(): Promise<Farm[]> {
  return api.get('/farms')
}

export function getTenantProfile(): Promise<TenantProfile> {
  return api.get('/tenants/me')
}

export function listTeamUsers(): Promise<TeamUser[]> {
  return api.get('/team')
}

export function createTeamUser(payload: TeamUserPayload): Promise<TeamUser> {
  return api.post('/team', payload)
}

export function updateTeamUser(userId: string, payload: Partial<Pick<TeamUser, 'role' | 'is_active'>>): Promise<TeamUser> {
  return api.patch(`/team/${userId}`, payload)
}

export function deactivateTeamUser(userId: string): Promise<TeamUser> {
  return api.del(`/team/${userId}`)
}

export function createFarm(payload: { name: string; country: string; state?: string; lga?: string; farm_type?: string }): Promise<Farm> {
  return api.post('/farms', payload)
}

export function listPlots(): Promise<Plot[]> {
  return api.get('/plots')
}

export function createPlot(payload: PlotCreatePayload): Promise<Plot> {
  return api.post('/plots', payload)
}

export function updatePlot(plotId: string, payload: Partial<Plot>) {
  return api.put(`/plots/${plotId}`, payload)
}

export function deletePlot(plotId: string) {
  return api.del(`/plots/${plotId}`)
}

export function listTasks(): Promise<Task[]> {
  return api.get('/tasks')
}

export function createTask(payload: TaskCreatePayload) {
  return api.post('/tasks', payload)
}

export function listFarmPlans(): Promise<FarmPlan[]> {
  return api.get('/farm-plans')
}

export function createFarmPlan(payload: Partial<FarmPlan> & { name: string }) {
  return api.post('/farm-plans', payload)
}

export function listFarmPlanActivities(planId: string): Promise<FarmPlanActivity[]> {
  return api.get(`/farm-plans/${planId}/activities`)
}

export function createFarmPlanActivity(planId: string, payload: Partial<FarmPlanActivity> & { title: string; create_task?: boolean }) {
  return api.post(`/farm-plans/${planId}/activities`, payload)
}

export function downloadFarmPlanTemplate() {
  return api.download('/farm-plans/template.csv')
}

export function uploadFarmPlanTemplate(file: File) {
  const data = new FormData()
  data.append('file', file)
  return api.upload('/farm-plans/upload', data)
}

export function listWorkers(filters: { status?: WorkerStatus | 'all'; farm_id?: string; search?: string } = {}): Promise<FarmWorker[]> {
  const params = new URLSearchParams()
  if (filters.status && filters.status !== 'all') params.set('status', filters.status)
  if (filters.farm_id) params.set('farm_id', filters.farm_id)
  if (filters.search) params.set('search', filters.search)
  const query = params.toString()
  return api.get(`/workers${query ? `?${query}` : ''}`)
}

export function createWorker(payload: FarmWorkerPayload): Promise<FarmWorker> {
  return api.post('/workers', payload)
}

export function updateWorker(workerId: string, payload: Partial<FarmWorkerPayload>): Promise<FarmWorker> {
  return api.put(`/workers/${workerId}`, payload)
}

export function deactivateWorker(workerId: string): Promise<{ id: string; status: WorkerStatus }> {
  return api.del(`/workers/${workerId}`)
}

export function listAssets(filters: { farm_id?: string; plot_id?: string; asset_type?: string } = {}): Promise<FarmAsset[]> {
  const params = new URLSearchParams()
  if (filters.farm_id) params.set('farm_id', filters.farm_id)
  if (filters.plot_id) params.set('plot_id', filters.plot_id)
  if (filters.asset_type) params.set('asset_type', filters.asset_type)
  const query = params.toString()
  return api.get(`/assets${query ? `?${query}` : ''}`)
}

export function createAsset(payload: Partial<FarmAsset> & { farm_id: string; name: string; asset_type: string }) {
  return api.post('/assets', payload)
}

export function listAnimalGroups(filters: { farm_id?: string; plot_id?: string } = {}): Promise<AnimalGroup[]> {
  const params = new URLSearchParams()
  if (filters.farm_id) params.set('farm_id', filters.farm_id)
  if (filters.plot_id) params.set('plot_id', filters.plot_id)
  const query = params.toString()
  return api.get(`/assets/animals${query ? `?${query}` : ''}`)
}

export function createAnimalGroup(payload: Partial<AnimalGroup> & { farm_id: string; name: string; species: string; count: number }) {
  return api.post('/assets/animals', payload)
}

export function createObservation(payload: ObservationCreatePayload) {
  return api.post('/observations', payload)
}

export function listSensorDevices(): Promise<SensorDevice[]> {
  return api.get('/sensors/devices')
}

export function createSensorDevice(payload: SensorDeviceCreatePayload): Promise<SensorDevice> {
  return api.post('/sensors/devices', payload)
}

export function listSensorReadings(metric?: string): Promise<SensorReading[]> {
  const query = metric ? `?metric=${encodeURIComponent(metric)}` : ''
  return api.get(`/sensors/readings/query${query}`)
}

export function getForecast() {
  return api.get('/reports/forecast')
}

export function getActivitySummary() {
  return api.get('/reports/activity')
}

export function getCarbonMetrics() {
  return api.get('/reports/carbon')
}

export function createInvestment(payload: InvestmentCreatePayload) {
  return api.post('/finance/investments', payload)
}

export function createPayout(payload: PayoutCreatePayload) {
  return api.post('/finance/payouts', payload)
}

export function getInvestmentRoi(investmentId: string) {
  return api.get(`/finance/investments/${investmentId}/roi`)
}

export function listInvestments() {
  return api.get('/finance/investments')
}

export function listPayouts() {
  return api.get('/finance/payouts')
}

export function listTransactions() {
  return api.get('/finance/transactions')
}

export function downloadReport(format: 'csv' | 'pdf') {
  return api.download(`/reports/export.${format}`)
}

export function listPreferences(): Promise<Array<{ id?: number; key: string; value: Record<string, unknown> }>> {
  return api.get('/preferences')
}

export function savePreference(key: string, value: Record<string, unknown>) {
  return api.put(`/preferences/${encodeURIComponent(key)}`, { key, value })
}

export function startPlanCheckout(plan: 'sprout' | 'growth' | 'enterprise') {
  return api.post('/payments/checkout', { plan })
}

export function verifyPlanPayment(payload: { tx_ref?: string; charge_id?: string }) {
  return api.post('/payments/verify', payload)
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { getTenantProfile, listPreferences, savePreference, startPlanCheckout } from '../api/farm'
import PageHeader from '../components/ui/PageHeader'
import { useLanguage } from '../contexts/LanguageContext'
import { languages } from '../i18n/languages'
import { usePlan } from '../contexts/PlanContext'

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { language, setLanguage } = useLanguage()
  const { mode } = usePlan()
  const [offlineCache, setOfflineCache] = useState(true)
  const [measurementSystem, setMeasurementSystem] = useState('metric')
  const [defaultMapLayer, setDefaultMapLayer] = useState('street')
  const [notifications, setNotifications] = useState({ email: true, sms: false, task: true, sensor: true })
  const [message, setMessage] = useState<string | null>(null)
  const preferencesQuery = useQuery({ queryKey: ['preferences'], queryFn: listPreferences })
  const tenantQuery = useQuery({ queryKey: ['tenant-profile'], queryFn: getTenantProfile })
  const currentLimits = tenantQuery.data?.limits

  const saveMutation = useMutation({
    mutationFn: async () => {
      await savePreference('workspace', { language, planMode: mode, offlineCache, measurementSystem })
      await savePreference('notifications', notifications)
      return savePreference('map', { defaultLayer: defaultMapLayer, heatmap: true, taskClusters: true })
    },
    onSuccess: async () => {
      setMessage('Preferences saved.')
      await queryClient.invalidateQueries({ queryKey: ['preferences'] })
    },
    onError: error => setMessage(error instanceof Error ? error.message : 'Could not save preferences.'),
  })

  const checkoutMutation = useMutation({
    mutationFn: startPlanCheckout,
    onSuccess: (result: any) => {
      if (result.checkout_url) {
        window.location.href = result.checkout_url
        return
      }
      setMessage('Checkout was created, but Flutterwave did not return a redirect URL. Verify the payment gateway configuration.')
    },
    onError: error => setMessage(error instanceof Error ? error.message : 'Could not start checkout.'),
  })

  return (
    <div className="page-stack">
      <PageHeader title="Settings" description="Tenant preferences, language, plan mode, offline behavior, and user defaults." />
      <section className="panel settings-panel">
        <label>
          <span>Language</span>
          <select value={language} onChange={event => setLanguage(event.target.value as typeof language)}>
            {languages.map(item => <option value={item.code} key={item.code}>{item.label}</option>)}
          </select>
        </label>
        <div className="plan-upgrade-panel">
          <span>Current plan</span>
          <strong>{tenantQuery.data?.plan || mode}</strong>
          <p>Choose a paid plan to start Flutterwave checkout. Your plan changes only after payment verification succeeds.</p>
          <div className="plan-card-grid">
            <div><strong>Free</strong><span>Free</span><small>1 farm, 1 user, 1 plot, 0 sensors</small></div>
            <div><strong>Sprout</strong><span>NGN 4,000/mo</span><small>1 farm, 4 plots, 4 sensors, 4 users</small><button className="secondary-action" type="button" disabled={checkoutMutation.isPending} onClick={() => checkoutMutation.mutate('sprout')}>Upgrade</button></div>
            <div><strong>Growth</strong><span>NGN 10,000/mo</span><small>2 farms, 10 plots, 5 sensors, 10 users/workers</small><button className="secondary-action" type="button" disabled={checkoutMutation.isPending} onClick={() => checkoutMutation.mutate('growth')}>Upgrade</button></div>
            <div><strong>Enterprise</strong><span>NGN 50,000/mo</span><small>Unlimited, branded workspace</small><button className="secondary-action" type="button" disabled={checkoutMutation.isPending} onClick={() => checkoutMutation.mutate('enterprise')}>Upgrade</button></div>
          </div>
          {currentLimits ? (
            <div className="current-limit-grid">
              {Object.entries(currentLimits).map(([key, value]) => (
                <div key={key}><span>{key}</span><strong>{value}</strong></div>
              ))}
            </div>
          ) : null}
        </div>
        <label>
          <span>Measurement system</span>
          <select value={measurementSystem} onChange={event => setMeasurementSystem(event.target.value)}>
            <option value="metric">Metric</option>
            <option value="imperial">Imperial</option>
          </select>
        </label>
        <label>
          <span>Default map layer</span>
          <select value={defaultMapLayer} onChange={event => setDefaultMapLayer(event.target.value)}>
            <option value="street">Street</option>
            <option value="satellite">Satellite</option>
          </select>
        </label>
        <label className="check-row">
          <input checked={offlineCache} onChange={event => setOfflineCache(event.target.checked)} type="checkbox" />
          <span>Cache recent workspace data for offline use</span>
        </label>
        <label className="check-row"><input checked={notifications.email} onChange={event => setNotifications(current => ({ ...current, email: event.target.checked }))} type="checkbox" /><span>Email notifications</span></label>
        <label className="check-row"><input checked={notifications.sms} onChange={event => setNotifications(current => ({ ...current, sms: event.target.checked }))} type="checkbox" /><span>SMS notifications when gateway is enabled</span></label>
        <label className="check-row"><input checked={notifications.task} onChange={event => setNotifications(current => ({ ...current, task: event.target.checked }))} type="checkbox" /><span>Task assignment alerts</span></label>
        <label className="check-row"><input checked={notifications.sensor} onChange={event => setNotifications(current => ({ ...current, sensor: event.target.checked }))} type="checkbox" /><span>Sensor reading alerts</span></label>
        <button className="primary-action" type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving...' : 'Save preferences'}
        </button>
        {message ? <div className="form-note">{message}</div> : null}
        <div className="preference-list">
          <strong>Saved preferences</strong>
          {(preferencesQuery.data || []).map(item => (
            <div key={item.key}><span>{item.key}</span><code>{JSON.stringify(item.value)}</code></div>
          ))}
          {preferencesQuery.data?.length === 0 ? <p className="empty-state">No saved preferences yet.</p> : null}
        </div>
      </section>
    </div>
  )
}

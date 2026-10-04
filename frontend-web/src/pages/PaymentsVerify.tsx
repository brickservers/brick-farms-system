import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { verifyPlanPayment } from '../api/farm'
import { useToast } from '../contexts/ToastContext'

export default function PaymentsVerify() {
  const [searchParams] = useSearchParams()
  const [message, setMessage] = useState<string | null>(null)
  const nav = useNavigate()
  const { showToast } = useToast()

  useEffect(() => {
    const tx_ref = searchParams.get('tx_ref') || searchParams.get('txRef') || undefined
    const charge_id = searchParams.get('charge_id') || undefined
    if (!tx_ref && !charge_id) {
      showToast({ type: 'error', message: 'No payment reference found.' })
      setMessage('No payment reference found.')
      return
    }
    setMessage('Verifying payment...')
    verifyPlanPayment({ tx_ref, charge_id }).then((res:any) => {
      if (res?.verified) {
        showToast({ type: 'success', message: 'Payment verified. Plan updated.' })
        setMessage('Payment verified. Plan updated.')
        setTimeout(() => nav('/settings', { replace: true }), 1400)
        return
      }
      showToast({ type: 'info', message: `Verification status: ${res?.status || 'unknown'}` })
      setMessage(`Verification status: ${res?.status || 'unknown'}`)
    }).catch(err => {
      showToast({ type: 'error', message: err?.message || 'Verification failed' })
      setMessage(err?.message || 'Verification failed')
    })
  }, [searchParams, nav])

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-heading"><h2>Payment verification</h2><span>Confirming checkout</span></div>
        <div className="panel-copy">{message || 'Preparing...'}</div>
      </section>
    </div>
  )
}

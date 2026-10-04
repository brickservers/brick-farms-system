import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createInvestment, createPayout, getInvestmentRoi, listInvestments, listPayouts, listTransactions } from '../api/farm'
import PageHeader from '../components/ui/PageHeader'
import StatTile from '../components/ui/StatTile'
import { useToast } from '../contexts/ToastContext'

export default function FinancePage() {
  const queryClient = useQueryClient()
  const [investmentForm, setInvestmentForm] = useState({ name: '', amount: '', currency: 'NGN' })
  const [payoutForm, setPayoutForm] = useState({ investmentId: '', amount: '', note: '', currency: 'NGN' })
  const [roiId, setRoiId] = useState('')
  const { showToast } = useToast()
  const [roi, setRoi] = useState<any>(null)
  const investmentsQuery = useQuery({ queryKey: ['investments'], queryFn: listInvestments })
  const payoutsQuery = useQuery({ queryKey: ['payouts'], queryFn: listPayouts })
  const transactionsQuery = useQuery({ queryKey: ['transactions'], queryFn: listTransactions })
  const investments = (investmentsQuery.data || []) as any[]
  const payouts = (payoutsQuery.data || []) as any[]
  const transactions = (transactionsQuery.data || []) as any[]
  const investedTotal = investments.reduce((total, item) => total + Number(item.amount || 0), 0)
  const payoutTotal = payouts.reduce((total, item) => total + Number(item.amount || 0), 0)
  const portfolioRoi = investedTotal > 0 ? (payoutTotal / investedTotal) * 100 : null

  const investmentMutation = useMutation({
    mutationFn: () => createInvestment({
      name: investmentForm.name.trim(),
      amount: Number(investmentForm.amount),
      currency: investmentForm.currency,
      meta: { source: 'finance_page' },
    }),
    onSuccess: async (investment: any) => {
      showToast({ type: 'success', message: `Investment created: ${investment.id}` })
      setInvestmentForm({ name: '', amount: '', currency: 'NGN' })
      setPayoutForm(current => ({ ...current, investmentId: investment.id }))
      setRoiId(investment.id)
      await queryClient.invalidateQueries({ queryKey: ['investments'] })
    },
    onError: error => showToast({ type: 'error', message: error instanceof Error ? error.message : 'Could not create investment.' }),
  })

  const payoutMutation = useMutation({
    mutationFn: () => createPayout({
      investment_id: payoutForm.investmentId.trim(),
      amount: Number(payoutForm.amount),
      currency: payoutForm.currency,
      note: payoutForm.note.trim() || undefined,
    }),
    onSuccess: async () => {
      showToast({ type: 'success', message: 'Payout created.' })
      setPayoutForm(current => ({ ...current, amount: '', note: '' }))
      await queryClient.invalidateQueries({ queryKey: ['payouts'] })
    },
    onError: error => showToast({ type: 'error', message: error instanceof Error ? error.message : 'Could not create payout.' }),
  })

  const roiMutation = useMutation({
    mutationFn: () => getInvestmentRoi(roiId.trim()),
    onSuccess: data => {
      setRoi(data)
      showToast({ type: 'success', message: 'ROI loaded.' })
    },
    onError: error => showToast({ type: 'error', message: error instanceof Error ? error.message : 'Could not load ROI.' }),
  })

  function submitInvestment(event: React.FormEvent) {
    event.preventDefault()
    if (!investmentForm.name.trim() || !investmentForm.amount) {
      showToast({ type: 'error', message: 'Investment name and amount are required.' })
      return
    }
    investmentMutation.mutate()
  }

  function submitPayout(event: React.FormEvent) {
    event.preventDefault()
    if (!payoutForm.investmentId.trim() || !payoutForm.amount) {
      showToast({ type: 'error', message: 'Investment ID and payout amount are required.' })
      return
    }
    payoutMutation.mutate()
  }

  return (
    <div className="page-stack">
      <PageHeader title="Finance" description="Track inputs, receipts, investor funds, payouts, and ROI by farm or season." />
      <div className="stat-grid">
        <StatTile label="Investments" value={`N ${investedTotal.toLocaleString()}`} detail={`${investments.length} records`} tone="brown" />
        <StatTile label="Payouts" value={`N ${payoutTotal.toLocaleString()}`} detail={`${payouts.length} records`} tone="green" />
        <StatTile label="Portfolio ROI" value={portfolioRoi == null ? '0%' : `${portfolioRoi.toFixed(2)}%`} detail="Payouts / capital" tone="ink" />
        <StatTile label="Ledger rows" value={String(transactions.length)} detail="Recent transactions" tone="white" />
      </div>
      <section className="finance-grid">
        <div className="panel">
          <div className="panel-heading">
            <h2>New investment</h2>
            <span>Investor capital</span>
          </div>
          <form className="entity-form finance-form" onSubmit={submitInvestment}>
            <label><span>Name</span><input value={investmentForm.name} onChange={event => setInvestmentForm(current => ({ ...current, name: event.target.value }))} placeholder="Dry season rice fund" /></label>
            <label><span>Amount</span><input value={investmentForm.amount} onChange={event => setInvestmentForm(current => ({ ...current, amount: event.target.value }))} inputMode="decimal" /></label>
            <label><span>Currency</span><input value={investmentForm.currency} onChange={event => setInvestmentForm(current => ({ ...current, currency: event.target.value.toUpperCase() }))} /></label>
            <button className="primary-action" type="submit" disabled={investmentMutation.isPending}>{investmentMutation.isPending ? 'Creating...' : 'Create'}</button>
          </form>
        </div>
        <div className="panel finance-action-panel">
          <div className="panel-heading">
            <h2>Payout and ROI</h2>
            <span>Investor view</span>
          </div>
          <div className="finance-subpanel">
            <h3>Post payout</h3>
            <p>Record investor or partner payouts against an investment record.</p>
            <form className="entity-form payout-form" onSubmit={submitPayout}>
              <label><span>Investment ID</span><input value={payoutForm.investmentId} onChange={event => setPayoutForm(current => ({ ...current, investmentId: event.target.value }))} /></label>
              <label><span>Amount</span><input value={payoutForm.amount} onChange={event => setPayoutForm(current => ({ ...current, amount: event.target.value }))} inputMode="decimal" /></label>
              <label><span>Note</span><input value={payoutForm.note} onChange={event => setPayoutForm(current => ({ ...current, note: event.target.value }))} /></label>
              <button className="secondary-action" type="submit" disabled={payoutMutation.isPending}>{payoutMutation.isPending ? 'Posting...' : 'Post payout'}</button>
            </form>
          </div>
          <div className="finance-subpanel">
            <h3>ROI lookup</h3>
            <p>Check total payouts and return for any investment ID.</p>
            <div className="roi-tools">
              <input value={roiId} onChange={event => setRoiId(event.target.value)} placeholder="Investment ID for ROI" />
              <button className="secondary-action" type="button" onClick={() => roiMutation.mutate()} disabled={roiMutation.isPending || !roiId.trim()}>
                {roiMutation.isPending ? 'Loading...' : 'Check ROI'}
              </button>
            </div>
            {roi ? <div className="form-note">ROI: {roi.roi == null ? 'No payout yet' : `${(Number(roi.roi) * 100).toFixed(2)}%`} · Total payout: {String(roi.total_payout)}</div> : null}
          </div>
        </div>
      </section>
      {/* global toasts are used for feedback */}
      <section className="panel">
        <div className="panel-heading">
          <h2>Ledger</h2>
          <span>Recent transactions</span>
        </div>
        <div className="data-table">
          <div className="table-row table-head"><span>ID</span><span>Account</span><span>Amount</span><span>Currency</span><span>When</span></div>
          {transactions.map((tx: any) => (
            <div className="table-row" key={tx.id}>
              <span>{String(tx.id).slice(0,8)}</span>
              <span>{String(tx.account_id).slice(0,8)}</span>
              <span>{tx.amount}</span>
              <span>{tx.currency}</span>
              <span>{tx.ts ? new Date(tx.ts).toLocaleString() : '-'}</span>
            </div>
          ))}
          {(transactionsQuery.isLoading && transactions.length === 0) ? <p className="empty-state">Loading transactions...</p> : null}
          {(!transactionsQuery.isLoading && transactions.length === 0) ? <p className="empty-state">No transactions yet.</p> : null}
        </div>
      </section>
    </div>
  )
}

import React from 'react'

type StatTileProps = {
  label: string
  value: string
  detail?: string
  tone?: 'green' | 'brown' | 'ink' | 'white'
}

export default function StatTile({ label, value, detail, tone = 'green' }: StatTileProps) {
  return (
    <section className={`stat-tile stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </section>
  )
}

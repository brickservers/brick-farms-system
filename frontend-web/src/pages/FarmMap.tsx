import FarmMapModule from '../components/map/FarmMapModule'
import PageHeader from '../components/ui/PageHeader'
import { useLanguage } from '../contexts/LanguageContext'

export default function FarmMapPage() {
  const { t } = useLanguage()
  return (
    <div className="page-stack map-page">
      <PageHeader
        title={t('fieldMap')}
        description="Operate farm geography, plot edits, sensor readings, task locations, and tile-backed layers in one workspace."
      />
      <FarmMapModule />
    </div>
  )
}

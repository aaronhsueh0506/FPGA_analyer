import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { versionInfo } from '../mock/data'

interface Props {
  open: boolean
  onClose: () => void
}

export default function VersionModal({ open, onClose }: Props) {
  const { t } = useTranslation()
  if (!open) return null

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{t('version.title')}</h3>
        <div className="modal-row">
          <span className="label">{t('version.systemLabel')}</span>
          <span className="value">{versionInfo.system}</span>
        </div>
        <div className="modal-row">
          <span className="label">{t('version.versionLabel')}</span>
          <span className="value">{versionInfo.version}</span>
        </div>
        <div className="modal-row">
          <span className="label">{t('version.dateLabel')}</span>
          <span className="value">{versionInfo.releaseDate}</span>
        </div>
        <div className="modal-row">
          <span className="label">{t('version.authorLabel')}</span>
          <span className="value">{versionInfo.author}</span>
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>
            {t('version.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

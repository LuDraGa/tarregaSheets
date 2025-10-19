import type { PropsWithChildren } from 'react'
import type { ConversionCheck, ConversionChecks } from '@/types/upload'
import {
  buildFileUrl,
  resolveDetailText,
  statusStyles,
  conversionLabels,
} from './conversionPreviewHelpers'

interface ConversionPreviewCardProps extends PropsWithChildren {
  conversionKey: keyof ConversionChecks
  check: ConversionCheck
  downloadFileId?: string | null
  downloadLabel?: string
  footerContent?: React.ReactNode
}

export default function ConversionPreviewCard({
  conversionKey,
  check,
  downloadFileId,
  downloadLabel,
  footerContent,
  children,
}: ConversionPreviewCardProps) {
  const variant = statusStyles[check.status] || statusStyles.pending
  const detailText = resolveDetailText(check)
  const fileUrl = buildFileUrl(downloadFileId ?? null)
  const { label, description } = conversionLabels[conversionKey]

  return (
    <div className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${variant.badge}`}
        >
          {variant.icon} {check.status}
        </span>
      </div>

      {check.duration_ms && (
        <p className="text-xs text-gray-500">
          Completed in {check.duration_ms.toLocaleString()} ms
        </p>
      )}

      {detailText && <p className={`text-sm ${variant.textClass}`}>{detailText}</p>}

      {children && <div className="border-t border-gray-100 pt-4">{children}</div>}

      {(fileUrl || footerContent) && (
        <div className="flex flex-wrap items-center gap-2">
          {fileUrl && downloadLabel && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-md border border-primary px-3 py-2 text-xs font-medium text-primary hover:bg-primary hover:text-white transition-colors"
            >
              {downloadLabel}
            </a>
          )}
          {footerContent}
        </div>
      )}
    </div>
  )
}

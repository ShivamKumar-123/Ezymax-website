import { CheckCircle, Clock, XCircle, ShieldCheck } from 'lucide-react'

const statusConfig = {
  pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20', label: 'Pending', desc: 'You have not submitted your KYC documents yet.' },
  submitted: { icon: Clock, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20', label: 'Under Review', desc: 'Your documents are being reviewed. This usually takes 1–2 business days.' },
  under_review: { icon: Clock, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20', label: 'Under Review', desc: 'Your documents are being reviewed. This usually takes 1–2 business days.' },
  approved: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20', label: 'Verified', desc: 'Your identity has been verified. You have full access.' },
  verified: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20', label: 'Verified', desc: 'Your identity has been verified. You have full access.' },
  rejected: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20', label: 'Rejected', desc: 'Your documents were not approved. Please re-submit with valid documents.' },
}

export default function KYCStatusBanner({ status }) {
  const cfg = statusConfig[status] || statusConfig.pending
  const Icon = cfg.icon

  return (
    <div className={`flex items-start gap-4 p-5 rounded-xl border ${cfg.bg} ${cfg.border}`}>
      <Icon className={`${cfg.color} shrink-0 mt-0.5`} size={24} />
      <div>
        <p className={`font-semibold ${cfg.color}`}>{cfg.label}</p>
        <p className="text-text-secondary text-sm mt-1">{cfg.desc}</p>
      </div>
    </div>
  )
}

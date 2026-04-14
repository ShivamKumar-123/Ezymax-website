import { Check } from 'lucide-react'

const steps = [
  { id: 1, label: 'Identity' },
  { id: 2, label: 'Address' },
  { id: 3, label: 'Review' },
]

export default function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, idx) => {
        const done = currentStep > step.id
        const active = currentStep === step.id
        return (
          <div key={step.id} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
              ${done ? 'bg-green-500 text-white' : active ? 'bg-primary-accent text-white' : 'bg-white/5 text-text-secondary border border-white/10'}`}>
              {done ? <Check size={14} /> : step.id}
            </div>
            <span className={`text-xs font-medium hidden sm:inline ${active ? 'text-text-primary' : 'text-text-secondary'}`}>
              {step.label}
            </span>
            {idx < steps.length - 1 && (
              <div className={`w-8 h-px ${done ? 'bg-green-500' : 'bg-white/10'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

import { useRef, useState } from 'react'
import { Upload, X, FileText, Image } from 'lucide-react'

const DOC_TYPES = [
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID' },
  { value: 'driving_license', label: 'Driving License' },
  { value: 'id_front', label: 'ID Card (Front)' },
  { value: 'id_back', label: 'ID Card (Back)' },
  { value: 'proof_of_address', label: 'Proof of Address' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'selfie', label: 'Selfie with ID' },
  { value: 'other', label: 'Other' },
]

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.pdf', '.webp']
const MAX_SIZE = 10 * 1024 * 1024

export default function DocumentUpload({ label, docType, file, onDocTypeChange, onFileChange, error }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = (f) => {
    if (!f) return
    const ext = '.' + f.name.split('.').pop().toLowerCase()
    if (!ALLOWED_EXT.includes(ext)) {
      alert('Only JPG, PNG, PDF, WEBP files are allowed.')
      return
    }
    if (f.size > MAX_SIZE) {
      alert('File size must be under 10 MB.')
      return
    }
    onFileChange(f)
  }

  const isImage = file && file.type?.startsWith('image/')

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-text-primary">{label}</p>

      {/* Document Type Selector */}
      <select
        value={docType}
        onChange={(e) => onDocTypeChange(e.target.value)}
        className="w-full bg-primary-secondary border border-white/10 rounded-lg px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-primary-accent transition"
      >
        <option value="">Select document type</option>
        {DOC_TYPES.map((d) => (
          <option key={d.value} value={d.value}>{d.label}</option>
        ))}
      </select>

      {/* Drop Zone */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
          ${dragOver ? 'border-primary-accent bg-primary-accent/5' : 'border-white/10 hover:border-white/20'}
          ${error ? 'border-red-500/50' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,.webp"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />

        {file ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isImage ? <Image size={20} className="text-primary-accent" /> : <FileText size={20} className="text-primary-accent" />}
              <div className="text-left">
                <p className="text-sm text-text-primary font-medium truncate max-w-[200px]">{file.name}</p>
                <p className="text-xs text-text-secondary">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onFileChange(null) }}
              className="p-1 rounded-full hover:bg-white/10 transition"
            >
              <X size={16} className="text-text-secondary" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload size={28} className="mx-auto text-text-secondary" />
            <p className="text-sm text-text-secondary">Drag & drop or <span className="text-primary-accent">browse</span></p>
            <p className="text-xs text-text-secondary/60">JPG, PNG, PDF, WEBP · Max 10 MB</p>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { ShieldCheck, ArrowRight, ArrowLeft, Send, Loader2 } from 'lucide-react'
import KYCStatusBanner from './kyc/KYCStatusBanner'
import StepIndicator from './kyc/StepIndicator'
import DocumentUpload from './kyc/DocumentUpload'
import AddressFields from './kyc/AddressFields'

const API_BASE = import.meta.env.VITE_API_URL || ''

const KYC = () => {
  const [step, setStep] = useState(1)
  const [kycStatus, setKycStatus] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState(null)

  // Doc 1
  const [docType1, setDocType1] = useState('')
  const [file1, setFile1] = useState(null)
  // Doc 2 (optional)
  const [docType2, setDocType2] = useState('')
  const [file2, setFile2] = useState(null)
  const [showDoc2, setShowDoc2] = useState(false)
  // Address
  const [addressData, setAddressData] = useState({
    residential_address: '',
    city: '',
    postal_code: '',
    country_of_residence: '',
  })
  // Errors
  const [errors, setErrors] = useState({})

  useEffect(() => {
    fetchProfile()
  }, [])

  const getToken = () => localStorage.getItem('token') || ''

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/profile`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) {
        const data = await res.json()
        setKycStatus(data.kyc_status || 'pending')
        if (data.address) setAddressData(prev => ({ ...prev, residential_address: data.address }))
        if (data.country) setAddressData(prev => ({ ...prev, country_of_residence: data.country }))
      }
    } catch (e) {
      console.error('Failed to load profile:', e)
    } finally {
      setLoading(false)
    }
  }

  const validateStep1 = () => {
    const errs = {}
    if (!docType1) errs.docType1 = 'Select a document type'
    if (!file1) errs.file1 = 'Upload a document'
    if (showDoc2) {
      if (!docType2) errs.docType2 = 'Select a document type for second document'
      if (!file2) errs.file2 = 'Upload a second document'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return
    setStep(s => Math.min(s + 1, 3))
  }

  const handleBack = () => setStep(s => Math.max(s - 1, 1))

  const handleAddressChange = (field, value) => {
    setAddressData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitResult(null)
    try {
      const formData = new FormData()
      formData.append('document_type', docType1)
      formData.append('file', file1)
      if (showDoc2 && file2 && docType2) {
        formData.append('document_type_2', docType2)
        formData.append('file_2', file2)
      }
      Object.entries(addressData).forEach(([k, v]) => {
        if (v.trim()) formData.append(k, v.trim())
      })

      const res = await fetch(`${API_BASE}/profile/kyc/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      })
      const data = await res.json()

      if (res.ok) {
        setSubmitResult({ type: 'success', message: data.message || 'KYC submitted successfully!' })
        setKycStatus('submitted')
      } else {
        setSubmitResult({ type: 'error', message: data.detail || 'Submission failed. Please try again.' })
      }
    } catch (e) {
      setSubmitResult({ type: 'error', message: 'Network error. Please check your connection.' })
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = ['pending', 'rejected'].includes(kycStatus)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <Loader2 className="animate-spin text-primary-accent" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="max-w-2xl mx-auto px-4 pt-32 pb-20">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary">Identity Verification</h1>
          <p className="text-text-secondary mt-2">Complete KYC to unlock full trading access</p>
        </div>

        {/* Status Banner */}
        <div className="mb-8">
          <KYCStatusBanner status={kycStatus} />
        </div>

        {/* Form — only show if can submit */}
        {canSubmit && (
          <div className="bg-primary-secondary/50 border border-white/5 rounded-2xl p-6 md:p-8 space-y-8">
            <StepIndicator currentStep={step} />

            {/* Step 1: Documents */}
            {step === 1 && (
              <div className="space-y-6">
                <DocumentUpload
                  label="Primary Document *"
                  docType={docType1}
                  file={file1}
                  onDocTypeChange={setDocType1}
                  onFileChange={setFile1}
                  error={errors.docType1 || errors.file1}
                />

                {!showDoc2 ? (
                  <button
                    type="button"
                    onClick={() => setShowDoc2(true)}
                    className="text-sm text-primary-accent hover:underline"
                  >
                    + Add second document (optional)
                  </button>
                ) : (
                  <DocumentUpload
                    label="Second Document (optional)"
                    docType={docType2}
                    file={file2}
                    onDocTypeChange={setDocType2}
                    onFileChange={setFile2}
                    error={errors.docType2 || errors.file2}
                  />
                )}
              </div>
            )}

            {/* Step 2: Address */}
            {step === 2 && (
              <AddressFields
                address={addressData.residential_address}
                city={addressData.city}
                postalCode={addressData.postal_code}
                country={addressData.country_of_residence}
                onChange={handleAddressChange}
              />
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <div className="space-y-4">
                <p className="text-sm font-medium text-text-primary">Review Your Submission</p>
                <div className="bg-primary-bg/50 rounded-xl p-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Document 1</span>
                    <span className="text-text-primary font-medium">{docType1 || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">File</span>
                    <span className="text-text-primary font-medium truncate max-w-[180px]">{file1?.name || '—'}</span>
                  </div>
                  {showDoc2 && file2 && (
                    <>
                      <div className="border-t border-white/5 pt-3 flex justify-between">
                        <span className="text-text-secondary">Document 2</span>
                        <span className="text-text-primary font-medium">{docType2 || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">File</span>
                        <span className="text-text-primary font-medium truncate max-w-[180px]">{file2?.name || '—'}</span>
                      </div>
                    </>
                  )}
                  {addressData.residential_address && (
                    <div className="border-t border-white/5 pt-3 flex justify-between">
                      <span className="text-text-secondary">Address</span>
                      <span className="text-text-primary font-medium text-right max-w-[200px]">
                        {[addressData.residential_address, addressData.city, addressData.postal_code, addressData.country_of_residence].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                {submitResult && (
                  <div className={`p-4 rounded-xl text-sm ${submitResult.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    {submitResult.message}
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              {step > 1 ? (
                <button onClick={handleBack} className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition">
                  <ArrowLeft size={16} /> Back
                </button>
              ) : <div />}

              {step < 3 ? (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-primary rounded-xl text-sm font-semibold text-white hover:opacity-90 transition"
                >
                  Next <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-primary rounded-xl text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {submitting ? 'Submitting...' : 'Submit KYC'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Already submitted/approved info */}
        {!canSubmit && kycStatus !== 'pending' && (
          <div className="text-center text-text-secondary text-sm mt-4">
            {kycStatus === 'approved' || kycStatus === 'verified'
              ? 'Your account is fully verified. No action needed.'
              : 'Your documents are being processed. We will notify you once the review is complete.'}
          </div>
        )}
      </div>
    </div>
  )
}

export default KYC

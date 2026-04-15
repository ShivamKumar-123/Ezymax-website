export default function AddressFields({ address, city, postalCode, country, onChange }) {
  const inputClass = 'w-full bg-primary-secondary border border-white/10 rounded-lg px-4 py-3 text-sm text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-primary-accent transition'

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-text-primary">Address Information <span className="text-text-secondary">(optional)</span></p>

      <input
        type="text"
        placeholder="Residential Address"
        value={address}
        onChange={(e) => onChange('residential_address', e.target.value)}
        className={inputClass}
      />

      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="City"
          value={city}
          onChange={(e) => onChange('city', e.target.value)}
          className={inputClass}
        />
        <input
          type="text"
          placeholder="Postal Code"
          value={postalCode}
          onChange={(e) => onChange('postal_code', e.target.value)}
          className={inputClass}
        />
      </div>

      <input
        type="text"
        placeholder="Country of Residence"
        value={country}
        onChange={(e) => onChange('country_of_residence', e.target.value)}
        className={inputClass}
      />
    </div>
  )
}

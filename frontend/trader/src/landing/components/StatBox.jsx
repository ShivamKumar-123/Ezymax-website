import { useEffect, useRef, useState } from 'react'

const StatBox = ({ value, label, suffix = '' }) => {
  const [count, setCount] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true)
      },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => { if (ref.current) observer.unobserve(ref.current) }
  }, [])

  useEffect(() => {
    if (!isVisible) return
    const numericValue = parseFloat(value.replace(/[^0-9.]/g, ''))
    const duration = 2000
    const steps = 60
    const increment = numericValue / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= numericValue) {
        setCount(numericValue)
        clearInterval(timer)
      } else {
        setCount(current)
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [isVisible, value])

  const formatCount = (num) => {
    if (value.includes('B')) return `$${num.toFixed(1)}B`
    if (value.includes('K')) return `${Math.floor(num)}K`
    if (value.includes('+')) return `${Math.floor(num)}+`
    return Math.floor(num).toString()
  }

  return (
    <div ref={ref} className="glass-card p-6 text-center">
      <div className="text-3xl font-bold text-white mb-1">
        {isVisible ? formatCount(count) : value}{suffix}
      </div>
      <div className="text-text-secondary text-sm">{label}</div>
    </div>
  )
}

export default StatBox

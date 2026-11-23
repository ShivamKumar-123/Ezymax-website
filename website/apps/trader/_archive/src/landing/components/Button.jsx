import { ArrowRight } from 'lucide-react'
import { usePopup } from './PopupContext'

const Button = ({ children, variant = 'primary', icon = false, className = '', onClick, noPopup = false, ...props }) => {
  const { openPopup } = usePopup()
  const baseStyles = variant === 'primary' ? 'btn-primary' : 'btn-ghost'

  const handleClick = (e) => {
    if (onClick) onClick(e)
    if (!noPopup) openPopup()
  }

  return (
    <button className={`${baseStyles} ${className} inline-flex items-center justify-center gap-2`} onClick={handleClick} {...props}>
      {children}
      {icon && <ArrowRight className="w-5 h-5" />}
    </button>
  )
}

export default Button

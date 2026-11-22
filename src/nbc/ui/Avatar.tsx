import './ui.css'
import { handlerColor } from '../handlers'

/** The handler's initial on their own color. A shared label such as "Kheng, Sitha" shows the first handler. */
export function Avatar({ name, size }: { name: string; size?: 'md' | 'lg' }) {
  const first = name.split(',')[0]!.trim()
  return <span className="nbc-av" aria-hidden="true" data-size={size} data-initials={first.charAt(0).toUpperCase()} style={{ background: handlerColor(first) }}/>
}

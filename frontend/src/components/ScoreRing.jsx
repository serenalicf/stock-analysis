import { useEffect, useRef } from 'react'
import { scoreColor } from '../utils'

export function ScoreRing({ score, size = 88, strokeWidth = 5 }) {
  const circleRef = useRef(null)
  const R = (size / 2) - strokeWidth
  const C = 2 * Math.PI * R
  const color = scoreColor(score)

  useEffect(() => {
    if (!circleRef.current) return
    const offset = C * (1 - score / 100)
    circleRef.current.style.transition = 'none'
    circleRef.current.style.strokeDashoffset = C
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        circleRef.current.style.transition = 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)'
        circleRef.current.style.strokeDashoffset = offset
      })
    })
  }, [score, C])

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={R}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <circle
          ref={circleRef}
          cx={size / 2} cy={size / 2} r={R}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={C}
          strokeDashoffset={C}
          strokeLinecap="butt"
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: size > 70 ? '22px' : '15px',
          fontWeight: 700,
          color,
          lineHeight: 1,
        }}>
          {Math.round(score)}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '8px',
          color: 'var(--text3)',
          letterSpacing: '0.1em',
          marginTop: '2px',
        }}>
          /100
        </span>
      </div>
    </div>
  )
}

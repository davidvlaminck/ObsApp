import { useCallback, useEffect, useRef, useState } from 'react'

import { HexColorPicker, HexColorInput } from 'react-colorful'

interface StatusColorInputProps {
  value: string
  onChange: (value: string) => void
  label: string
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#?([0-9a-fA-F]{6})$/)
  if (!match) return null
  const num = parseInt(match[1], 16)
  return { r: (num >> 16) & 0xff, g: (num >> 8) & 0xff, b: num & 0xff }
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')
}

export default function StatusColorInput({ value, onChange, label }: StatusColorInputProps) {
  const [open, setOpen] = useState(false)
  const [pickerValue, setPickerValue] = useState(value)
  const [activeFormat, setActiveFormat] = useState<'hex' | 'rgb'>('hex')
  const [rgb, setRgb] = useState(() => hexToRgb(value) ?? { r: 0, g: 0, b: 0 })
  const popupRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setPickerValue(value)
  }, [value])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (popupRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return
      }
      setOpen(false)
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const handleButtonClick = useCallback(() => {
    setOpen(true)
    setPickerValue(value)
    setRgb(hexToRgb(value) ?? { r: 0, g: 0, b: 0 })
    setActiveFormat('hex')
  }, [value])

  const handlePickerChange = useCallback(
    (newColor: string) => {
      setPickerValue(newColor)
      setRgb(hexToRgb(newColor) ?? { r: 0, g: 0, b: 0 })
      onChange(newColor)
    },
    [onChange]
  )

  const handleRgbChange = useCallback(
    (channel: 'r' | 'g' | 'b') => (event: React.ChangeEvent<HTMLInputElement>) => {
      const num = Math.max(0, Math.min(255, parseInt(event.target.value, 10) || 0))
      const newRgb = { ...rgb, [channel]: num }
      setRgb(newRgb)
      const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
      setPickerValue(hex)
      onChange(hex)
    },
    [rgb, onChange]
  )

  return (
    <div className="status-color-input">
      <button
        ref={buttonRef}
        type="button"
        className="color-swatch-btn"
        onClick={handleButtonClick}
        aria-label={`Kies kleur voor ${label}`}
        title={`Kies kleur voor ${label}`}
        style={{ backgroundColor: value }}
      />

      {open && (
        <div ref={popupRef} className="color-picker-popup">
          <div className="color-picker-picker-wrapper">
            <HexColorPicker color={pickerValue} onChange={handlePickerChange} />
          </div>
          <div className="color-picker-tabs">
            <button
              type="button"
              className={`color-picker-tab ${activeFormat === 'hex' ? 'active' : ''}`}
              onClick={() => setActiveFormat('hex')}
            >
              HEX
            </button>
            <button
              type="button"
              className={`color-picker-tab ${activeFormat === 'rgb' ? 'active' : ''}`}
              onClick={() => setActiveFormat('rgb')}
            >
              RGB
            </button>
          </div>
          {activeFormat === 'hex' ? (
            <HexColorInput
              color={pickerValue}
              onChange={handlePickerChange}
              className="color-picker-text-input"
              aria-label={`Hex waarde voor ${label}`}
            />
          ) : (
            <div className="color-picker-rgb-row">
              {(['r', 'g', 'b'] as const).map((channel) => (
                <div key={channel} className="color-picker-rgb-field">
                  <span className="rgb-label">{channel.toUpperCase()}</span>
                  <input
                    type="number"
                    min={0}
                    max={255}
                    value={rgb[channel]}
                    onChange={handleRgbChange(channel)}
                    className="rgb-number-input"
                    aria-label={`${channel.toUpperCase()} waarde`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

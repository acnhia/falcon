/**
 * Renders one form field, choosing the control from the catalogue's FIELD_KIND. Extracting this
 * from the page keeps the page about composition - which fields appear on which step - rather than
 * about how any individual control is drawn.
 */
import { FIELD_KIND, FIELD_LABEL, SELECT_OPTIONS } from './catalogue'

interface Props {
  fieldKey: string
  required: boolean
  value: string | undefined
  onChange: (key: string, value: string) => void
}

export function FieldInput({ fieldKey: key, required, value, onChange }: Props) {
    const kind = FIELD_KIND[key] ?? 'text'
    const label = FIELD_LABEL[key] ?? key

    if (kind === 'checkbox') {
      return (
        <label className="wizard-checkbox">
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={(event) => onChange(key, event.target.checked ? 'true' : 'false')}
          />
          {label}
        </label>
      )
    }

    if (kind === 'yesno') {
      return (
        <div className="wizard-field">
          <label htmlFor={`field-${key}`}>
            {label} {required ? <span aria-hidden="true">*</span> : '(optional)'}
          </label>
          <select
            id={`field-${key}`}
            className="wizard-field-control"
            required={required}
            value={value ?? ''}
            onChange={(event) => onChange(key, event.target.value)}
          >
            <option value="">Select…</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      )
    }

    if (kind === 'select') {
      const options = SELECT_OPTIONS[key] ?? []

      return (
        <div className="wizard-field">
          <label htmlFor={`field-${key}`}>
            {label} {required ? <span aria-hidden="true">*</span> : '(optional)'}
          </label>
          <select
            id={`field-${key}`}
            className="wizard-field-control"
            required={required}
            value={value ?? ''}
            onChange={(event) => onChange(key, event.target.value)}
          >
            <option value="">Select…</option>
            {options.map(([value, optionLabel]) => (
              <option key={value} value={value}>{optionLabel}</option>
            ))}
          </select>
        </div>
      )
    }

    return (
      <div className="wizard-field">
        <label htmlFor={`field-${key}`}>
          {label} {required ? <span aria-hidden="true">*</span> : '(optional)'}
        </label>
        <input
          id={`field-${key}`}
          type={kind === 'text' ? undefined : kind}
          required={required}
          value={value ?? ''}
          onChange={(event) => onChange(key, event.target.value)}
        />
      </div>
    )
  }

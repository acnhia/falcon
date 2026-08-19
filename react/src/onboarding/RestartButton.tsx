interface Props {
  onRestart: () => void
}

/** Shown on every wizard stage; confirms before discarding the resume pointer so a session isn't lost by accident. */
export default function RestartButton({ onRestart }: Props) {
  function handleClick() {
    if (window.confirm('Restart and begin a new onboarding session? Your current progress will no longer be resumed.')) {
      onRestart()
    }
  }

  return (
    <div className="wizard-restart-bar">
      <button type="button" className="wizard-restart-button" onClick={handleClick}>
        Restart
      </button>
    </div>
  )
}

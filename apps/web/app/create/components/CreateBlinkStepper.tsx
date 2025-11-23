/**
 * Stepper navigation component for Blink creation flow
 */
import { STEPS } from "../schema"

interface CreateBlinkStepperProps {
  currentStep: number
}

export function CreateBlinkStepper({ currentStep }: CreateBlinkStepperProps) {
  return (
    <div data-reveal data-stepper className="mb-12">
      <div className="flex items-center justify-between relative">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex-1 relative">
            <div className="flex items-center">
              <div
                className={`
                  w-12 h-12 rounded-full flex items-center justify-center font-mono font-bold
                  ${
                    currentStep === step.id
                      ? "bg-neon-blue-dark text-neon-black"
                      : currentStep > step.id
                      ? "bg-neon-blue-dark/30 text-neon-blue-light border border-neon-blue-dark"
                      : "bg-neon-dark text-neon-grey border border-neon-grey/30"
                  }
                `}
              >
                {currentStep > step.id ? "✓" : step.id}
              </div>

              {index < STEPS.length - 1 && (
                <div
                  className={`
                    flex-1 h-0.5 mx-2
                    ${currentStep > step.id ? "bg-neon-blue-dark" : "bg-neon-grey/30"}
                  `}
                />
              )}
            </div>

            <div className="mt-3">
              <div className={`font-mono text-sm ${currentStep >= step.id ? "text-neon-white" : "text-neon-grey"}`}>
                {step.title}
              </div>
              <div className="font-mono text-xs text-neon-grey mt-1">
                {step.description}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

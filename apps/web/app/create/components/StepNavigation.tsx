/**
 * Navigation buttons for stepper form
 */
import { Button } from "@/components/ui/button"

interface StepNavigationProps {
  currentStep: number
  totalSteps: number
  isSubmitting: boolean
  onBack: () => void
  onNext: () => void
}

export function StepNavigation({
  currentStep,
  totalSteps,
  isSubmitting,
  onBack,
  onNext
}: StepNavigationProps) {
  const isLastStep = currentStep === totalSteps

  return (
    <div className="flex justify-between mt-8">
      <Button
        type="button"
        onClick={onBack}
        disabled={currentStep === 1}
        className="btn-ghost"
      >
        ← Back
      </Button>

      {!isLastStep ? (
        <Button
          type="button"
          onClick={onNext}
          className="btn-primary"
        >
          Next →
        </Button>
      ) : (
        <Button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary"
        >
          {isSubmitting ? "Creating..." : "Create Blink"}
        </Button>
      )}
    </div>
  )
}

import type { FieldError } from 'react-hook-form';

/**
 * Turns a Zod issue code into an i18n key.
 *
 * The shared schemas carry English messages for the API; the UI never shows
 * them. `zodResolver` puts the issue code in `error.type`, so the Arabic copy is
 * resolved from the code — the same rule the API errors follow.
 */
export function validationMessageKey(error: FieldError | undefined): string | undefined {
  if (!error) {
    return undefined;
  }

  switch (error.type) {
    case 'too_small':
      return 'errors.validation.tooSmall';
    case 'too_big':
      return 'errors.validation.tooBig';
    case 'invalid_type':
      return 'errors.validation.required';
    case 'invalid_format':
    case 'invalid_string':
      return 'errors.validation.invalidFormat';
    case 'invalid_value':
    case 'invalid_enum_value':
      return 'errors.validation.invalid';
    default:
      return 'errors.validation.invalid';
  }
}

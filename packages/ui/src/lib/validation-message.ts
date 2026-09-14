import type { FieldError } from 'react-hook-form';

// The shared schemas carry English messages for the API; the UI resolves Arabic copy from the issue
// code in `error.type` instead.
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

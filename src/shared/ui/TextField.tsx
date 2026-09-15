import { forwardRef, type InputHTMLAttributes } from 'react';
import './text-field.css';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> & {
  /** Full width of the column (335) or of a panel's inside (303) — the parent decides; this only adds a class. */
  className?: string;
};

/**
 * TextField 48 (screens-onboard notes): dark 3D face, 2 px underside, 15/700 text, placeholder w30;
 * focus = 2 px cyan inset ring. A plain `<input>` so the phone keyboard, autocomplete and
 * `enterKeyHint` all work as usual. Shared by the welcome screen, the nickname dialog and the settings panel.
 */
export const TextField = forwardRef<HTMLInputElement, Props>(function TextField({ className, ...rest }, ref) {
  return <input ref={ref} type="text" className={['field', className].filter(Boolean).join(' ')} {...rest} />;
});

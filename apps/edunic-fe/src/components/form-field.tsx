import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

type BaseProps = {
  label: string;
  name: string;
  help?: string;
  children?: ReactNode;
};

type InputFieldProps = BaseProps & InputHTMLAttributes<HTMLInputElement>;
type TextAreaFieldProps = BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function FormField({
  label,
  name,
  help,
  children,
  ...props
}: InputFieldProps) {
  return (
    <div className="form-field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} {...props} />
      {help ? <p className="field-help">{help}</p> : null}
      {children}
    </div>
  );
}

export function TextAreaField({
  label,
  name,
  help,
  children,
  ...props
}: TextAreaFieldProps) {
  return (
    <div className="form-field">
      <label htmlFor={name}>{label}</label>
      <textarea id={name} name={name} {...props} />
      {help ? <p className="field-help">{help}</p> : null}
      {children}
    </div>
  );
}

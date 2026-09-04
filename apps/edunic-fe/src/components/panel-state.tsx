type PanelStateProps = {
  message: string;
  tone?: 'empty' | 'error' | 'loading';
};

export function PanelState({ message, tone = 'empty' }: PanelStateProps) {
  return (
    <div
      aria-live={tone === 'loading' ? 'polite' : undefined}
      className={`panel-state panel-state-${tone} body-copy`}
    >
      {message}
    </div>
  );
}

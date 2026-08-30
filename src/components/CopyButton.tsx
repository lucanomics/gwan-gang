import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from './ui';
import { copyText } from '../lib/file';

export function CopyButton({
  text,
  label,
  variant = 'secondary',
  full = true,
}: {
  text: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  full?: boolean;
}) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');

  return (
    <Button
      variant={variant}
      full={full}
      onClick={async () => {
        const ok = await copyText(text);
        setState(ok ? 'ok' : 'fail');
        window.setTimeout(() => setState('idle'), 2000);
      }}
    >
      {state === 'ok' ? (
        <Check aria-hidden className="h-4 w-4" />
      ) : (
        <Copy aria-hidden className="h-4 w-4" />
      )}
      {state === 'ok' ? '복사됨' : state === 'fail' ? '복사 실패 — 직접 선택하세요' : label}
    </Button>
  );
}

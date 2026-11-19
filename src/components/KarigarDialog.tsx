import { useEffect, useState } from 'react';
import type { Karigar } from '../lib/types';
import { parsePhone } from '../lib/validation';
import * as ops from '../store/operations';
import { useStore } from '../store/StoreProvider';
import { Button, Field, Input, Modal, Textarea } from './ui';

const SUGGESTIONS = ['Rings & bangles', 'Necklaces & chains', 'Earrings & jhumkas', 'Repairs & polishing', 'Stone setting', 'Filigree work'];

export function KarigarDialog({
  open,
  onClose,
  karigar,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  karigar?: Karigar;
  onSaved?: (id: string) => void;
}) {
  const { run } = useStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [spec, setSpec] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  useEffect(() => {
    if (!open) return;
    setName(karigar?.name ?? '');
    setPhone(karigar?.phone ?? '');
    setSpec(karigar?.specialisation ?? '');
    setNotes(karigar?.notes ?? '');
    setErrors({});
  }, [open, karigar]);

  const save = () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Enter the karigar’s name';
    const p = parsePhone(phone);
    if (!p.ok) errs.phone = p.error;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const input = { name, phone: p.ok ? p.value : '', specialisation: spec, notes };
    let newId = karigar?.id ?? '';
    const ok = run(
      (d) => {
        if (karigar) return ops.updateKarigar(d, karigar.id, input);
        const r = ops.addKarigar(d, input);
        newId = r.id;
        return r.data;
      },
      karigar ? `${name.trim()} updated` : `${name.trim()} added`,
    );
    if (ok) {
      onSaved?.(newId);
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={karigar ? 'Edit karigar' : 'Add karigar'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{karigar ? 'Save' : 'Add karigar'}</Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Name" htmlFor="k-name" error={errors.name}>
          <Input id="k-name" value={name} onChange={(e) => setName(e.target.value)} invalid={!!errors.name} placeholder="e.g. Ramesh Soni" autoComplete="off" />
        </Field>
        <Field label="Phone number" htmlFor="k-phone" error={errors.phone} optional>
          <Input id="k-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} invalid={!!errors.phone} placeholder="10-digit mobile" />
        </Field>
        <Field label="Speciality" htmlFor="k-spec" optional>
          <Input id="k-spec" value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="What kind of work they do best" list="k-spec-list" />
          <datalist id="k-spec-list">
            {SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="Notes" htmlFor="k-notes" optional>
          <Textarea id="k-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Workshop location, usual timelines…" className="min-h-[64px]" />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

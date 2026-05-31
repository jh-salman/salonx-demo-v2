import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MagnifyingGlass, Plus } from 'phosphor-react';
import { updateRampRecipient } from '../data/rampApi.js';
import {
  CLIENTS_CATALOG_UPDATED,
  refreshClientsCatalogCache,
} from '../data/clientProfileAvatar';
import { getRampClientDirectory } from '../lib/rampClientDirectory.js';
import {
  formatSmsPhoneDisplay,
  normalizeSmsPhone,
} from '../lib/rampDemoTransport.js';

/**
 * Fail-safe MMS target — pick a client or type a number to override any saved phone.
 */
export default function RampRecipientField({
  token,
  recipientName = '',
  recipientPhone = '',
  onUpdated,
  onDraftChange,
}) {
  const [clientQuery, setClientQuery] = useState(() => String(recipientName || '').trim());
  const [phoneInput, setPhoneInput] = useState(() => String(recipientPhone || '').trim());
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientDirectory, setClientDirectory] = useState(() => getRampClientDirectory());
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [savedNote, setSavedNote] = useState('');

  useEffect(() => {
    setClientQuery(String(recipientName || '').trim());
    setPhoneInput(String(recipientPhone || '').trim());
  }, [recipientName, recipientPhone, token]);

  useEffect(() => {
    onDraftChange?.({
      recipientName: clientQuery,
      recipientPhone: phoneInput,
    });
  }, [clientQuery, phoneInput, onDraftChange]);

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      if (!cancelled) setClientDirectory(getRampClientDirectory());
    };
    sync();
    void refreshClientsCatalogCache()
      .then(() => sync())
      .catch(() => {});
    window.addEventListener(CLIENTS_CATALOG_UPDATED, sync);
    return () => {
      cancelled = true;
      window.removeEventListener(CLIENTS_CATALOG_UPDATED, sync);
    };
  }, []);

  const clientMatches = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    if (!q) return clientDirectory.slice(0, 8);
    return clientDirectory
      .filter(
        (c) =>
          String(c.name || '')
            .toLowerCase()
            .includes(q) ||
          (digits && String(c.phone || '').replace(/\D/g, '').includes(digits)),
      )
      .slice(0, 8);
  }, [clientDirectory, clientQuery]);

  const resolvedDigits = normalizeSmsPhone(phoneInput);

  const persistRecipient = useCallback(
    async (name, phoneRaw) => {
      if (!token) return;
      const phone = normalizeSmsPhone(phoneRaw);
      if (!phone) {
        setFieldError('Enter a valid 10-digit US phone number.');
        return;
      }
      setSaving(true);
      setFieldError('');
      setSavedNote('');
      try {
        const result = await updateRampRecipient(token, {
          recipientPhone: phone,
          recipientName: String(name || clientQuery || '').trim() || undefined,
        });
        const post = result?.post;
        if (post) {
          onUpdated?.(post);
          setPhoneInput(post.recipientPhone || phone);
          setClientQuery(post.recipientName || name || clientQuery);
        }
        setSavedNote(`MMS → ${formatSmsPhoneDisplay(phone)}`);
      } catch (e) {
        setFieldError(e instanceof Error ? e.message : 'Could not save number');
      } finally {
        setSaving(false);
      }
    },
    [clientQuery, onUpdated, token],
  );

  const handleSelectClient = useCallback(
    (client) => {
      const name = String(client?.name || '').trim();
      const phone = String(client?.phone || '').trim();
      setClientQuery(name);
      setPhoneInput(phone);
      setClientPickerOpen(false);
      void persistRecipient(name, phone);
    },
    [persistRecipient],
  );

  const handleSaveManual = useCallback(() => {
    void persistRecipient(clientQuery, phoneInput);
  }, [clientQuery, persistRecipient, phoneInput]);

  return (
    <div className="ramp-post-it__recipientBlock">
      <div className="ramp-post-it__recipientHead">
        <span className="ramp-post-it__editLabel">Send to (override)</span>
        {resolvedDigits ? (
          <span className="ramp-post-it__recipientSaved">
            MMS → {formatSmsPhoneDisplay(resolvedDigits)}
          </span>
        ) : (
          <span className="ramp-post-it__recipientHint">Type a number to override</span>
        )}
      </div>
      <p className="ramp-post-it__recipientHelp">
        Pick a client or type any US number — overrides appointment / saved phone.
      </p>

      <label className="ramp-post-it__recipientSearch">
        <MagnifyingGlass size={16} weight="bold" aria-hidden />
        <input
          type="search"
          value={clientQuery}
          onChange={(e) => {
            setClientQuery(e.target.value);
            setClientPickerOpen(true);
            setSavedNote('');
          }}
          onFocus={() => setClientPickerOpen(true)}
          placeholder="Select client"
          autoComplete="off"
        />
        <button
          type="button"
          className="ramp-post-it__recipientBrowse"
          aria-label="Browse clients"
          onClick={() => setClientPickerOpen((v) => !v)}
        >
          <Plus size={16} weight="bold" aria-hidden />
        </button>
      </label>

      {clientPickerOpen && clientMatches.length ? (
        <ul className="ramp-post-it__recipientPicker" role="listbox">
          {clientMatches.map((c) => (
            <li key={c.id || c.name}>
              <button
                type="button"
                className="ramp-post-it__recipientOption"
                onClick={() => handleSelectClient(c)}
              >
                <span className="ramp-post-it__recipientOptName">{c.name}</span>
                <span className="ramp-post-it__recipientOptPhone">{c.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <label className="ramp-post-it__recipientPhoneWrap" htmlFor={`ramp-phone-${token}`}>
        <span className="ramp-post-it__recipientPhoneLabel">Phone override</span>
        <input
          id={`ramp-phone-${token}`}
          type="tel"
          inputMode="tel"
          enterKeyHint="done"
          className="ramp-post-it__recipientPhoneInput"
          value={phoneInput}
          onChange={(e) => {
            setPhoneInput(e.target.value);
            setSavedNote('');
          }}
          placeholder="(555) 555-5555"
          autoComplete="tel"
        />
      </label>

      <button
        type="button"
        className="ramp-post-it__cta ramp-post-it__cta--ghost ramp-post-it__recipientSave"
        disabled={saving}
        onClick={handleSaveManual}
      >
        {saving ? 'Saving…' : 'SAVE OVERRIDE'}
      </button>

      {fieldError ? <p className="ramp-post-it__error">{fieldError}</p> : null}
      {savedNote && !fieldError ? (
        <p className="ramp-post-it__copyNote">{savedNote}</p>
      ) : null}
    </div>
  );
}

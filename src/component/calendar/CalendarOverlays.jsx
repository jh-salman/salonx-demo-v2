import React, { useState } from 'react';
import { Plus, X } from 'phosphor-react';

// ---------- Picker list (modal style) ----------

export function SearchablePickerModal({
  title,
  items,
  renderItem,
  onSelect,
  onAddNew,
  addNewLabel = '+ Add new',
  onClose,
}) {
  return (
    <div className="cal-modal cal-modal--picker cal-modal--pickerSheet" role="dialog" aria-modal="true">
      <button className="cal-modal__backdrop" onClick={onClose} aria-label="Close" />
      <div className="cal-modal__card cal-modal__card--picker">
        <div className="cal-modal__formHead">
          <div className="cal-modal__title">{title}</div>
          <button type="button" className="cal-modal__iconBtn" aria-label="Close" onClick={onClose}>
            <X size={16} weight="bold" aria-hidden />
          </button>
        </div>

        <div className="cal-pickerList">
          {onAddNew ? (
            <button
              type="button"
              className="cal-pickerItem cal-pickerItem--add"
              onClick={() => {
                onAddNew('');
              }}
            >
              <Plus size={14} weight="bold" aria-hidden />
              <span>{addNewLabel}</span>
            </button>
          ) : null}

          {items.length === 0 ? (
            <div className="cal-pickerEmpty">Nothing to show</div>
          ) : (
            items.map((item) => (
              <button
                type="button"
                key={item.id}
                className="cal-pickerItem"
                onClick={() => {
                  onSelect(item);
                }}
              >
                {renderItem ? renderItem(item) : <span className="cal-pickerItem__name">{item.name}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Trigger button used in form to open picker ----------

export function PickerTrigger({ value, placeholder, onClick }) {
  return (
    <button type="button" className="cal-pickerTrigger" onClick={onClick}>
      <span className={`cal-pickerTrigger__value${value ? '' : ' is-placeholder'}`}>
        {value || placeholder}
      </span>
      <span className="cal-pickerTrigger__chev" aria-hidden>
        ▾
      </span>
    </button>
  );
}

// ---------- New customer screen ----------

export function NewCustomerScreen({ initialName = '', onCancel, onSave }) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = `c-${Date.now().toString(36)}`;
    onSave({ id, name: trimmed, phone: phone.trim(), email: email.trim(), notes: notes.trim() });
  };

  return (
    <div className="cal-modal cal-modal--full cal-modal--sub" role="dialog" aria-modal="true">
      <button className="cal-modal__backdrop" onClick={onCancel} aria-label="Close" />
      <form className="cal-modal__card cal-modal__card--form" onSubmit={handleSubmit}>
        <div className="cal-modal__formHead">
          <div className="cal-modal__title">New Customer</div>
          <button type="button" className="cal-modal__iconBtn" aria-label="Close" onClick={onCancel}>
            <X size={16} weight="bold" aria-hidden />
          </button>
        </div>

        <label className="cal-field">
          <span className="cal-field__label">Name</span>
          <input
            className="cal-field__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            autoFocus
            required
          />
        </label>

        <label className="cal-field">
          <span className="cal-field__label">Phone</span>
          <input
            type="tel"
            className="cal-field__input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 555-5555"
          />
        </label>

        <label className="cal-field">
          <span className="cal-field__label">Email</span>
          <input
            type="email"
            className="cal-field__input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
        </label>

        <label className="cal-field">
          <span className="cal-field__label">Notes</span>
          <textarea
            className="cal-field__input cal-field__textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 500))}
            placeholder="Allergies, preferences, etc."
            rows={3}
            maxLength={500}
          />
          <span className="cal-field__counter">{notes.length}/500</span>
        </label>

        <div className="cal-modal__row">
          <button type="button" className="cal-modal__btn cal-modal__btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="cal-modal__btn cal-modal__btn--primary">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------- New service screen ----------

const SVC_PRICE_TYPES = [
  { id: 'fixed', label: 'Fixed' },
  { id: 'startsFrom', label: 'Starts from' },
  { id: 'varies', label: 'Varies' },
];

export function NewServiceScreen({ initialName = '', onCancel, onSave }) {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [priceType, setPriceType] = useState('fixed');
  const [duration, setDuration] = useState(60);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = `SVC-${Date.now().toString(36)}`;
    onSave({
      id,
      name: trimmed,
      category: category.trim(),
      price: Number(price) || 0,
      priceType,
      duration: Math.max(5, parseInt(duration, 10) || 60),
    });
  };

  return (
    <div className="cal-modal cal-modal--full cal-modal--sub" role="dialog" aria-modal="true">
      <button className="cal-modal__backdrop" onClick={onCancel} aria-label="Close" />
      <form className="cal-modal__card cal-modal__card--form" onSubmit={handleSubmit}>
        <div className="cal-modal__formHead">
          <div className="cal-modal__title">New Service</div>
          <button type="button" className="cal-modal__iconBtn" aria-label="Close" onClick={onCancel}>
            <X size={16} weight="bold" aria-hidden />
          </button>
        </div>

        <label className="cal-field">
          <span className="cal-field__label">Name</span>
          <input
            className="cal-field__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Balayage"
            autoFocus
            required
          />
        </label>

        <label className="cal-field">
          <span className="cal-field__label">Category</span>
          <input
            className="cal-field__input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Color"
          />
        </label>

        <div className="cal-fieldRow">
          <label className="cal-field">
            <span className="cal-field__label">Price ($)</span>
            <input
              type="number"
              className="cal-field__input"
              min={0}
              step={5}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              required
            />
          </label>
          <label className="cal-field">
            <span className="cal-field__label">Duration (min)</span>
            <input
              type="number"
              className="cal-field__input"
              min={5}
              step={5}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required
            />
          </label>
        </div>

        <div className="cal-field">
          <span className="cal-field__label">Price type</span>
          <div className="cal-segment">
            {SVC_PRICE_TYPES.map((opt) => (
              <button
                type="button"
                key={opt.id}
                className={`cal-segment__opt${priceType === opt.id ? ' is-active' : ''}`}
                onClick={() => setPriceType(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="cal-modal__row">
          <button type="button" className="cal-modal__btn cal-modal__btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="cal-modal__btn cal-modal__btn--primary">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

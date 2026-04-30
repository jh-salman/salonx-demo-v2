import React, { useMemo, useState } from "react";
import "../style/climax.css";
import { MOCK_SERVICES } from "../../data/mockServices";

const DEFAULT_CLIENT = {
  name: "David Thurston",
  date: "July 28, 2025",
};

const INITIAL_SERVICES = [
  { id: "svc-haircut", name: "Haircut", price: 35 },
  { id: "svc-beard", name: "Beard Trim", price: 20 },
];

const INITIAL_PRODUCTS = [
  { id: "prd-pomade", name: "Pomade", price: 20, accent: "#ff7819" },
  { id: "prd-beard-oil", name: "Beard oil", price: 15, accent: "#ff7819" },
];

const FUTURE_APPOINTMENT = {
  label: "5/15/2024 - Haircut",
  price: 20,
};


const MOCK_PRODUCTS_TO_ADD = [
  { name: "Hair Gel", price: 12, accent: "#ff7819" },
  { name: "Shampoo", price: 18, accent: "#ff7819" },
  { name: "Comb", price: 5, accent: "#ff7819" },
];

function formatMoney(n) {
  return `$${n.toFixed(2)}`;
}

function getAccentColor(products, selected) {
  const firstSelected = products.find((p) => selected[p.id]);
  return firstSelected?.accent ?? "#ff7819";
}

export default function Climax() {
  const [services, setServices] = useState(INITIAL_SERVICES);
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [selectedProducts, setSelectedProducts] = useState(() =>
    Object.fromEntries(INITIAL_PRODUCTS.map((p) => [p.id, true]))
  );

  const [modifyOpen, setModifyOpen] = useState(false);
  const [modifyTarget, setModifyTarget] = useState(null); // { type: 'service'|'product', id }
  const [editModal, setEditModal] = useState(null);
  const [globalDiscount, setGlobalDiscount] = useState({ value: 0, isPercent: false });

  const longPressTimeout = React.useRef(null);
  const handleLongPress = (callback, ms = 2000) => ({
    onPointerDown: () => {
      if (longPressTimeout.current) clearTimeout(longPressTimeout.current);
      longPressTimeout.current = setTimeout(() => {
        callback();
      }, ms);
    },
    onPointerUp: () => clearTimeout(longPressTimeout.current),
    onPointerLeave: () => clearTimeout(longPressTimeout.current),
    onContextMenu: (e) => e.preventDefault()
  });

  const accent = useMemo(
    () => getAccentColor(products, selectedProducts),
    [products, selectedProducts]
  );

  const totals = useMemo(() => {
    const serviceTotal = services.reduce((sum, s) => sum + s.price, 0);
    const productTotal = products.reduce(
      (sum, p) => sum + (selectedProducts[p.id] ? p.price : 0),
      0
    );
    let total = serviceTotal + productTotal;
    if (globalDiscount.value > 0) {
      if (globalDiscount.isPercent) {
        total = Math.max(0, total - (total * (globalDiscount.value / 100)));
      } else {
        total = Math.max(0, total - globalDiscount.value);
      }
    }
    return { serviceTotal, productTotal, total };
  }, [services, products, selectedProducts, globalDiscount]);

  function openModify(type, id) {
    setModifyTarget({ type, id });
    setModifyOpen(true);
  }

  function closeModify() {
    setModifyOpen(false);
    setModifyTarget(null);
  }

  return (
    <div className="climax-root" style={{ ["--climax-accent"]: accent }}>
      {/* Co-brand header area (placeholder) */}
      <div className="climax-brandbar" aria-label="Co-brand header area">
        <img className="climax-brandbar__logo" src="/l3vel3.png" alt="L3VEL3" />
      </div>

      {/* Stage with inlay behind glass (placeholder) */}
      <div className="climax-stage" aria-label="ClimaX stage">
        <div className="climax-inlay" aria-label="Inlay behind glass" />

        <div className="climax-glass" role="region" aria-label="Glass overlay">
          <div className="climax-scroll">
            <div className="climax-client">
              <div className="climax-client__name">{DEFAULT_CLIENT.name}</div>
              <div className="climax-client__date">{DEFAULT_CLIENT.date}</div>
            </div>

            <section className="climax-section" aria-label="Services">
              <div 
                className="climax-section__title" 
                {...handleLongPress(() => openModify("service", null))}
                style={{ cursor: "pointer", userSelect: "none", WebkitTouchCallout: "none" }}
              >
                SERVICES
              </div>
              <div className="climax-list">
                {services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="climax-row"
                    {...handleLongPress(() => openModify("service", s.id))}
                  >
                    <span className="climax-row__label">{s.name}</span>
                    <span className="climax-row__value">{formatMoney(s.price)}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="climax-section climax-section--products" aria-label="Client care">
              <div 
                className="climax-section__title"
                {...handleLongPress(() => openModify("product", null))}
                style={{ cursor: "pointer", userSelect: "none", WebkitTouchCallout: "none" }}
              >
                CLIENT CARE
              </div>
              <div className="climax-list">
                {products.map((p) => {
                  const on = !!selectedProducts[p.id];
                  return (
                    <div key={p.id} className="climax-row climax-row--static">
                      <button
                        type="button"
                        className="climax-row__touch"
                        {...handleLongPress(() => openModify("product", p.id))}
                        aria-label={`Modify ${p.name}`}
                      >
                        <span className="climax-row__label">{p.name}</span>
                        <span className="climax-row__value">{formatMoney(p.price)}</span>
                      </button>

                      <button
                        type="button"
                        className={`climax-pill ${on ? "is-on" : "is-off"}`}
                        onClick={() =>
                          setSelectedProducts((prev) => ({
                            ...prev,
                            [p.id]: !prev[p.id],
                          }))
                        }
                        aria-pressed={on}
                        aria-label={`${p.name} ${on ? "on" : "off"}`}
                      >
                        <span className="climax-pill__track" />
                        <span className="climax-pill__thumb" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="climax-divider" />

            <section className="climax-section" aria-label="Future appointment">
              <div className="climax-section__title">FUTURE APPOINTMENT</div>
              <div className="climax-list">
                <div className="climax-row climax-row--static">
                  <div className="climax-row__touch" aria-hidden="true">
                    <span className="climax-row__label">{FUTURE_APPOINTMENT.label}</span>
                  </div>
                </div>
              </div>
            </section>

            <div className="climax-divider" />

            <div 
              className="climax-total" 
              {...handleLongPress(() => setEditModal({ mode: 'discountTicket', type: 'ticket', id: null, name: '', price: '' }))}
              style={{ userSelect: "none", WebkitTouchCallout: "none", cursor: "pointer" }}
            >
              <span>Total</span>
              <span>{formatMoney(totals.total)}</span>
            </div>
          </div>

          <div className="climax-footer">
            <div className="climax-actions" aria-label="Payment actions">
              <button type="button" className="climax-actionBtn">
                CASH
              </button>
              <button type="button" className="climax-actionBtn">
                CREDIT
              </button>
              <button type="button" className="climax-actionBtn">
                OTHER
              </button>
            </div>
          </div>
        </div>
      </div>

      {modifyOpen ? (
        <div className="climax-modal" role="dialog" aria-modal="true">
          <button
            type="button"
            className="climax-modal__backdrop"
            onClick={closeModify}
            aria-label="Close"
          />
          <div className="climax-modal__panel">
            <div className="climax-modal__title">Modify</div>
            <div className="climax-modal__subtitle">
              {modifyTarget?.type === "service" ? "Service" : "Product"}
            </div>

            <div className="climax-modal__grid">
              <button 
                type="button" 
                className="climax-modal__btn"
                onClick={() => {
                  if (!modifyTarget || !modifyTarget.id) return;
                  const itemList = modifyTarget.type === "service" ? services : products;
                  const item = itemList.find((i) => i.id === modifyTarget.id);
                  if (item) {
                    setEditModal({ mode: 'change', type: modifyTarget.type, id: item.id, name: item.name, price: item.price.toString() });
                  }
                  closeModify();
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="climax-modal__btn"
                onClick={() => {
                  setEditModal({ mode: 'select', type: modifyTarget?.type || "service", id: null, name: '', price: '' });
                  closeModify();
                }}
              >
                Add
              </button>
              <button
                type="button"
                className="climax-modal__btn"
                onClick={() => {
                  if (!modifyTarget || !modifyTarget.id) return;
                  if (modifyTarget.type === "service") {
                    setServices((prev) => prev.filter((s) => s.id !== modifyTarget.id));
                  } else {
                    setProducts((prev) => prev.filter((p) => p.id !== modifyTarget.id));
                  }
                  closeModify();
                }}
              >
                Delete
              </button>
              <button 
                type="button" 
                className="climax-modal__btn"
                onClick={() => {
                  if (!modifyTarget || !modifyTarget.id) return;
                  setEditModal({ mode: 'discount', type: modifyTarget.type, id: modifyTarget.id, name: '', price: '' });
                  closeModify();
                }}
              >
                Discount
              </button>
              <button 
                type="button" 
                className="climax-modal__btn climax-modal__btn--wide"
                onClick={() => {
                  setEditModal({ mode: 'discountAll', type: modifyTarget?.type || "service", id: null, name: '', price: '' });
                  closeModify();
                }}
              >
                Discount All {modifyTarget?.type === "service" ? "Services" : "Products"}
              </button>
            </div>

            <button type="button" className="climax-modal__close" onClick={closeModify}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {editModal ? (
        <div className="climax-modal" role="dialog" aria-modal="true">
          <button
            type="button"
            className="climax-modal__backdrop"
            onClick={() => setEditModal(null)}
            aria-label="Close"
          />
          <div className="climax-modal__panel">
            <div className="climax-modal__title">
              {editModal.mode === "change" ? "Edit" : 
               editModal.mode === "select" ? "Select" : 
               editModal.mode === "discount" ? "Discount" : 
               editModal.mode === "discountTicket" ? "Discount Ticket" : "Discount All"} 
               {" "}
               {editModal.type === "ticket" ? "" : editModal.type === "service" ? "Service" : "Product"}
            </div>
            {editModal.mode === "select" ? (
              <div className="climax-scroll" style={{ maxHeight: "300px", marginTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {editModal.type === "service" ? (
                  MOCK_SERVICES.map(svc => (
                    <button 
                      key={svc.id} 
                      type="button"
                      className="climax-row" 
                      onClick={() => {
                        setServices(prev => [...prev, { ...svc, id: `svc-mock-${Date.now()}` }]);
                        setEditModal(null);
                      }}
                    >
                      <span className="climax-row__label" style={{textAlign: "left"}}>{svc.name}</span>
                      <span className="climax-row__value">{formatMoney(svc.price)}</span>
                    </button>
                  ))
                ) : (
                  MOCK_PRODUCTS_TO_ADD.map((prd, i) => (
                    <button 
                      key={i} 
                      type="button"
                      className="climax-row" 
                      onClick={() => {
                        const newId = `prd-mock-${Date.now()}`;
                        setProducts(prev => [...prev, { ...prd, id: newId }]);
                        setSelectedProducts(prev => ({ ...prev, [newId]: true }));
                        setEditModal(null);
                      }}
                    >
                      <span className="climax-row__label" style={{textAlign: "left"}}>{prd.name}</span>
                      <span className="climax-row__value">{formatMoney(prd.price)}</span>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="climax-form">
                {editModal.mode === "change" && (
                  <input 
                    className="climax-input" 
                    value={editModal.name}
                    onChange={e => setEditModal(prev => ({...prev, name: e.target.value}))}
                    placeholder="Name"
                  />
                )}
                <input 
                  className="climax-input" 
                  type={editModal.mode.includes("discount") ? "text" : "number"}
                  value={editModal.price}
                  onChange={e => setEditModal(prev => ({...prev, price: e.target.value}))}
                  placeholder={editModal.mode.includes("discount") ? "Discount (e.g. 10 or 10%)" : "Price"}
                />
              </div>
            )}

            <div className="climax-modal__grid" style={{ marginTop: 14 }}>
              {editModal.mode !== "select" && (
                <button 
                  type="button" 
                  className="climax-modal__btn"
                  onClick={() => {
                    const { mode, type, id, name, price } = editModal;
                    const priceStr = price.toString().trim();
                    const isPercent = priceStr.endsWith('%');
                    const numPrice = Number(priceStr.replace('%', '')) || 0;

                    if (mode === "change") {
                      if (type === "service") {
                        setServices(prev => prev.map(s => s.id === id ? { ...s, name: name || s.name, price: numPrice } : s));
                      } else {
                        setProducts(prev => prev.map(p => p.id === id ? { ...p, name: name || p.name, price: numPrice } : p));
                      }
                    } else if (mode === "discount") {
                      const applyDiscount = (p) => isPercent ? Math.max(0, p - (p * (numPrice / 100))) : Math.max(0, p - numPrice);
                      if (type === "service") {
                        setServices(prev => prev.map(s => s.id === id ? { ...s, price: applyDiscount(s.price) } : s));
                      } else {
                        setProducts(prev => prev.map(p => p.id === id ? { ...p, price: applyDiscount(p.price) } : p));
                      }
                    } else if (mode === "discountAll") {
                      const applyDiscount = (p) => isPercent ? Math.max(0, p - (p * (numPrice / 100))) : Math.max(0, p - numPrice);
                      if (type === "service") {
                        setServices(prev => prev.map(s => ({ ...s, price: applyDiscount(s.price) })));
                      } else {
                        setProducts(prev => prev.map(p => ({ ...p, price: applyDiscount(p.price) })));
                      }
                    } else if (mode === "discountTicket") {
                      setGlobalDiscount({ value: numPrice, isPercent });
                    }
                    setEditModal(null);
                  }}
                >
                  Save
                </button>
              )}
              <button 
                type="button" 
                className={`climax-modal__btn ${editModal.mode === "select" ? "climax-modal__btn--wide" : ""}`}
                onClick={() => setEditModal(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


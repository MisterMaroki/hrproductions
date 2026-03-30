"use client";

import { useState, useEffect, useCallback } from "react";
import AdminNav from "../components/AdminNav";
import styles from "./page.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InputField {
  key: string;
  label: string;
  type: "number" | "select" | "boolean";
  min?: number;
  max?: number;
  default?: number | string | boolean;
  options?: { value: string | number; label: string }[];
}

interface PricingRule {
  type: string;
  input?: string;
  rate?: number;
  freeUnits?: number;
  threshold?: number;
  percent?: number;
  minValue?: number;
  tiers?: { label: string; value: string | number; price: number }[];
}

interface PricingRules {
  basePrice: number;
  rules: PricingRule[];
}

interface DurationRules {
  baseMinutes: number;
  scaling?: { input: string; rate: number; freeUnits: number };
}

interface BrandOverride {
  id: string;
  brandMode: string;
  visible: number;
  pricingRules: PricingRules | null;
  durationRules: DurationRules | null;
  inputFields: InputField[] | null;
}

interface Service {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  pricingRules: PricingRules;
  durationRules: DurationRules;
  inputFields: InputField[];
  isAddon: number;
  parentServiceId: string | null;
  sortOrder: number;
  visible: number;
  overrides: BrandOverride[];
}

interface Category {
  id: string;
  name: string;
  sortOrder: number;
  services: Service[];
}

// ─── Default values ───────────────────────────────────────────────────────────

function defaultPricingRules(): PricingRules {
  return { basePrice: 0, rules: [] };
}

function defaultDurationRules(): DurationRules {
  return { baseMinutes: 60 };
}

// ─── PricingRulesEditor ───────────────────────────────────────────────────────

interface PricingRulesEditorProps {
  rules: PricingRules;
  onChange: (r: PricingRules) => void;
  availableInputs: string[];
}

function PricingRulesEditor({ rules, onChange, availableInputs }: PricingRulesEditorProps) {
  const perUnit = rules.rules.find((r) => r.type === "perUnit");
  const fixedTier = rules.rules.find((r) => r.type === "fixedTier");
  const bulkDiscount = rules.rules.find((r) => r.type === "bulkDiscount");
  const minQty = rules.rules.find((r) => r.type === "minimum");

  const pricingType = perUnit ? "perUnit" : fixedTier ? "fixedTier" : "flatRate";

  const updateBasePrice = (val: string) => {
    onChange({ ...rules, basePrice: parseFloat(val) || 0 });
  };

  const setPricingType = (type: string) => {
    const filtered = rules.rules.filter(
      (r) => r.type !== "perUnit" && r.type !== "fixedTier"
    );
    if (type === "perUnit") {
      onChange({
        ...rules,
        rules: [
          ...filtered,
          { type: "perUnit", input: availableInputs[0] || "", rate: 0, freeUnits: 0 },
        ],
      });
    } else if (type === "fixedTier") {
      onChange({
        ...rules,
        rules: [
          ...filtered,
          { type: "fixedTier", tiers: [] },
        ],
      });
    } else {
      onChange({ ...rules, rules: filtered });
    }
  };

  const updatePerUnit = (patch: Partial<PricingRule>) => {
    onChange({
      ...rules,
      rules: rules.rules.map((r) => (r.type === "perUnit" ? { ...r, ...patch } : r)),
    });
  };

  const updateTier = (idx: number, patch: Partial<{ label: string; value: string | number; price: number }>) => {
    onChange({
      ...rules,
      rules: rules.rules.map((r) =>
        r.type === "fixedTier"
          ? { ...r, tiers: r.tiers!.map((t, i) => (i === idx ? { ...t, ...patch } : t)) }
          : r
      ),
    });
  };

  const addTier = () => {
    onChange({
      ...rules,
      rules: rules.rules.map((r) =>
        r.type === "fixedTier"
          ? { ...r, tiers: [...(r.tiers || []), { label: "", value: "", price: 0 }] }
          : r
      ),
    });
  };

  const removeTier = (idx: number) => {
    onChange({
      ...rules,
      rules: rules.rules.map((r) =>
        r.type === "fixedTier"
          ? { ...r, tiers: r.tiers!.filter((_, i) => i !== idx) }
          : r
      ),
    });
  };

  const toggleBulkDiscount = (checked: boolean) => {
    if (checked) {
      onChange({
        ...rules,
        rules: [
          ...rules.rules.filter((r) => r.type !== "bulkDiscount"),
          { type: "bulkDiscount", input: availableInputs[0] || "", threshold: 10, percent: 10 },
        ],
      });
    } else {
      onChange({ ...rules, rules: rules.rules.filter((r) => r.type !== "bulkDiscount") });
    }
  };

  const updateBulkDiscount = (patch: Partial<PricingRule>) => {
    onChange({
      ...rules,
      rules: rules.rules.map((r) => (r.type === "bulkDiscount" ? { ...r, ...patch } : r)),
    });
  };

  const toggleMinQty = (checked: boolean) => {
    if (checked) {
      onChange({
        ...rules,
        rules: [
          ...rules.rules.filter((r) => r.type !== "minimum"),
          { type: "minimum", input: availableInputs[0] || "", minValue: 1 },
        ],
      });
    } else {
      onChange({ ...rules, rules: rules.rules.filter((r) => r.type !== "minimum") });
    }
  };

  const updateMinQty = (patch: Partial<PricingRule>) => {
    onChange({
      ...rules,
      rules: rules.rules.map((r) => (r.type === "minimum" ? { ...r, ...patch } : r)),
    });
  };

  return (
    <div className={styles.pricingEditor}>
      <div className={styles.pricingRow}>
        <label className={styles.fieldLabel}>Base Price</label>
        <div className={styles.priceInput}>
          <span className={styles.currencySymbol}>£</span>
          <input
            className={styles.smallInput}
            type="number"
            min="0"
            step="0.01"
            value={rules.basePrice}
            onChange={(e) => updateBasePrice(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.pricingRow}>
        <label className={styles.fieldLabel}>Pricing Type</label>
        <div className={styles.radioGroup}>
          {[
            { value: "flatRate", label: "Fixed price" },
            { value: "perUnit", label: "Scales with input" },
            { value: "fixedTier", label: "Tiered options" },
          ].map((opt) => (
            <label key={opt.value} className={styles.radioLabel}>
              <input
                type="radio"
                name="pricingType"
                value={opt.value}
                checked={pricingType === opt.value}
                onChange={() => setPricingType(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {pricingType === "perUnit" && perUnit && (
        <div className={styles.pricingSubRow}>
          <span>+</span>
          <span className={styles.currencySymbol}>£</span>
          <input
            className={styles.smallInput}
            type="number"
            min="0"
            step="0.01"
            value={perUnit.rate ?? 0}
            onChange={(e) => updatePerUnit({ rate: parseFloat(e.target.value) || 0 })}
          />
          <span>per</span>
          <select
            className={styles.smallSelect}
            value={perUnit.input || ""}
            onChange={(e) => updatePerUnit({ input: e.target.value })}
          >
            {availableInputs.length === 0 && <option value="">—</option>}
            {availableInputs.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <span>above</span>
          <input
            className={styles.smallInput}
            type="number"
            min="0"
            value={perUnit.freeUnits ?? 0}
            onChange={(e) => updatePerUnit({ freeUnits: parseInt(e.target.value) || 0 })}
          />
        </div>
      )}

      {pricingType === "fixedTier" && fixedTier && (
        <div className={styles.tiersSection}>
          {(fixedTier.tiers || []).map((tier, idx) => (
            <div key={idx} className={styles.tierRow}>
              <input
                className={styles.smallInput}
                type="text"
                placeholder="Label"
                value={tier.label}
                onChange={(e) => updateTier(idx, { label: e.target.value })}
              />
              <input
                className={styles.smallInput}
                type="text"
                placeholder="Value"
                value={String(tier.value)}
                onChange={(e) => updateTier(idx, { value: e.target.value })}
              />
              <span className={styles.currencySymbol}>£</span>
              <input
                className={styles.smallInput}
                type="number"
                min="0"
                step="0.01"
                placeholder="Price"
                value={tier.price}
                onChange={(e) => updateTier(idx, { price: parseFloat(e.target.value) || 0 })}
              />
              <button
                type="button"
                className={styles.removeTierBtn}
                onClick={() => removeTier(idx)}
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className={styles.addTierBtn} onClick={addTier}>
            + Add tier
          </button>
        </div>
      )}

      <div className={styles.modifiersSection}>
        <div className={styles.modifierRow}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={!!bulkDiscount}
              onChange={(e) => toggleBulkDiscount(e.target.checked)}
            />
            Bulk discount
          </label>
          {bulkDiscount && (
            <div className={styles.modifierDetail}>
              <input
                className={styles.smallInput}
                type="number"
                min="0"
                max="100"
                value={bulkDiscount.percent ?? 0}
                onChange={(e) =>
                  updateBulkDiscount({ percent: parseFloat(e.target.value) || 0 })
                }
              />
              <span>% off when</span>
              <select
                className={styles.smallSelect}
                value={bulkDiscount.input || ""}
                onChange={(e) => updateBulkDiscount({ input: e.target.value })}
              >
                {availableInputs.length === 0 && <option value="">—</option>}
                {availableInputs.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <span>is</span>
              <input
                className={styles.smallInput}
                type="number"
                min="0"
                value={bulkDiscount.threshold ?? 0}
                onChange={(e) =>
                  updateBulkDiscount({ threshold: parseInt(e.target.value) || 0 })
                }
              />
              <span>or more</span>
            </div>
          )}
        </div>

        <div className={styles.modifierRow}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={!!minQty}
              onChange={(e) => toggleMinQty(e.target.checked)}
            />
            Minimum quantity
          </label>
          {minQty && (
            <div className={styles.modifierDetail}>
              <select
                className={styles.smallSelect}
                value={minQty.input || ""}
                onChange={(e) => updateMinQty({ input: e.target.value })}
              >
                {availableInputs.length === 0 && <option value="">—</option>}
                {availableInputs.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <span>must be at least</span>
              <input
                className={styles.smallInput}
                type="number"
                min="1"
                value={minQty.minValue ?? 1}
                onChange={(e) =>
                  updateMinQty({ minValue: parseInt(e.target.value) || 1 })
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Top-level site tab
  const [siteTab, setSiteTab] = useState<"main" | "whitelabel">("main");

  // Create category
  const [newCatName, setNewCatName] = useState("");
  const [creatingCat, setCreatingCat] = useState(false);

  // Inline "add service" state per category
  const [addingServiceFor, setAddingServiceFor] = useState<string | null>(null);
  const [newServiceName, setNewServiceName] = useState("");
  const [creatingService, setCreatingService] = useState(false);

  // Edit state
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Service> | null>(null);
  const [editOverrideDraft, setEditOverrideDraft] = useState<Partial<BrandOverride> | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/services");
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // All services flat list for parent-service dropdown
  const allServices: Service[] = categories.flatMap((c) => c.services);

  // ── Site tab switch ───────────────────────────────────────────────────────

  const switchSiteTab = (tab: "main" | "whitelabel") => {
    setSiteTab(tab);
    // Close any open edit panel when switching tabs
    setEditingServiceId(null);
    setEditDraft(null);
    setEditOverrideDraft(null);
  };

  // ── Category actions ──────────────────────────────────────────────────────

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setCreatingCat(true);
    try {
      const res = await fetch("/api/admin/service-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to create category");
        return;
      }
      setNewCatName("");
      fetchData();
    } finally {
      setCreatingCat(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"? All services in it will also be deleted.`)) return;
    const res = await fetch(`/api/admin/service-categories/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Failed to delete category");
      return;
    }
    fetchData();
  };

  // ── Service actions ───────────────────────────────────────────────────────

  const handleCreateService = async (categoryId: string) => {
    if (!newServiceName.trim()) return;
    setCreatingService(true);
    try {
      // When creating on WL tab: service is globally hidden, WL override makes it visible
      // When creating on main tab: service is globally visible, WL override hides it
      const globalVisible = siteTab === "whitelabel" ? 0 : 1;

      const res = await fetch("/api/admin/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          name: newServiceName.trim(),
          pricingRules: defaultPricingRules(),
          durationRules: defaultDurationRules(),
          inputFields: [],
          visible: globalVisible,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to create service");
        return;
      }

      const created = await res.json();
      const newId = created.id;

      if (newId) {
        // Create the brand override to hide on the OTHER brand
        await fetch(`/api/admin/services/${newId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandOverride: {
              brandMode: siteTab === "main" ? "whitelabel" : "main",
              visible: 0,
              pricingRules: null,
              durationRules: null,
            },
          }),
        });
      }

      setAddingServiceFor(null);
      setNewServiceName("");
      fetchData();
    } finally {
      setCreatingService(false);
    }
  };

  const handleDeleteService = async (id: string, name: string) => {
    if (!confirm(`Delete service "${name}"?`)) return;
    const res = await fetch(`/api/admin/services/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Failed to delete service");
      return;
    }
    if (editingServiceId === id) setEditingServiceId(null);
    fetchData();
  };

  // ── Visibility toggle ─────────────────────────────────────────────────────

  const handleToggleVisible = async (svc: Service) => {
    if (siteTab === "main") {
      // Toggle global visibility
      await fetch(`/api/admin/services/${svc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visible: svc.visible ? 0 : 1 }),
      });
    } else {
      // Toggle whitelabel brand override visibility
      const existing = svc.overrides.find((o) => o.brandMode === "whitelabel");
      const currentVisible = existing != null ? existing.visible : svc.visible;
      await fetch(`/api/admin/services/${svc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandOverride: {
            brandMode: "whitelabel",
            visible: currentVisible ? 0 : 1,
            pricingRules: existing?.pricingRules ?? null,
            durationRules: existing?.durationRules ?? null,
          },
        }),
      });
    }
    fetchData();
  };

  // ── Edit panel ────────────────────────────────────────────────────────────

  const openEdit = (svc: Service) => {
    if (editingServiceId === svc.id) {
      setEditingServiceId(null);
      setEditDraft(null);
      setEditOverrideDraft(null);
      return;
    }
    setEditingServiceId(svc.id);
    setEditDraft({ ...svc });

    if (siteTab === "whitelabel") {
      const existing = svc.overrides.find((o) => o.brandMode === "whitelabel");
      setEditOverrideDraft(
        existing
          ? { ...existing }
          : {
              id: "",
              brandMode: "whitelabel",
              visible: svc.visible,
              pricingRules: svc.pricingRules ? { ...svc.pricingRules } : defaultPricingRules(),
              durationRules: svc.durationRules ? { ...svc.durationRules } : defaultDurationRules(),
              inputFields: svc.inputFields ? [...svc.inputFields] : [],
            }
      );
    } else {
      setEditOverrideDraft(null);
    }
  };

  const handleResetOverride = async (svcId: string) => {
    if (!confirm("Reset White Label pricing to default? This will remove the custom override.")) return;
    await fetch(`/api/admin/services/${svcId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeBrandOverride: { brandMode: "whitelabel" } }),
    });
    setEditingServiceId(null);
    setEditDraft(null);
    setEditOverrideDraft(null);
    fetchData();
  };

  const handleSave = async () => {
    if (!editingServiceId) return;
    setSaving(true);
    try {
      if (siteTab === "main") {
        if (!editDraft) return;
        const res = await fetch(`/api/admin/services/${editingServiceId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editDraft),
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "Failed to save");
          return;
        }
      } else {
        // White label override
        if (!editOverrideDraft) return;
        const res = await fetch(`/api/admin/services/${editingServiceId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brandOverride: { ...editOverrideDraft, brandMode: "whitelabel" } }),
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "Failed to save override");
          return;
        }
      }
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  // ── Helper: get effective whitelabel visibility ───────────────────────────

  const getWlVisible = (svc: Service): number => {
    const existing = svc.overrides.find((o) => o.brandMode === "whitelabel");
    return existing != null ? existing.visible : svc.visible;
  };

  const hasWlOverride = (svc: Service): boolean =>
    svc.overrides.some((o) => o.brandMode === "whitelabel");

  const hasCustomPricing = (svc: Service): boolean => {
    const ov = svc.overrides.find((o) => o.brandMode === "whitelabel");
    return !!ov && ov.pricingRules != null;
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <AdminNav />
      <main className={styles.main}>
        <div className={styles.container}>
          <h2 className={styles.title}>Services &amp; Pricing</h2>

          {/* Top-level site tabs */}
          <div className={styles.siteTabs}>
            <button
              className={`${styles.siteTab} ${siteTab === "main" ? styles.siteTabActive : ""}`}
              onClick={() => switchSiteTab("main")}
            >
              Main Site
            </button>
            <button
              className={`${styles.siteTab} ${siteTab === "whitelabel" ? styles.siteTabActive : ""}`}
              onClick={() => switchSiteTab("whitelabel")}
            >
              White Label
            </button>
          </div>

          {loading ? (
            <p className={styles.empty}>Loading…</p>
          ) : (
            <>
              {categories.map((cat) => (
                <div key={cat.id} className={styles.categoryBlock}>
                  {/* Category header */}
                  <div className={styles.categoryHeader}>
                    <span className={styles.categoryName}>{cat.name}</span>
                    <button
                      className={styles.deleteCatBtn}
                      onClick={() => handleDeleteCategory(cat.id, cat.name)}
                    >
                      Delete Category
                    </button>
                  </div>

                  {/* Services list */}
                  <div className={styles.servicesList}>
                    {cat.services.length === 0 && (
                      <p className={styles.emptyServices}>No services yet</p>
                    )}

                    {/* Header row */}
                    {cat.services.length > 0 && (
                      <div className={styles.serviceRowHeader}>
                        <span>Service</span>
                        <span>Base Price</span>
                        <span>Visible</span>
                        <span></span>
                        <span></span>
                      </div>
                    )}

                    {cat.services.map((svc) => {
                      const wlVisible = getWlVisible(svc);
                      const hasOverride = hasWlOverride(svc);
                      const customPricing = hasCustomPricing(svc);

                      return (
                        <div key={svc.id}>
                          <div className={styles.serviceRow}>
                            <span className={styles.serviceName}>
                              {svc.isAddon ? "↳ " : ""}
                              {svc.name}
                              {siteTab === "whitelabel" && customPricing && (
                                <span className={styles.customBadge}>Custom pricing</span>
                              )}
                            </span>
                            <span className={styles.servicePrice}>
                              {siteTab === "main"
                                ? `£${svc.pricingRules?.basePrice?.toFixed(2) ?? "0.00"}`
                                : (() => {
                                    const ov = svc.overrides.find((o) => o.brandMode === "whitelabel");
                                    const price = ov?.pricingRules?.basePrice ?? svc.pricingRules?.basePrice;
                                    return `£${price?.toFixed(2) ?? "0.00"}`;
                                  })()}
                            </span>
                            <button
                              className={`${styles.toggleBtn} ${
                                (siteTab === "main" ? svc.visible : wlVisible)
                                  ? styles.toggleActive
                                  : styles.toggleInactive
                              }`}
                              onClick={() => handleToggleVisible(svc)}
                            >
                              {(siteTab === "main" ? svc.visible : wlVisible) ? "On" : "Off"}
                              {siteTab === "whitelabel" && !hasOverride && (
                                <span className={styles.inheritedMark}> (default)</span>
                              )}
                            </button>
                            <button
                              className={`${styles.editBtn} ${editingServiceId === svc.id ? styles.editBtnActive : ""}`}
                              onClick={() => openEdit(svc)}
                            >
                              {editingServiceId === svc.id ? "Close" : "Edit"}
                            </button>
                            <button
                              className={styles.deleteBtn}
                              onClick={() => handleDeleteService(svc.id, svc.name)}
                            >
                              ✕
                            </button>
                          </div>

                          {/* Edit panel */}
                          {editingServiceId === svc.id && (
                            <div className={styles.editPanel}>
                              {siteTab === "main" && editDraft && (
                                <div className={styles.editFields}>
                                  {/* Name */}
                                  <label className={styles.fieldGroup}>
                                    <span className={styles.fieldLabel}>Name</span>
                                    <input
                                      className={styles.editInput}
                                      type="text"
                                      value={editDraft.name || ""}
                                      onChange={(e) =>
                                        setEditDraft({ ...editDraft, name: e.target.value })
                                      }
                                    />
                                  </label>

                                  {/* Description */}
                                  <label className={styles.fieldGroup}>
                                    <span className={styles.fieldLabel}>Description</span>
                                    <textarea
                                      className={styles.editTextarea}
                                      value={editDraft.description || ""}
                                      onChange={(e) =>
                                        setEditDraft({ ...editDraft, description: e.target.value })
                                      }
                                    />
                                  </label>

                                  {/* Category */}
                                  <label className={styles.fieldGroup}>
                                    <span className={styles.fieldLabel}>Category</span>
                                    <select
                                      className={styles.editSelect}
                                      value={editDraft.categoryId || ""}
                                      onChange={(e) =>
                                        setEditDraft({ ...editDraft, categoryId: e.target.value })
                                      }
                                    >
                                      {categories.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                      ))}
                                    </select>
                                  </label>

                                  {/* Is add-on */}
                                  <div className={styles.fieldGroup}>
                                    <label className={styles.checkboxLabel}>
                                      <input
                                        type="checkbox"
                                        checked={!!editDraft.isAddon}
                                        onChange={(e) =>
                                          setEditDraft({
                                            ...editDraft,
                                            isAddon: e.target.checked ? 1 : 0,
                                            parentServiceId: e.target.checked
                                              ? editDraft.parentServiceId
                                              : null,
                                          })
                                        }
                                      />
                                      Is add-on service
                                    </label>
                                    {!!editDraft.isAddon && (
                                      <div className={styles.parentServiceRow}>
                                        <span className={styles.fieldLabel}>Parent Service</span>
                                        <select
                                          className={styles.editSelect}
                                          value={editDraft.parentServiceId || ""}
                                          onChange={(e) =>
                                            setEditDraft({
                                              ...editDraft,
                                              parentServiceId: e.target.value || null,
                                            })
                                          }
                                        >
                                          <option value="">— None —</option>
                                          {allServices
                                            .filter((s) => s.id !== svc.id && !s.isAddon)
                                            .map((s) => (
                                              <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                      </div>
                                    )}
                                  </div>

                                  {/* Pricing */}
                                  <div className={styles.sectionBlock}>
                                    <div className={styles.sectionLabel}>Pricing</div>
                                    <PricingRulesEditor
                                      rules={editDraft.pricingRules || defaultPricingRules()}
                                      onChange={(r) => setEditDraft({ ...editDraft, pricingRules: r })}
                                      availableInputs={(editDraft.inputFields || []).map((f) => f.key)}
                                    />
                                  </div>

                                  {/* Duration */}
                                  <div className={styles.sectionBlock}>
                                    <div className={styles.sectionLabel}>Duration</div>
                                    <DurationEditor
                                      rules={editDraft.durationRules || defaultDurationRules()}
                                      onChange={(r) => setEditDraft({ ...editDraft, durationRules: r })}
                                      availableInputs={(editDraft.inputFields || []).map((f) => f.key)}
                                    />
                                  </div>

                                  {/* Custom Input Fields */}
                                  <div className={styles.sectionBlock}>
                                    <div className={styles.sectionLabel}>Custom Input Fields</div>
                                    <InputFieldsEditor
                                      fields={editDraft.inputFields || []}
                                      onChange={(fields) => setEditDraft({ ...editDraft, inputFields: fields })}
                                    />
                                  </div>
                                </div>
                              )}

                              {siteTab === "whitelabel" && editOverrideDraft && (
                                <div className={styles.editFields}>
                                  {/* Pricing override */}
                                  <div className={styles.sectionBlock}>
                                    <div className={styles.sectionLabel}>Pricing</div>
                                    <PricingRulesEditor
                                      rules={editOverrideDraft.pricingRules || defaultPricingRules()}
                                      onChange={(r) =>
                                        setEditOverrideDraft({ ...editOverrideDraft, pricingRules: r })
                                      }
                                      availableInputs={
                                        (editOverrideDraft.inputFields || svc.inputFields || []).map((f) => f.key)
                                      }
                                    />
                                  </div>

                                  {/* Duration override */}
                                  <div className={styles.sectionBlock}>
                                    <div className={styles.sectionLabel}>Duration</div>
                                    <DurationEditor
                                      rules={editOverrideDraft.durationRules || defaultDurationRules()}
                                      onChange={(r) =>
                                        setEditOverrideDraft({ ...editOverrideDraft, durationRules: r })
                                      }
                                      availableInputs={
                                        (editOverrideDraft.inputFields || svc.inputFields || []).map((f) => f.key)
                                      }
                                    />
                                  </div>

                                  {/* Input Fields override */}
                                  <div className={styles.sectionBlock}>
                                    <div className={styles.sectionLabel}>Custom Input Fields</div>
                                    <InputFieldsEditor
                                      fields={editOverrideDraft.inputFields || svc.inputFields || []}
                                      onChange={(fields) =>
                                        setEditOverrideDraft({ ...editOverrideDraft, inputFields: fields })
                                      }
                                    />
                                  </div>

                                  {hasWlOverride(svc) && (
                                    <div>
                                      <button
                                        className={styles.resetOverrideBtn}
                                        onClick={() => handleResetOverride(svc.id)}
                                      >
                                        Reset to Default
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className={styles.editActions}>
                                <button
                                  className={styles.saveBtn}
                                  onClick={handleSave}
                                  disabled={saving}
                                >
                                  {saving ? "Saving…" : "Save Changes"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Inline add service row */}
                    {addingServiceFor === cat.id ? (
                      <div className={styles.addServiceRow}>
                        <input
                          className={styles.addServiceInput}
                          type="text"
                          placeholder="Service name"
                          value={newServiceName}
                          autoFocus
                          onChange={(e) => setNewServiceName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleCreateService(cat.id);
                            if (e.key === "Escape") {
                              setAddingServiceFor(null);
                              setNewServiceName("");
                            }
                          }}
                        />
                        <button
                          className={styles.createBtn}
                          onClick={() => handleCreateService(cat.id)}
                          disabled={creatingService}
                        >
                          {creatingService ? "Creating…" : "Create"}
                        </button>
                        <button
                          className={styles.cancelBtn}
                          onClick={() => {
                            setAddingServiceFor(null);
                            setNewServiceName("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className={styles.addServiceBtn}
                        onClick={() => {
                          setAddingServiceFor(cat.id);
                          setNewServiceName("");
                        }}
                      >
                        + Add Service
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Create category */}
              <form className={styles.createCatForm} onSubmit={handleCreateCategory}>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="New category name"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                />
                <button className={styles.createBtn} type="submit" disabled={creatingCat}>
                  {creatingCat ? "Creating…" : "Create Category"}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </>
  );
}

// ─── DurationEditor ───────────────────────────────────────────────────────────

interface DurationEditorProps {
  rules: DurationRules;
  onChange: (r: DurationRules) => void;
  availableInputs: string[];
}

function DurationEditor({ rules, onChange, availableInputs }: DurationEditorProps) {
  return (
    <div className={styles.durationEditor}>
      <div className={styles.pricingRow}>
        <label className={styles.fieldLabel}>Base Minutes</label>
        <input
          className={styles.smallInput}
          type="number"
          min="0"
          value={rules.baseMinutes}
          onChange={(e) =>
            onChange({ ...rules, baseMinutes: parseInt(e.target.value) || 0 })
          }
        />
      </div>

      <div className={styles.pricingRow}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={!!rules.scaling}
            onChange={(e) => {
              if (e.target.checked) {
                onChange({
                  ...rules,
                  scaling: { input: availableInputs[0] || "", rate: 1, freeUnits: 0 },
                });
              } else {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { scaling: _s, ...rest } = rules;
                onChange(rest as DurationRules);
              }
            }}
          />
          Duration scales with input
        </label>
      </div>

      {rules.scaling && (
        <div className={styles.pricingSubRow}>
          <span>+</span>
          <input
            className={styles.smallInput}
            type="number"
            min="0"
            value={rules.scaling.rate}
            onChange={(e) =>
              onChange({
                ...rules,
                scaling: { ...rules.scaling!, rate: parseFloat(e.target.value) || 0 },
              })
            }
          />
          <span>min per</span>
          <select
            className={styles.smallSelect}
            value={rules.scaling.input}
            onChange={(e) =>
              onChange({
                ...rules,
                scaling: { ...rules.scaling!, input: e.target.value },
              })
            }
          >
            {availableInputs.length === 0 && <option value="">—</option>}
            {availableInputs.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <span>above</span>
          <input
            className={styles.smallInput}
            type="number"
            min="0"
            value={rules.scaling.freeUnits}
            onChange={(e) =>
              onChange({
                ...rules,
                scaling: { ...rules.scaling!, freeUnits: parseInt(e.target.value) || 0 },
              })
            }
          />
        </div>
      )}
    </div>
  );
}

// ─── InputFieldsEditor ────────────────────────────────────────────────────────

interface InputFieldsEditorProps {
  fields: InputField[];
  onChange: (fields: InputField[]) => void;
}

function InputFieldsEditor({ fields, onChange }: InputFieldsEditorProps) {
  const addField = () => {
    onChange([
      ...fields,
      { key: "", label: "", type: "number" },
    ]);
  };

  const removeField = (idx: number) => {
    onChange(fields.filter((_, i) => i !== idx));
  };

  const updateField = (idx: number, patch: Partial<InputField>) => {
    onChange(fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  return (
    <div className={styles.inputFieldsEditor}>
      {fields.map((field, idx) => (
        <div key={idx} className={styles.inputFieldRow}>
          <input
            className={styles.smallInput}
            type="text"
            placeholder="key"
            value={field.key}
            onChange={(e) => updateField(idx, { key: e.target.value })}
          />
          <input
            className={styles.smallInput}
            type="text"
            placeholder="label"
            value={field.label}
            onChange={(e) => updateField(idx, { label: e.target.value })}
          />
          <select
            className={styles.smallSelect}
            value={field.type}
            onChange={(e) =>
              updateField(idx, { type: e.target.value as InputField["type"] })
            }
          >
            <option value="number">number</option>
            <option value="select">select</option>
            <option value="boolean">boolean</option>
          </select>
          <button
            type="button"
            className={styles.removeTierBtn}
            onClick={() => removeField(idx)}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className={styles.addTierBtn} onClick={addField}>
        + Add input field
      </button>
    </div>
  );
}

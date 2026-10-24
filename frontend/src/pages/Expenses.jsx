import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { api } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { DashboardSkeleton } from '../components/Skeleton';
import styles from './Expenses.module.css';

const CATEGORIES = [
  'food', 'groceries', 'travel', 'rent', 'bills', 'emi',
  'health', 'education', 'shopping', 'entertainment', 'other',
];
const PAYMENT_MODES = ['upi', 'cash', 'card', 'netbanking', 'other'];
const LOCALES = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };

// Local calendar date. toISOString() is UTC, so between midnight and
// 5:30 AM IST it would still report yesterday's date.
const todayISO = () => new Date().toLocaleDateString('en-CA');
const monthOf = (iso) => iso.slice(0, 7);

const shiftMonth = (month, delta) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const formatINR = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2,
}).format(Number(value) || 0);

const catColor = (category) => `var(--cat-${category})`;

const emptyForm = () => ({
  amount: '', category: 'food', spent_on: todayISO(), payment_mode: 'upi', note: '',
});

const Expenses = () => {
  const { t, lang } = useLanguage();
  const locale = LOCALES[lang] || 'en-IN';
  const currentMonth = monthOf(todayISO());

  const [month, setMonth] = useState(currentMonth);
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [filter, setFilter] = useState('all');

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [listRes, summaryRes] = await Promise.all([
        api.getExpenses({ month }),
        api.getExpenseSummary(month),
      ]);
      setExpenses(listRes.data);
      setSummary(summaryRes.data);
    } catch {
      setLoadError(t('expenses.errorLoad'));
    } finally {
      setLoading(false);
    }
    // t only changes with language; re-fetching on language change isn't needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const monthLabel = (m) => {
    const [y, mo] = m.split('-').map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  };

  const dayLabel = (iso) => {
    const today = todayISO();
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');
    const [y, m, d] = iso.split('-').map(Number);
    const formatted = new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
    const rel = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
    if (iso === today) return `${formatted} · ${capitalize(rel.format(0, 'day'))}`;
    if (iso === yesterday) return `${formatted} · ${capitalize(rel.format(-1, 'day'))}`;
    return formatted;
  };

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setFormError(null);
  };

  const startEdit = (exp) => {
    setEditingId(exp.id);
    setFormError(null);
    setForm({
      amount: String(Number(exp.amount)),
      category: exp.category,
      spent_on: exp.spent_on,
      payment_mode: exp.payment_mode || 'other',
      note: exp.note || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      setFormError(t('expenses.amountRequired'));
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload = {
      amount: Math.round(amount * 100) / 100,
      category: form.category,
      spent_on: form.spent_on,
      payment_mode: form.payment_mode,
      note: form.note.trim() || null,
    };
    try {
      if (editingId) {
        await api.updateExpense(editingId, payload);
      } else {
        await api.createExpense(payload);
      }
      const savedMonth = monthOf(payload.spent_on);
      resetForm();
      // Jump to the month the expense belongs to so the user sees it land.
      if (savedMonth !== month) setMonth(savedMonth);
      else load();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setFormError(typeof detail === 'string' ? detail : t('expenses.errorSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await api.downloadExpenseReport(month);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `FinShield-Expenses-${month}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setLoadError(t('expenses.errorPdf'));
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('expenses.confirmDelete'))) return;
    try {
      await api.deleteExpense(id);
      if (editingId === id) resetForm();
      load();
    } catch {
      setLoadError(t('expenses.errorSave'));
    }
  };

  const visible = filter === 'all' ? expenses : expenses.filter((e) => e.category === filter);

  const grouped = useMemo(() => {
    const groups = [];
    visible.forEach((exp) => {
      let g = groups[groups.length - 1];
      if (!g || g.date !== exp.spent_on) {
        g = { date: exp.spent_on, items: [], total: 0 };
        groups.push(g);
      }
      g.items.push(exp);
      g.total += Number(exp.amount);
    });
    return groups;
  }, [visible]);

  const dailyChart = useMemo(() => {
    if (!summary) return [];
    const totals = Object.fromEntries(summary.daily.map((d) => [d.date, Number(d.total)]));
    return Array.from({ length: summary.days_in_month }, (_, i) => {
      const iso = `${summary.month}-${String(i + 1).padStart(2, '0')}`;
      return { day: i + 1, total: totals[iso] || 0 };
    });
  }, [summary]);

  const total = Number(summary?.total || 0);
  const prevTotal = Number(summary?.previous_month_total || 0);
  const change = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('expenses.title')}</h1>
          <p className={styles.subtitle}>{t('expenses.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
        <button type="button" className={styles.downloadBtn} onClick={handleDownload} disabled={downloading || loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          {downloading ? t('expenses.downloadingPdf') : t('expenses.downloadPdf')}
        </button>
        <div className={styles.monthNav}>
          <button type="button" className={styles.monthBtn} onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t('expenses.prevMonth')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <span className={styles.monthLabel}>{monthLabel(month)}</span>
          <button type="button" className={styles.monthBtn} onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= currentMonth} aria-label={t('expenses.nextMonth')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
        </div>
      </div>

      {loadError && <div className={styles.errorBanner}>{loadError}</div>}

      <div className={styles.layout}>
        {/* ---- Add / Edit form ---- */}
        <form className={`${styles.card} ${styles.formCard}`} onSubmit={handleSubmit} noValidate>
          <h2 className={styles.cardTitle}>{editingId ? t('expenses.editTitle') : t('expenses.addTitle')}</h2>

          <label className={styles.label} htmlFor="exp-amount">{t('expenses.amount')}</label>
          <div className={styles.amountField}>
            <span className={styles.rupee}>₹</span>
            <input
              id="exp-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0"
              className={styles.amountInput}
              value={form.amount}
              onChange={(e) => setField('amount', e.target.value)}
            />
          </div>

          <span className={styles.label}>{t('expenses.category')}</span>
          <div className={styles.chips} role="radiogroup" aria-label={t('expenses.category')}>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={form.category === c}
                className={`${styles.chip} ${form.category === c ? styles.chipActive : ''}`}
                style={{ '--chip-color': catColor(c) }}
                onClick={() => setField('category', c)}
              >
                <span className={styles.dot} />
                {t(`cat.${c}`)}
              </button>
            ))}
          </div>

          <div className={styles.row2}>
            <div>
              <label className={styles.label} htmlFor="exp-date">{t('expenses.date')}</label>
              <input
                id="exp-date"
                type="date"
                className={styles.input}
                max={todayISO()}
                value={form.spent_on}
                onChange={(e) => setField('spent_on', e.target.value)}
                required
              />
            </div>
            <div>
              <label className={styles.label} htmlFor="exp-mode">{t('expenses.paymentMode')}</label>
              <select
                id="exp-mode"
                className={styles.input}
                value={form.payment_mode}
                onChange={(e) => setField('payment_mode', e.target.value)}
              >
                {PAYMENT_MODES.map((p) => <option key={p} value={p}>{t(`pay.${p}`)}</option>)}
              </select>
            </div>
          </div>

          <label className={styles.label} htmlFor="exp-note">{t('expenses.note')}</label>
          <input
            id="exp-note"
            type="text"
            maxLength={200}
            className={styles.input}
            placeholder={t('expenses.notePlaceholder')}
            value={form.note}
            onChange={(e) => setField('note', e.target.value)}
          />

          {formError && <p className={styles.formError} role="alert">{formError}</p>}

          <div className={styles.formActions}>
            {editingId && (
              <button type="button" className={styles.secondaryBtn} onClick={resetForm}>{t('expenses.cancel')}</button>
            )}
            <button type="submit" className={styles.primaryBtn} disabled={saving}>
              {saving ? t('expenses.saving') : editingId ? t('expenses.update') : t('expenses.add')}
            </button>
          </div>
        </form>

        {/* ---- Summary + charts ---- */}
        <div className={styles.rightCol}>
          {loading && !summary ? (
            <DashboardSkeleton />
          ) : summary && (
            <>
              <div className={styles.stats}>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>{t('expenses.monthTotal')}</span>
                  <strong className={styles.statValue}>{formatINR(total)}</strong>
                  {change === null ? (
                    <span className={styles.statMuted}>{t('expenses.noLastMonth')}</span>
                  ) : (
                    <span className={change > 0 ? styles.statUp : styles.statDown}>
                      {change > 0 ? '▲' : '▼'} {Math.abs(change).toFixed(0)}% {t('expenses.vsLastMonth')}
                    </span>
                  )}
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>{t('expenses.avgPerDay')}</span>
                  <strong className={styles.statValue}>{formatINR(summary.avg_per_day)}</strong>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>{t('expenses.entries')}</span>
                  <strong className={styles.statValue}>{summary.count}</strong>
                </div>
              </div>

              {summary.count > 0 && (
                <div className={styles.charts}>
                  <div className={styles.card}>
                    <h2 className={styles.cardTitle}>{t('expenses.byCategory')}</h2>
                    <div className={styles.donutWrap}>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={summary.by_category.map((c) => ({ ...c, total: Number(c.total) }))}
                            dataKey="total"
                            nameKey="category"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={2}
                          >
                            {summary.by_category.map((c) => <Cell key={c.category} fill={catColor(c.category)} />)}
                          </Pie>
                          <Tooltip formatter={(v, n) => [formatINR(v), t(`cat.${n}`)]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className={styles.legend}>
                      {summary.by_category.map((c) => {
                        const pct = total ? (Number(c.total) / total) * 100 : 0;
                        return (
                          <li key={c.category} className={styles.legendItem}>
                            <span className={styles.legendName}>
                              <span className={styles.dot} style={{ '--chip-color': catColor(c.category) }} />
                              {t(`cat.${c.category}`)}
                            </span>
                            <span className={styles.legendBar}>
                              <span style={{ width: `${pct}%`, '--chip-color': catColor(c.category) }} />
                            </span>
                            <span className={styles.legendAmt}>{formatINR(c.total)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className={styles.card}>
                    <h2 className={styles.cardTitle}>{t('expenses.daily')}</h2>
                    <ResponsiveContainer width="100%" height={230}>
                      <BarChart data={dailyChart} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" tickLine={false} />
                        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                        <Tooltip formatter={(v) => [formatINR(v), t('expenses.amount')]} labelFormatter={(d) => `${d} ${monthLabel(month)}`} />
                        <Bar dataKey="total" fill="var(--teal)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ---- History ---- */}
      <div className={styles.card}>
        <div className={styles.historyHeader}>
          <h2 className={styles.cardTitle}>{t('expenses.history')}</h2>
          <div className={styles.filterChips}>
            {['all', ...CATEGORIES.filter((c) => expenses.some((e) => e.category === c))].map((c) => (
              <button
                key={c}
                type="button"
                className={`${styles.filterChip} ${filter === c ? styles.filterChipActive : ''}`}
                onClick={() => setFilter(c)}
                aria-pressed={filter === c}
              >
                {c === 'all' ? t('expenses.all') : t(`cat.${c}`)}
              </button>
            ))}
          </div>
        </div>

        {loading && expenses.length === 0 ? null : grouped.length === 0 ? (
          <div className={styles.empty}>
            <p>{t('expenses.empty')}</p>
            <p className={styles.statMuted}>{t('expenses.emptyHint')}</p>
          </div>
        ) : (
          grouped.map((g) => (
            <div key={g.date} className={styles.dayGroup}>
              <div className={styles.dayHeader}>
                <span>{dayLabel(g.date)}</span>
                <span>{formatINR(g.total)}</span>
              </div>
              {g.items.map((exp) => (
                <div key={exp.id} className={`${styles.expenseRow} ${editingId === exp.id ? styles.expenseRowEditing : ''}`}>
                  <span className={styles.catBadge} style={{ '--chip-color': catColor(exp.category) }}>
                    {t(`cat.${exp.category}`)}
                  </span>
                  <div className={styles.expenseMeta}>
                    <span className={styles.expenseNote}>{exp.note || t(`cat.${exp.category}`)}</span>
                    {exp.payment_mode && <span className={styles.statMuted}>{t(`pay.${exp.payment_mode}`)}</span>}
                  </div>
                  <strong className={styles.expenseAmt}>{formatINR(exp.amount)}</strong>
                  <div className={styles.rowActions}>
                    <button type="button" className={styles.iconBtn} onClick={() => startEdit(exp)} aria-label={t('expenses.edit')} title={t('expenses.edit')}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                    </button>
                    <button type="button" className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => handleDelete(exp.id)} aria-label={t('expenses.delete')} title={t('expenses.delete')}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Expenses;

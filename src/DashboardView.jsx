import React, { useState } from 'react';
import { CheckSquare, Square, Plus, Trash2, User, Dices } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function getPersonDisplayName(person) {
  if (!person) return 'Okänd person';
  const fullName = `${person.firstName || ''} ${person.lastName || ''}`.trim();
  return fullName || person.refNumber || person.id || 'Okänd person';
}

function formatAuditTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function extractYear(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/(\d{4})/);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  return Number.isNaN(year) ? null : year;
}

function mapEventTypeLabel(type) {
  const normalized = String(type || '').toUpperCase();
  if (normalized === 'BIRT') return 'Födelse';
  if (normalized === 'MARR') return 'Vigsel';
  if (normalized === 'DEAT') return 'Död';
  return type || 'Händelse';
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface border border-subtle p-3 rounded-lg shadow-xl">
        <p className="text-muted text-xs font-bold uppercase mb-1">{label}</p>
        <p className="text-accent font-bold text-lg leading-none">
          {payload[0].value} <span className="text-sm font-medium text-secondary">{payload[0].value === 1 ? 'person' : 'personer'}</span>
        </p>
      </div>
    );
  }
  return null;
};

function getMediaThumbSrc(mediaItem) {
  if (!mediaItem || typeof mediaItem !== 'object') return '';
  return (
    mediaItem.thumbnailPath ||
    mediaItem.thumbnail ||
    mediaItem.imagePath ||
    mediaItem.path ||
    mediaItem.url ||
    ''
  );
}

export default function DashboardView({ dbData, handleOpenEditModal, handleTabChange, onUpdateTodos }) {
  const people = Array.isArray(dbData?.people) ? dbData.people : [];
  const media = Array.isArray(dbData?.media) ? dbData.media : [];
  const auditEntries = Array.isArray(dbData?.meta?.audit) ? dbData.meta.audit : [];

  const today = new Date();
  const todayMonthDay = `-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayLabel = today.toLocaleDateString('sv-SE', {
    day: '2-digit',
    month: '2-digit'
  });

  // Regex för att matcha textdatum, t.ex. "14 nov" (oberoende av skiftläge)
  const monthsSv = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const todayTextPattern = new RegExp(`\\b${today.getDate()}\\s+${monthsSv[today.getMonth()]}\\b`, 'i');

  // Todo-state
  const [newTodoText, setNewTodoText] = useState('');
  const [todoPersonId, setTodoPersonId] = useState('');
  const todos = Array.isArray(dbData?.meta?.todos) ? dbData.meta.todos : [];

  const handleAddTodo = (e) => {
    e.preventDefault();
    if (!newTodoText.trim() || !onUpdateTodos) return;
    onUpdateTodos([...todos, { 
      id: `todo_${Date.now()}`, 
      text: newTodoText.trim(), 
      isCompleted: false, 
      linkedPersonId: todoPersonId || null,
      createdAt: new Date().toISOString() 
    }]);
    setNewTodoText('');
    setTodoPersonId('');
  };

  const handleRandomPerson = () => {
    if (!people.length) return;
    const randomIndex = Math.floor(Math.random() * people.length);
    const randomPerson = people[randomIndex];
    if (randomPerson?.id) handleOpenEditModal(randomPerson.id);
  };

  const peopleById = React.useMemo(() => {
    const map = new Map();
    for (const person of people) {
      if (person && person.id) {
        map.set(person.id, person);
      }
    }
    return map;
  }, [people]);

  const recentPeople = React.useMemo(() => {
    const seen = new Set();
    const result = [];

    const sorted = [...auditEntries]
      .filter((entry) => entry && entry.entityType === 'person' && entry.entityId)
      .sort((a, b) => {
        const ta = Date.parse(a.timestamp || 0);
        const tb = Date.parse(b.timestamp || 0);
        return tb - ta;
      });

    for (const entry of sorted) {
      if (entry.type !== 'edit' && entry.type !== 'create') continue;
      if (seen.has(entry.entityId)) continue;

      const person = peopleById.get(entry.entityId);
      if (!person) continue;

      seen.add(entry.entityId);
      result.push({
        person,
        timestamp: entry.timestamp,
        type: entry.type
      });

      if (result.length >= 5) break;
    }

    return result;
  }, [auditEntries, peopleById]);

  // STATISTIK OCH GRAFER
  const stats = React.useMemo(() => {
    const monthCounts = Array(12).fill(0);
    const nameCounts = {};
    const monthTokenToIndex = {
      JAN: 0,
      FEB: 1,
      MAR: 2,
      APR: 3,
      MAY: 4,
      MAJ: 4,
      JUN: 5,
      JUL: 6,
      AUG: 7,
      SEP: 8,
      OCT: 9,
      OKT: 9,
      NOV: 10,
      DEC: 11
    };

    for (const p of people) {
      // Namnstatistik
      if (p.firstName) {
        const first = p.firstName.trim().split(/\s+/)[0].toUpperCase();
        if (first) {
          nameCounts[first] = (nameCounts[first] || 0) + 1;
        }
      }

      // Födelsemånad (hanterar både ISO och GEDCOM-textdatum på svenska/engelska)
      const birth = (p.events || []).find((e) => {
        const eventType = String(e?.type || '').toUpperCase();
        return eventType === 'BIRT' || eventType === 'FÖDELSE' || eventType === 'BIRTH';
      });
      if (birth && birth.date) {
        const dateStr = String(birth.date).toUpperCase();
        let monthIdx = -1;
        const isoMatch = dateStr.match(/^\d{4}-(\d{2})(?:-\d{2})?$/);
        if (isoMatch) {
          monthIdx = parseInt(isoMatch[1], 10) - 1;
        } else {
          for (const [token, idx] of Object.entries(monthTokenToIndex)) {
            if (dateStr.includes(token)) {
              monthIdx = idx;
              break;
            }
          }
        }
        if (monthIdx >= 0 && monthIdx <= 11) monthCounts[monthIdx]++;
      }
    }

    const monthsSvShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
    const chartData = monthCounts.map((count, idx) => ({ name: monthsSvShort[idx], antal: count }));

    const topNames = Object.entries(nameCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return { chartData, topNames };
  }, [people]);

  const onThisDayItems = React.useMemo(() => {
    const items = [];

    for (const person of people) {
      const personEvents = Array.isArray(person?.events) ? person.events : [];
      for (const event of personEvents) {
        const rawDate = String(event?.date || '');
        if (!rawDate.includes(todayMonthDay) && !todayTextPattern.test(rawDate)) continue;

        items.push({
          kind: 'person',
          id: `${person.id}_${event.id || rawDate}_${event.type || 'event'}`,
          person,
          event,
          year: extractYear(rawDate),
          date: rawDate
        });
      }
    }

    for (const mediaItem of media) {
      const rawDate = String(mediaItem?.date || '');
      if (!rawDate.includes(todayMonthDay) && !todayTextPattern.test(rawDate)) continue;

      items.push({
        kind: 'media',
        id: mediaItem.id || `${rawDate}_${mediaItem.title || mediaItem.name || 'media'}`,
        media: mediaItem,
        year: extractYear(rawDate),
        date: rawDate
      });
    }

    items.sort((a, b) => {
      const aYear = a.year ?? Number.MAX_SAFE_INTEGER;
      const bYear = b.year ?? Number.MAX_SAFE_INTEGER;
      if (aYear !== bYear) return aYear - bYear;
      return String(a.date || '').localeCompare(String(b.date || ''));
    });

    return items;
  }, [people, media, todayMonthDay]);

  return (
    <div className="tab-content max-w-6xl mx-auto w-full">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6 flex flex-col">
          {/* Widget: Fortsätt där du slutade */}
          <section className="card bg-surface border border-subtle rounded-xl p-5 flex-1">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-primary">Fortsätt där du slutade</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRandomPerson}
                  disabled={people.length === 0}
                  className="px-2.5 py-1.5 text-xs bg-indigo-700 text-indigo-100 rounded border border-indigo-600 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                  title="Tidsmaskin: slumpa fram en person"
                >
                  <Dices className="w-3.5 h-3.5" />
                  Slumpa person
                </button>
                <span className="text-xs text-muted">Senaste 5</span>
              </div>
            </div>

            {recentPeople.length === 0 ? (
              <p className="text-muted text-sm">
                Inga redigeringar hittades i audit-loggen ännu.
              </p>
            ) : (
              <ul className="space-y-2">
                {recentPeople.map(({ person, timestamp, type }) => (
                  <li key={person.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-background border border-subtle">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(person.id)}
                      className="text-left text-accent hover:text-accent hover:underline"
                    >
                      {getPersonDisplayName(person)}
                    </button>
                    <div className="text-xs text-muted whitespace-nowrap">
                      <span className="uppercase mr-2">{type === 'edit' ? 'Ändrad' : 'Skapad'}</span>
                      <span>{formatAuditTime(timestamp)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Widget: Att-göra (To-Do) */}
          <section className="card bg-surface border border-subtle rounded-xl p-5 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-primary">Att-göra</h2>
            </div>
            
            <form onSubmit={handleAddTodo} className="mb-4 flex flex-col gap-2">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newTodoText}
                  onChange={e => setNewTodoText(e.target.value)}
                  placeholder="Lägg till uppgift..."
                  className="flex-1 bg-background border border-subtle rounded px-3 py-1.5 text-sm text-primary focus:outline-none focus:border-accent"
                />
                <button type="submit" disabled={!newTodoText.trim()} className="bg-accent hover:bg-accent disabled:opacity-50 text-white rounded p-1.5 transition-colors">
                  <Plus size={18} />
                </button>
              </div>
              <select
                value={todoPersonId}
                onChange={e => setTodoPersonId(e.target.value)}
                className="w-full bg-background border border-subtle rounded px-2 py-1 text-xs text-secondary focus:outline-none focus:border-accent appearance-none"
              >
                <option value="">-- Koppla till person (valfritt) --</option>
                {people.slice().sort((a, b) => (a.firstName||'').localeCompare(b.firstName||'')).map(p => (
                  <option key={p.id} value={p.id}>{getPersonDisplayName(p)}</option>
                ))}
              </select>
            </form>
            
            <ul className="space-y-2 flex-1 overflow-y-auto max-h-[250px] custom-scrollbar">
              {todos.length === 0 ? (
                <p className="text-muted text-sm text-center py-4">Inga uppgifter på listan.</p>
              ) : (
                todos.map(todo => (
                  <li key={todo.id} className="flex items-start gap-2 group">
                    <button 
                      onClick={() => onUpdateTodos(todos.map(t => t.id === todo.id ? { ...t, isCompleted: !t.isCompleted } : t))}
                      className={`mt-0.5 flex-shrink-0 transition-colors ${todo.isCompleted ? 'text-success' : 'text-muted hover:text-secondary'}`}
                    >
                      {todo.isCompleted ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                    <div className="flex-1 flex flex-col">
                      <span className={`text-sm ${todo.isCompleted ? 'text-muted line-through' : 'text-primary'}`}>
                        {todo.text}
                      </span>
                      {todo.linkedPersonId && peopleById.get(todo.linkedPersonId) && (
                        <button
                          onClick={() => handleOpenEditModal(todo.linkedPersonId)}
                          className={`text-left text-xs flex items-center gap-1 mt-0.5 w-fit transition-colors ${todo.isCompleted ? 'text-muted hover:text-muted' : 'text-accent hover:text-accent'}`}
                        >
                          <User size={10} />
                          {getPersonDisplayName(peopleById.get(todo.linkedPersonId))}
                        </button>
                      )}
                    </div>
                    <button 
                      onClick={() => onUpdateTodos(todos.filter(t => t.id !== todo.id))}
                      className="text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>

        <div className="lg:col-span-2">
          {/* Widget: På denna dag */}
          <section className="card bg-surface border border-subtle rounded-xl p-5 h-full">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-primary">På denna dag ({todayLabel})</h2>
              <span className="text-xs text-muted">Kronologisk tidslinje</span>
            </div>

            {onThisDayItems.length === 0 ? (
              <p className="text-muted text-sm">
                Inga historiska händelser hittades för detta datum.
              </p>
            ) : (
              <ul className="space-y-2">
                {onThisDayItems.map((item) => {
                  if (item.kind === 'person') {
                    const personName = getPersonDisplayName(item.person);
                    const eventLabel = mapEventTypeLabel(item.event?.type);
                    return (
                      <li key={item.id} className="p-3 rounded-lg bg-background border border-subtle">
                        <div className="text-sm text-secondary">
                          <span className="text-accent font-semibold mr-2">{item.year ?? 'Okänt år'}</span>
                          <span className="text-muted mr-1">-</span>
                          <span className="text-secondary mr-1">{eventLabel}:</span>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item.person.id)}
                            className="text-left text-accent hover:text-accent hover:underline"
                          >
                            {personName}
                          </button>
                        </div>
                      </li>
                    );
                  }

                  const mediaTitle = item.media?.title || item.media?.name || item.media?.description || 'Media';
                  const thumbSrc = getMediaThumbSrc(item.media);

                  return (
                    <li key={item.id} className="p-3 rounded-lg bg-background border border-subtle flex items-center gap-3">
                      {thumbSrc ? (
                        <img
                          src={thumbSrc}
                          alt={mediaTitle}
                          className="w-12 h-12 object-cover rounded border border-subtle bg-surface"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded border border-subtle bg-surface flex items-center justify-center text-xs text-muted">
                          IMG
                        </div>
                      )}
                      <div className="text-sm text-secondary min-w-0">
                        <div className="truncate">
                          <span className="text-accent font-semibold mr-2">{item.year ?? 'Okänt år'}</span>
                          <span className="text-muted mr-1">-</span>
                          <span>{mediaTitle}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* NY RAD: Statistik */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Födelsemånader graf */}
        <section className="card bg-surface border border-subtle rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-primary">Födda per månad</h2>
            <span className="text-xs text-muted">Släktens födelsemånader</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b', opacity: 0.8 }} />
                <Bar dataKey="antal" radius={[4, 4, 0, 0]} activeBar={{ fill: '#60a5fa' }}>
                  {stats.chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.antal > 0 ? '#3b82f6' : '#1e293b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Vanligaste namnen */}
        <section className="card bg-surface border border-subtle rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-primary">Vanligaste namnen</h2>
            <span className="text-xs text-muted">Topp 5</span>
          </div>
          <ul className="space-y-4 flex-1">
            {stats.topNames.map((item, idx) => (
              <li key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-background border border-subtle">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-surface border border-subtle text-xs font-bold text-secondary">{idx + 1}</span>
                  <span className="text-primary capitalize">{item.name.toLowerCase()}</span>
                </div>
                <span className="text-accent text-sm font-bold">{item.count}</span>
              </li>
            ))}
            {stats.topNames.length === 0 && <p className="text-muted text-sm">Inte tillräckligt med data ännu.</p>}
          </ul>
        </section>
      </div>
    </div>
  );
}

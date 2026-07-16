import { useState, useEffect, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase';

function buildCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, current: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, current: true });
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) cells.push({ day: d, current: false });
  return cells;
}

const typeColors = {
  ligacao: 'var(--cyan)',
  email: 'var(--accent)',
  reuniao: 'var(--green)',
  followup: 'var(--purple)',
};

const typeIcons = {
  ligacao: '📞',
  email: '✉️',
  reuniao: '🤝',
  followup: '💬',
};

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const dayOfWeekNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function AgendaPage({ leads = [] }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [tarefas, setTarefas] = useState([]);

  /* ── Firebase: tarefas ── */
  useEffect(() => {
    const unsub = onValue(ref(database, 'crm_data/tarefas'), (snap) => {
      const data = snap.val();
      setTarefas(data ? Object.entries(data).map(([id, t]) => ({ ...t, id })) : []);
    });
    return () => unsub();
  }, []);

  /* ── Build events from leads.reuniao + tarefas ── */
  const allEvents = useMemo(() => {
    const events = {};

    // From leads: reuniao field
    leads.forEach((l) => {
      if (!l.reuniao) return;
      const parts = l.reuniao.split('-').map(Number);
      const [y, m, d] = parts;
      if (y !== viewYear || m - 1 !== viewMonth) return;
      if (!events[d]) events[d] = [];
      events[d].push({
        time: '',
        title: `Reunião: ${l.nome}`,
        lead: l.nome,
        type: 'reuniao',
        color: 'var(--green)',
        icon: '🤝',
      });
    });

    // From tarefas
    tarefas.forEach((t) => {
      if (!t.data) return;
      const parts = t.data.split('-').map(Number);
      const [y, m, d] = parts;
      if (y !== viewYear || m - 1 !== viewMonth) return;
      if (!events[d]) events[d] = [];
      events[d].push({
        time: t.hora || '',
        title: t.titulo || 'Tarefa',
        lead: t.leadNome || '',
        type: t.tipo,
        color: typeColors[t.tipo] || 'var(--accent)',
        icon: typeIcons[t.tipo] || '📋',
      });
    });

    // Sort events within each day by time
    Object.keys(events).forEach((day) => {
      events[day].sort((a, b) =>
        (a.time || '99:99').localeCompare(b.time || '99:99')
      );
    });

    return events;
  }, [leads, tarefas, viewYear, viewMonth]);

  /* ── Month navigation ── */
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
    setSelectedDay(1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
    setSelectedDay(1);
  };

  const calendarCells = buildCalendar(viewYear, viewMonth);

  const selDate = new Date(viewYear, viewMonth, selectedDay);
  const dayLabel = `${dayOfWeekNames[selDate.getDay()]}, ${selectedDay} de ${monthNames[viewMonth]}`;
  const dayEvents = allEvents[selectedDay] || [];

  // Count total events this month
  const totalEventos = Object.values(allEvents).reduce((s, arr) => s + arr.length, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">📅 Agenda</div>
          <div className="page-subtitle">
            {totalEventos} evento{totalEventos !== 1 ? 's' : ''} em {monthNames[viewMonth]} {viewYear}
          </div>
        </div>
        <div className="page-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn btn-ghost btn-icon" onClick={prevMonth} title="Mês anterior">
              ←
            </button>
            <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--text)', minWidth: 160, textAlign: 'center' }}>
              {monthNames[viewMonth]} {viewYear}
            </span>
            <button className="btn btn-ghost btn-icon" onClick={nextMonth} title="Próximo mês">
              →
            </button>
          </div>
          <span
            style={{
              padding: '4px 14px',
              borderRadius: 20,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              fontSize: 12,
              color: 'var(--text2)',
            }}
          >
            Mês
          </span>
        </div>
      </div>

      <div className="page-content" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 320px',
            gap: 20,
            flex: 1,
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          {/* LEFT: Calendar */}
          <div className="crm-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Day names header */}
            <div className="calendar-grid" style={{ marginBottom: 0 }}>
              {dayNames.map((d) => (
                <div key={d} className="calendar-header-cell">
                  {d}
                </div>
              ))}

              {/* Calendar cells */}
              {calendarCells.map((cell, idx) => {
                const isToday =
                  cell.current &&
                  cell.day === today.getDate() &&
                  viewYear === today.getFullYear() &&
                  viewMonth === today.getMonth();
                const isSelected = cell.current && cell.day === selectedDay;
                const cellEvents = cell.current ? (allEvents[cell.day] || []) : [];

                return (
                  <div
                    key={idx}
                    className={`calendar-day ${!cell.current ? 'outside' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                    onClick={() => cell.current && setSelectedDay(cell.day)}
                    style={{ cursor: cell.current ? 'pointer' : 'default' }}
                  >
                    <div className="calendar-day-number">{cell.day}</div>
                    {cellEvents.length > 0 && (
                      <div className="calendar-dots">
                        {cellEvents.slice(0, 3).map((ev, i) => (
                          <div
                            key={i}
                            className="calendar-dot"
                            style={{ background: ev.color }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Day detail panel */}
          <div className="crm-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="crm-card-header">
              <div style={{ flex: 1 }}>
                <div className="crm-card-title" style={{ fontSize: 14 }}>{dayLabel}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  {dayEvents.length} evento{dayEvents.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 2 }}>
              {dayEvents.length > 0 ? (
                dayEvents.map((ev, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: 12,
                      borderLeft: `3px solid ${ev.color}`,
                      background: 'var(--surface2)',
                      borderRadius: 8,
                      marginBottom: 8,
                      transition: 'opacity 0.2s',
                    }}
                  >
                    <span style={{ fontSize: 16, lineHeight: 1 }}>{ev.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                        {ev.title}
                      </div>
                      {ev.lead && (
                        <div style={{ fontSize: 11, color: 'var(--accent2)', marginTop: 2 }}>
                          🔗 {ev.lead}
                        </div>
                      )}
                      {ev.time && (
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text3)',
                            fontFamily: "'DM Mono', monospace",
                            marginTop: 2,
                          }}
                        >
                          ⏰ {ev.time}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 160,
                    color: 'var(--text3)',
                    fontSize: 13,
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 28 }}>📭</span>
                  Nenhum evento neste dia
                </div>
              )}
            </div>

            <div
              style={{
                paddingTop: 12,
                borderTop: '1px solid var(--border)',
                fontSize: 10,
                color: 'var(--text3)',
                textAlign: 'center',
                lineHeight: 1.5,
              }}
            >
              Eventos das tarefas e reuniões dos leads
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

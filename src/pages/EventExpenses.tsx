import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useEventsStore } from '@/stores/eventsStore';
import { useExpensesStore, type Expense, type SuggestedTransfer, type UserBalance } from '@/stores/expensesStore';
import { avatarColor } from '@/lib/utils';
import type { User } from '@/types';

const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: '₽',
  USD: '$',
  EUR: '€',
};

export const EXPENSE_CATEGORIES: { id: string; label: string; icon: ReactNode; color: string }[] = [
  {
    id: 'food', label: 'Еда', color: '#F59E0B',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3v7.5"/>
        <path d="M8.5 3v7.5"/>
        <path d="M11 3v7.5"/>
        <path d="M8.5 10.5v10.5"/>
        <path d="M16 3v8c0 1.25 1 2.25 2.25 2.25H19V21"/>
        <path d="M19 3v18"/>
      </svg>
    ),
  },
  {
    id: 'transport', label: 'Транспорт', color: '#3B82F6',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 13.5V11a2 2 0 0 1 1.05-1.76l2.1-1.1 1.15-2.55A2 2 0 0 1 10.15 4h3.7a2 2 0 0 1 1.9 1.59l1.15 2.55 2.05 1.08A2 2 0 0 1 20 11v2.5"/>
        <path d="M6 13.5h12"/>
        <path d="M7.5 16.5h9"/>
        <circle cx="8" cy="16.5" r="1.6" fill="currentColor" stroke="none"/>
        <circle cx="16" cy="16.5" r="1.6" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    id: 'accommodation', label: 'Жильё', color: '#8B5CF6',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20V9.8L12 4l8 5.8V20"/>
        <path d="M8 20v-5a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 16 15v5"/>
        <path d="M9 10h.01M15 10h.01"/>
      </svg>
    ),
  },
  {
    id: 'activities', label: 'Активности', color: '#EC4899',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8"/>
        <path d="M12 4v16"/>
        <path d="M4 12h16"/>
        <path d="M6.3 6.3l11.4 11.4"/>
        <path d="M17.7 6.3L6.3 17.7"/>
      </svg>
    ),
  },
  {
    id: 'shopping', label: 'Шоппинг', color: '#10B981',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8h12l-1 11H7L6 8Z"/>
        <path d="M9 8V7a3 3 0 0 1 6 0v1"/>
        <path d="M10 12h4"/>
      </svg>
    ),
  },
  {
    id: 'other', label: 'Другое', color: '#6B7280',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8"/>
        <path d="M9.75 9.25a2.25 2.25 0 1 1 4.5 0c0 1.5-2.25 1.85-2.25 3.4"/>
        <circle cx="12" cy="16.9" r="0.8" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
];

export function getCategoryMeta(id: string | null | undefined) {
  return EXPENSE_CATEGORIES.find(c => c.id === id) || EXPENSE_CATEGORIES[5];
}

function fmtMoney(amount: number, currency: string): string {
  const sign = amount < 0 ? '-' : '';
  const a = Math.abs(amount);
  const s = a.toLocaleString('ru', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const sym = CURRENCY_SYMBOLS[currency] || currency;
  return `${sign}${s} ${sym}`;
}

export default function EventExpenses() {
  const { id } = useParams();
  const nav = useNavigate();
  const { session } = useAuthStore();
  const myId = session?.user?.id;
  const { membersByEvent, loadEventMembers, events } = useEventsStore();
  const { expensesByEvent, loadExpenses, computeBalances, suggestTransfers } = useExpensesStore();

  const [showCreate, setShowCreate] = useState(false);
  const [showSettle, setShowSettle] = useState<{ to_user: User; amount: number } | null>(null);

  const event = id ? events[id] : undefined;
  const members = id ? (membersByEvent[id] || []) : [];
  const expenses = id ? (expensesByEvent[id] || []) : [];

  useEffect(() => {
    if (!id) return;
    loadEventMembers(id);
    loadExpenses(id);
  }, [id]);

  const memberUsers = useMemo(() => {
    const list = members.map(m => m.user).filter(Boolean) as User[];
    // Фолбэк: если участников ещё не подгрузили (или их нет) — кладём хотя бы текущего юзера,
    // чтобы кнопка «+» открывала форму даже на свежем событии
    if (list.length === 0 && session?.user) {
      const u = session.user;
      return [{
        id: u.id,
        display_name: (u.user_metadata as any)?.display_name || u.email?.split('@')[0] || 'Вы',
        avatar_url: (u.user_metadata as any)?.avatar_url || null,
      } as User];
    }
    return list;
  }, [members, session?.user]);

  const balances: UserBalance[] = useMemo(() => {
    if (!id) return [];
    return computeBalances(id, memberUsers);
  }, [id, expensesByEvent, memberUsers]);

  const transfers: SuggestedTransfer[] = useMemo(() => suggestTransfers(balances), [balances]);

  const myBalance = balances.find(b => b.user_id === myId);
  const totalSpent = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div className="page-header" style={{display:'flex',alignItems:'center',gap:12,paddingBottom:8}}>
        <button onClick={() => nav(-1)} style={{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:6,marginLeft:-6,fontSize: 'var(--fs-title)',lineHeight:1}}>‹</button>
        <h1 style={{fontSize: 'var(--fs-title)', textTransform:'none', letterSpacing:0, flex:1}}>Расходы</h1>
        <button
          onClick={() => setShowCreate(true)}
          aria-label="Добавить трату"
          style={{background:'var(--primary)', color:'var(--bg)', border:'none', width:38, height:38, borderRadius:19, fontSize: 'var(--fs-snap24)', fontWeight:300, lineHeight:1, cursor:'pointer'}}
        >+</button>
      </div>

      <div className="page-scroll" style={{padding:'8px 12px 32px'}}>
        {/* Summary card */}
        <div style={{
          padding:'16px',
          background:'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)',
          color:'#fff',
          borderRadius:14,
          marginBottom:16,
        }}>
          <div style={{fontSize: 'var(--fs-micro)', opacity:0.85, fontWeight:600, letterSpacing:0.4, textTransform:'uppercase', marginBottom:4}}>
            Всего потрачено
          </div>
          <div style={{fontSize:28, fontWeight:700, fontVariantNumeric:'tabular-nums', marginBottom:8}}>
            {fmtMoney(totalSpent, expenses[0]?.currency || 'RUB')}
          </div>
          {myBalance && (
            <div style={{
              fontSize: 'var(--fs-label)', opacity:0.95, padding:'6px 10px',
              background:'rgba(0,0,0,0.2)', borderRadius:8,
              display:'inline-block', fontVariantNumeric:'tabular-nums',
            }}>
              {Math.abs(myBalance.net) < 0.01
                ? 'Вы в нуле ✓'
                : myBalance.net > 0
                  ? <>Вам должны <b>{fmtMoney(myBalance.net, 'RUB')}</b></>
                  : <>Вы должны <b>{fmtMoney(Math.abs(myBalance.net), 'RUB')}</b></>
              }
            </div>
          )}
        </div>

        {/* Suggested transfers */}
        {transfers.length > 0 && (
          <Section title="Кто кому должен">
            {transfers.map((t, i) => {
              const from = balances.find(b => b.user_id === t.from_user_id);
              const to = balances.find(b => b.user_id === t.to_user_id);
              if (!from?.user || !to?.user) return null;
              const isMine = t.from_user_id === myId;
              return (
                <div key={i} style={{
                  display:'flex', alignItems:'center', gap:10,
                  padding:'10px 12px',
                  background:'var(--surface-light)', border:'1px solid var(--border)',
                  borderRadius:10, marginBottom:6,
                }}>
                  <UserChip user={from.user} />
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                  <UserChip user={to.user} />
                  <span style={{
                    flex:1, textAlign:'right',
                    fontSize: 'var(--fs-snap14)', fontWeight:600, fontVariantNumeric:'tabular-nums',
                    color:'var(--text)',
                  }}>{fmtMoney(t.amount, 'RUB')}</span>
                  {isMine && to.user && (
                    <button
                      onClick={() => setShowSettle({ to_user: to.user as User, amount: t.amount })}
                      style={{
                        padding:'5px 10px', background:'var(--primary)', color:'var(--bg)',
                        border:'none', borderRadius:8, fontSize: 'var(--fs-micro)', fontWeight:600,
                        cursor:'pointer',
                      }}
                    >Закрыть</button>
                  )}
                </div>
              );
            })}
          </Section>
        )}

        {/* Все балансы */}
        {balances.length > 0 && (
          <Section title="Балансы">
            {balances.map(b => b.user && (
              <BalanceRow key={b.user_id} balance={b} isMe={b.user_id === myId} />
            ))}
          </Section>
        )}

        {/* Список трат */}
        <Section title={`Траты (${expenses.length})`}>
          {expenses.length === 0 && (
            <div style={{padding:'20px 16px', textAlign:'center', color:'var(--muted)', fontSize: 'var(--fs-label)'}}>
              Пока нет трат. Добавьте первую кнопкой "+"
            </div>
          )}
          {expenses.map(ex => <ExpenseRow key={ex.id} expense={ex} myId={myId || ''} />)}
        </Section>
      </div>

      {showCreate && id && myId && (
        <CreateExpenseSheet
          eventId={id}
          myId={myId}
          members={memberUsers}
          onClose={() => setShowCreate(false)}
        />
      )}

      {showSettle && id && (
        <SettleSheet
          eventId={id}
          toUser={showSettle.to_user}
          suggestedAmount={showSettle.amount}
          onClose={() => setShowSettle(null)}
        />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{marginBottom:18}}>
      <div style={{
        fontSize: 'var(--fs-micro)', fontWeight:600, color:'var(--muted)',
        letterSpacing:0.5, textTransform:'uppercase',
        padding:'4px 4px 8px',
      }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

function UserChip({ user }: { user: Pick<User, 'id' | 'display_name' | 'avatar_url'> }) {
  return (
    <div style={{display:'flex', alignItems:'center', gap:6, minWidth:0}}>
      {user.avatar_url
        ? <img src={user.avatar_url} alt="" style={{width:24,height:24,borderRadius:12,objectFit:'cover'}} />
        : <div style={{width:24,height:24,borderRadius:12,background:avatarColor(user.id),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize: 'var(--fs-micro)',fontWeight:600}}>{user.display_name?.[0]?.toUpperCase()}</div>}
      <span style={{fontSize: 'var(--fs-label)', color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:80}}>
        {user.display_name}
      </span>
    </div>
  );
}

function BalanceRow({ balance, isMe }: { balance: UserBalance; isMe: boolean }) {
  if (!balance.user) return null;
  const net = balance.net;
  const status = Math.abs(net) < 0.01 ? 'zero' : net > 0 ? 'creditor' : 'debtor';

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10,
      padding:'10px 12px',
      background:'var(--surface-light)', border:'1px solid var(--border)',
      borderRadius:10, marginBottom:6,
    }}>
      {balance.user.avatar_url
        ? <img src={balance.user.avatar_url} alt="" style={{width:34,height:34,borderRadius:17,objectFit:'cover'}} />
        : <div style={{width:34,height:34,borderRadius:17,background:avatarColor(balance.user.id),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize: 'var(--fs-label)',fontWeight:600}}>{balance.user.display_name?.[0]?.toUpperCase()}</div>}

      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize: 'var(--fs-snap14)', fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
          {balance.user.display_name} {isMe && <span style={{color:'var(--muted)', fontWeight:400, fontSize: 'var(--fs-micro)'}}>(вы)</span>}
        </div>
        <div style={{fontSize: 'var(--fs-micro)', color:'var(--muted)', fontVariantNumeric:'tabular-nums'}}>
          заплатил {fmtMoney(balance.paid, 'RUB')}, должен {fmtMoney(balance.owes, 'RUB')}
        </div>
      </div>

      <div style={{
        fontSize: 'var(--fs-snap14)', fontWeight:600, fontVariantNumeric:'tabular-nums',
        color: status === 'creditor' ? '#10B981' : status === 'debtor' ? '#EF4444' : 'var(--muted)',
      }}>
        {status === 'creditor' ? `+${fmtMoney(net, 'RUB')}` : status === 'debtor' ? `-${fmtMoney(Math.abs(net), 'RUB')}` : '0'}
      </div>
    </div>
  );
}

function ExpenseRow({ expense, myId }: { expense: Expense; myId: string }) {
  const myShare = (expense.shares || []).find(s => s.user_id === myId);
  const isPayer = expense.payer_id === myId;

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12,
      padding:'10px 12px',
      background:'var(--surface-light)', border:'1px solid var(--border)',
      borderRadius:10, marginBottom:6,
    }}>
      <div style={{
        width:38, height:38, borderRadius:19,
        background: `${getCategoryMeta(expense.category).color}30`,
        color: getCategoryMeta(expense.category).color,
        display:'flex', alignItems:'center', justifyContent:'center',
        flexShrink:0,
      }}>{getCategoryMeta(expense.category).icon}</div>

      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize: 'var(--fs-snap14)', fontWeight:500, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
          {expense.title}
        </div>
        <div style={{fontSize: 'var(--fs-micro)', color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
          {isPayer ? 'Вы заплатили' : `${expense.payer?.display_name || 'Кто-то'} заплатил`}
          {' · '}
          {getCategoryMeta(expense.category).label}
        </div>
      </div>

      <div style={{textAlign:'right'}}>
        <div style={{fontSize: 'var(--fs-snap14)', fontWeight:600, fontVariantNumeric:'tabular-nums', color:'var(--text)'}}>
          {fmtMoney(Number(expense.amount), expense.currency)}
        </div>
        {myShare && (
          <div style={{fontSize: 'var(--fs-micro)', color:'var(--muted)', fontVariantNumeric:'tabular-nums'}}>
            ваш {fmtMoney(Number(myShare.share), expense.currency)}
          </div>
        )}
      </div>
    </div>
  );
}

// =============== CreateExpenseSheet ===============

function CreateExpenseSheet({ eventId, myId, members, onClose }: {
  eventId: string;
  myId: string;
  members: User[];
  onClose: () => void;
}) {
  const { createExpense } = useExpensesStore();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('RUB');
  const [category, setCategory] = useState<string>('other');
  // По умолчанию все участники выбраны
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(members.map(m => m.id)));
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [customShares, setCustomShares] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericAmount = parseFloat(amount.replace(',', '.')) || 0;
  const isValid = title.trim().length > 0 && numericAmount > 0 && selectedIds.size > 0;

  const toggleMember = (uid: string) => {
    const next = new Set(selectedIds);
    if (next.has(uid)) next.delete(uid);
    else next.add(uid);
    setSelectedIds(next);
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    setError(null);

    let shares: Array<{ user_id: string; share: number }> = [];
    if (splitMode === 'equal') {
      const perUser = Math.round((numericAmount / selectedIds.size) * 100) / 100;
      // Распределяем остаток на первого юзера чтобы сумма точно билась
      const ids = Array.from(selectedIds);
      shares = ids.map((uid, i) => ({
        user_id: uid,
        share: i === 0
          ? Math.round((numericAmount - perUser * (ids.length - 1)) * 100) / 100
          : perUser,
      }));
    } else {
      // custom
      let total = 0;
      for (const uid of selectedIds) {
        const v = parseFloat((customShares[uid] || '').replace(',', '.')) || 0;
        if (v > 0) {
          shares.push({ user_id: uid, share: Math.round(v * 100) / 100 });
          total += v;
        }
      }
      if (Math.abs(total - numericAmount) > 0.01) {
        setError(`Сумма распределения (${total.toFixed(2)}) не равна сумме траты (${numericAmount.toFixed(2)})`);
        setSubmitting(false);
        return;
      }
    }

    const { ok, error } = await createExpense(eventId, title, numericAmount, currency, shares, undefined, category);
    setSubmitting(false);
    if (ok) onClose();
    else setError(error);
  };

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:60,
      background:'rgba(0,0,0,0.6)',
      display:'flex', alignItems:'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%',
        maxHeight:'92%',
        background:'var(--surface)',
        borderRadius:'16px 16px 0 0',
        padding:'12px 16px max(20px, env(safe-area-inset-bottom, 20px))',
        overflowY:'auto',
        display:'flex', flexDirection:'column',
      }}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:12}}>
          <div style={{width:36, height:4, borderRadius:2, background:'var(--border)'}} />
        </div>

        <h3 style={{fontSize: 'var(--fs-heading)', fontWeight:600, margin:'0 0 16px', color:'var(--text)'}}>
          Новая трата
        </h3>

        <Label>За что</Label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Например: продукты"
          maxLength={120}
          style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:16}}
        />

        <Label>Сумма</Label>
        <div style={{display:'flex',gap:8,marginBottom:16}}>
          <input
            value={amount}
            onChange={e => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
            inputMode="decimal"
            placeholder="0"
            style={{flex:1,padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-heading)',fontVariantNumeric:'tabular-nums',fontWeight:600,textAlign:'right'}}
          />
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            style={{padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)', fontFamily:'inherit'}}
          >
            <option value="RUB">RUB ₽</option>
            <option value="USD">USD $</option>
            <option value="EUR">EUR €</option>
          </select>
        </div>

        <Label>Категория</Label>
        <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:16}}>
          {EXPENSE_CATEGORIES.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              style={{
                padding:'7px 11px',borderRadius:14,
                border: category === c.id ? '1px solid var(--primary)' : '1px solid var(--border)',
                background: category === c.id ? 'var(--surface-light)' : 'transparent',
                cursor:'pointer',color:'var(--text)',fontSize: 'var(--fs-caption)',fontWeight: category === c.id ? 600 : 500,
                display:'flex',alignItems:'center',gap:5,
              }}
            >
              <span style={{display:'flex', color: category === c.id ? c.color : 'var(--muted)'}}>{c.icon}</span><span>{c.label}</span>
            </button>
          ))}
        </div>

        <Label>На кого делим</Label>
        <div style={{display:'flex',gap:6,marginBottom:8}}>
          <button
            onClick={() => setSplitMode('equal')}
            style={{
              flex:1, padding:'8px',
              background: splitMode === 'equal' ? 'var(--primary)' : 'var(--surface-light)',
              color: splitMode === 'equal' ? 'var(--bg)' : 'var(--text)',
              border: splitMode === 'equal' ? 'none' : '1px solid var(--border)',
              borderRadius:8, fontSize: 'var(--fs-caption)', fontWeight:600, cursor:'pointer',
            }}
          >Поровну</button>
          <button
            onClick={() => setSplitMode('custom')}
            style={{
              flex:1, padding:'8px',
              background: splitMode === 'custom' ? 'var(--primary)' : 'var(--surface-light)',
              color: splitMode === 'custom' ? 'var(--bg)' : 'var(--text)',
              border: splitMode === 'custom' ? 'none' : '1px solid var(--border)',
              borderRadius:8, fontSize: 'var(--fs-caption)', fontWeight:600, cursor:'pointer',
            }}
          >Свои суммы</button>
        </div>

        <div style={{maxHeight:240, overflowY:'auto', marginBottom:16, border:'1px solid var(--border)', borderRadius:10}}>
          {members.map(u => {
            const checked = selectedIds.has(u.id);
            const equalShare = checked && selectedIds.size > 0 ? numericAmount / selectedIds.size : 0;
            return (
              <div key={u.id} style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'8px 10px',
                borderBottom:'1px solid var(--border)',
              }}>
                <button onClick={() => toggleMember(u.id)} style={{
                  background:'none', border:'none', padding:0, cursor:'pointer', display:'flex', alignItems:'center', gap:8, flex:1,
                }}>
                  <div style={{
                    width:20, height:20, borderRadius:10,
                    border: checked ? 'none' : '2px solid var(--border)',
                    background: checked ? 'var(--primary)' : 'transparent',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    flexShrink:0,
                  }}>
                    {checked && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" style={{width:28,height:28,borderRadius:14,objectFit:'cover'}} />
                    : <div style={{width:28,height:28,borderRadius:14,background:avatarColor(u.id),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize: 'var(--fs-caption)',fontWeight:600}}>{u.display_name?.[0]?.toUpperCase()}</div>}
                  <span style={{flex:1, fontSize: 'var(--fs-label)', color:'var(--text)', textAlign:'left', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                    {u.display_name}{u.id === myId ? ' (вы)' : ''}
                  </span>
                </button>
                {checked && splitMode === 'custom' ? (
                  <input
                    value={customShares[u.id] || ''}
                    onChange={e => setCustomShares({ ...customShares, [u.id]: e.target.value.replace(/[^\d.,]/g, '') })}
                    placeholder="0"
                    inputMode="decimal"
                    style={{width:70, padding:'4px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize: 'var(--fs-caption)', fontVariantNumeric:'tabular-nums', textAlign:'right'}}
                  />
                ) : checked ? (
                  <span style={{fontSize: 'var(--fs-caption)', color:'var(--muted)', fontVariantNumeric:'tabular-nums'}}>
                    {fmtMoney(equalShare, currency)}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        {error && (
          <div style={{
            background:'rgba(239,68,68,0.1)', color:'#EF4444',
            padding:'10px 12px', borderRadius:8, fontSize: 'var(--fs-label)', marginBottom:12,
          }}>{error}</div>
        )}

        <div style={{display:'flex', gap:8}}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              flex:1, padding:'12px',
              background:'var(--surface-light)', border:'1px solid var(--border)',
              borderRadius:10, color:'var(--text)',
              fontSize: 'var(--fs-snap14)', fontWeight:500, cursor:'pointer',
            }}
          >Отмена</button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            style={{
              flex:2, padding:'12px',
              background: isValid ? 'var(--primary)' : 'var(--surface-light)',
              color: isValid ? 'var(--bg)' : 'var(--muted)',
              border:'none', borderRadius:10,
              fontSize: 'var(--fs-snap14)', fontWeight:600,
              cursor: isValid && !submitting ? 'pointer' : 'default',
            }}
          >{submitting ? 'Сохраняем...' : 'Добавить'}</button>
        </div>
      </div>
    </div>
  );
}

// =============== SettleSheet ===============

function SettleSheet({ eventId, toUser, suggestedAmount, onClose }: {
  eventId: string;
  toUser: User;
  suggestedAmount: number;
  onClose: () => void;
}) {
  const { createSettlement } = useExpensesStore();
  const [amount, setAmount] = useState(String(suggestedAmount));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericAmount = parseFloat(amount.replace(',', '.')) || 0;
  const isValid = numericAmount > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    setError(null);
    const { ok, error } = await createSettlement(eventId, toUser.id, numericAmount, 'RUB', note || undefined);
    setSubmitting(false);
    if (ok) onClose();
    else setError(error);
  };

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:65,
      background:'rgba(0,0,0,0.6)',
      display:'flex', alignItems:'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%',
        background:'var(--surface)',
        borderRadius:'16px 16px 0 0',
        padding:'12px 16px max(20px, env(safe-area-inset-bottom, 20px))',
      }}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:12}}>
          <div style={{width:36, height:4, borderRadius:2, background:'var(--border)'}} />
        </div>

        <h3 style={{fontSize: 'var(--fs-snap16)', fontWeight:600, margin:'0 0 4px', color:'var(--text)'}}>Закрыть долг</h3>
        <p style={{fontSize: 'var(--fs-caption)', color:'var(--muted)', margin:'0 0 16px'}}>
          Подтверждение перевода (вне приложения) пользователю <b style={{color:'var(--text)'}}>{toUser.display_name}</b>
        </p>

        <Label>Сумма</Label>
        <input
          value={amount}
          onChange={e => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
          inputMode="decimal"
          style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-heading)',fontVariantNumeric:'tabular-nums',fontWeight:600,marginBottom:12,textAlign:'center'}}
        />

        <Label optional>Комментарий</Label>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Например: перевёл по СБП"
          maxLength={120}
          style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface-light)',color:'var(--text)',fontSize: 'var(--fs-snap14)',marginBottom:16}}
        />

        {error && (
          <div style={{
            background:'rgba(239,68,68,0.1)', color:'#EF4444',
            padding:'10px 12px', borderRadius:8, fontSize: 'var(--fs-label)', marginBottom:12,
          }}>{error}</div>
        )}

        <div style={{display:'flex', gap:8}}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              flex:1, padding:'12px',
              background:'var(--surface-light)', border:'1px solid var(--border)',
              borderRadius:10, color:'var(--text)',
              fontSize: 'var(--fs-snap14)', fontWeight:500, cursor:'pointer',
            }}
          >Отмена</button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            style={{
              flex:2, padding:'12px',
              background: isValid ? 'var(--primary)' : 'var(--surface-light)',
              color: isValid ? 'var(--bg)' : 'var(--muted)',
              border:'none', borderRadius:10,
              fontSize: 'var(--fs-snap14)', fontWeight:600,
              cursor: isValid && !submitting ? 'pointer' : 'default',
            }}
          >{submitting ? 'Сохраняем...' : 'Закрыть долг'}</button>
        </div>
      </div>
    </div>
  );
}

function Label({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <div style={{
      fontSize: 'var(--fs-micro)', fontWeight:600, color:'var(--muted)',
      marginBottom:6, letterSpacing:0.3, textTransform:'uppercase',
    }}>
      {children}
      {optional && <span style={{textTransform:'none', fontWeight:500, marginLeft:6, opacity:0.7}}>(опц.)</span>}
    </div>
  );
}

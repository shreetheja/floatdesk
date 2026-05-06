import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SupportWidget } from '@floatdesk/react';

const stats = [
  { label: 'Total Users',     value: '84,210', delta: '+12.4%', up: true },
  { label: 'Monthly Revenue', value: '$42,890', delta: '+8.1%',  up: true },
  { label: 'Churn Rate',      value: '2.3%',   delta: '-0.4%',  up: false },
  { label: 'Avg Session',     value: '4m 12s', delta: '+0.6%',  up: true },
];

const activity = [
  { id: 'TXN-7821', user: 'alice@acme.io',   action: 'Upgraded plan',   amount: '$99/mo', time: '2 min ago' },
  { id: 'TXN-7820', user: 'bob@acme.io',     action: 'Exported report', amount: '—',      time: '14 min ago' },
  { id: 'TXN-7819', user: 'carol@acme.io',   action: 'Added team seat', amount: '$25/mo', time: '1 hr ago' },
  { id: 'TXN-7818', user: 'dave@acme.io',    action: 'Cancelled plan',  amount: '—',      time: '3 hr ago' },
  { id: 'TXN-7817', user: 'eve@acme.io',     action: 'Upgraded plan',   amount: '$49/mo', time: '5 hr ago' },
  { id: 'TXN-7816', user: 'frank@acme.io',   action: 'Joined via SSO',  amount: '—',      time: 'Yesterday' },
];

function App() {
  const [navItem, setNavItem] = useState('Dashboard');
  const navItems = ['Dashboard', 'Users', 'Revenue', 'Reports', 'Settings'];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, background: '#141414', borderRight: '1px solid #222',
        padding: '24px 0', display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        <div style={{ padding: '0 24px 32px', fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>
          ⬡ Acme Analytics
        </div>
        <nav>
          {navItems.map((item) => (
            <button key={item} onClick={() => setNavItem(item)} style={{
              display: 'block', width: '100%', padding: '10px 24px', textAlign: 'left',
              background: navItem === item ? '#1e1e1e' : 'transparent',
              borderLeft: navItem === item ? '2px solid #6366f1' : '2px solid transparent',
              color: navItem === item ? '#fff' : '#888', fontSize: 14, cursor: 'pointer',
              border: 'none', borderLeft: navItem === item ? '2px solid #6366f1' : '2px solid transparent',
            }}>
              {item}
            </button>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', padding: '0 24px' }}>
          <div style={{ padding: '12px', background: '#1e1e1e', borderRadius: 8, fontSize: 12, color: '#666' }}>
            <div style={{ color: '#e5e5e5', fontWeight: 600, marginBottom: 4 }}>Need help?</div>
            Click the widget → to contact support
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        {/* Header */}
        <header style={{
          padding: '20px 32px', borderBottom: '1px solid #222',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#141414',
        }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{navItem}</h1>
            <p style={{ fontSize: 13, color: '#666', marginTop: 2 }}>April 2026 · All workspaces</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{
              padding: '6px 14px', borderRadius: 6, background: '#1e1e1e',
              border: '1px solid #2a2a2a', fontSize: 13, color: '#aaa', cursor: 'pointer',
            }}>
              Last 30 days ▾
            </span>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: '#6366f1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff',
            }}>A</div>
          </div>
        </header>

        {/* Body */}
        <main style={{ padding: 32, flex: 1 }}>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
            {stats.map((s) => (
              <div key={s.label} style={{
                background: '#141414', border: '1px solid #222',
                borderRadius: 10, padding: '20px 24px',
              }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{s.value}</div>
                <div style={{ fontSize: 13, color: s.up ? '#34d399' : '#f87171' }}>{s.delta} vs last period</div>
              </div>
            ))}
          </div>

          {/* Chart placeholder */}
          <div style={{
            background: '#141414', border: '1px solid #222', borderRadius: 10,
            padding: '24px', marginBottom: 32, height: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ textAlign: 'center', color: '#444' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📈</div>
              <div style={{ fontSize: 14 }}>Revenue chart — placeholder</div>
            </div>
          </div>

          {/* Recent Activity */}
          <div style={{ background: '#141414', border: '1px solid #222', borderRadius: 10 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #222' }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>Recent Activity</h2>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e1e1e' }}>
                  {['Transaction', 'User', 'Action', 'Amount', 'Time'].map((h) => (
                    <th key={h} style={{
                      padding: '10px 24px', textAlign: 'left',
                      fontSize: 12, color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activity.map((row, i) => (
                  <tr key={row.id} style={{ borderBottom: i < activity.length - 1 ? '1px solid #1a1a1a' : 'none' }}>
                    <td style={{ padding: '14px 24px', fontSize: 13, color: '#6366f1', fontFamily: 'monospace' }}>{row.id}</td>
                    <td style={{ padding: '14px 24px', fontSize: 13, color: '#ccc' }}>{row.user}</td>
                    <td style={{ padding: '14px 24px', fontSize: 13, color: '#aaa' }}>{row.action}</td>
                    <td style={{ padding: '14px 24px', fontSize: 13, color: '#e5e5e5' }}>{row.amount}</td>
                    <td style={{ padding: '14px 24px', fontSize: 13, color: '#555' }}>{row.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* FloatDesk Support Widget */}
      <SupportWidget
        serverUrl="http://localhost:3003"
        signupUser={{ id: 'test-user-1', email: 'alice@acme.io', name: 'Alice' }}
        signupMessage="🎉 New signup: {name} ({email}) joined from {url}"
      />
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);

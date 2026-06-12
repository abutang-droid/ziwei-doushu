'use client';
import { useState, useRef, useEffect } from 'react';
import type { ZiweiChart } from '@/lib/ziwei/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  chart: ZiweiChart;
  mode?: 'single' | 'heming';
  chartData?: unknown;
}

const PRESET_QUESTIONS = [
  '我的整体命格如何？性格特点是什么？',
  '我的感情婚姻运势如何？',
  '我的事业财运如何？适合什么方向？',
  '我现在的大限运势如何？',
  '我的健康需要注意什么？',
  '今年的流年运势如何？',
];

export default function ChatPanel({ chart, mode = 'single', chartData }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    setApiError('');
    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          chartData: chartData ?? chart,
          mode,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || '请求失败，请稍后再试');
      }

      if (!res.body) throw new Error('无响应流');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.content ?? parsed.delta?.text ?? '';
              if (delta) {
                assistantText += delta;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: assistantText };
                  return updated;
                });
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'AI 服务暂时不可用';
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg-card)', borderRadius: 'var(--r-lg)',
      overflow: 'hidden', border: '1px solid var(--bdr)',
    }}>
      {/* 标题栏 */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bdr)', flexShrink: 0, background: 'var(--bg-0)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px', color: 'var(--gold)', opacity: 0.7 }}>✦</span>
          <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--tx-0)', letterSpacing: '0.1em' }}>AI 命盘解读</h3>
          <span style={{
            marginLeft: 'auto', fontSize: '10px', color: 'var(--gold)',
            background: 'var(--gold-pale)', border: '1px solid var(--gold-border)',
            borderRadius: 'var(--r-pill)', padding: '2px 8px', fontWeight: 600,
          }}>
            {mode === 'heming' ? '合盘解读' : '单人解读'}
          </span>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--tx-3)', marginTop: '3px' }}>OraSage · 东方命理 × 现代心理学</p>
      </div>

      {/* 消息列表 */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ fontSize: '32px', color: 'var(--gold)', opacity: 0.12, marginBottom: '12px' }}>✦</div>
            <p style={{ fontSize: '12px', color: 'var(--tx-3)', lineHeight: 1.8 }}>
              命盘已生成，可直接提问<br />或从下方选择常见问题开始解读
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={msg.role === 'user' ? {
              background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 100%)',
              color: '#FFFFFF', borderRadius: '12px 12px 4px 12px',
              padding: '10px 14px', fontSize: '13px', lineHeight: 1.6, maxWidth: '82%',
            } : {
              background: 'var(--bg-0)', border: '1px solid var(--bdr)',
              color: 'var(--tx-1)', borderRadius: '12px 12px 12px 4px',
              padding: '10px 14px', fontSize: '13px', lineHeight: 1.7, maxWidth: '92%',
            }}>
              {msg.role === 'assistant' && (
                <div style={{ fontSize: '10px', color: 'var(--gold)', marginBottom: '4px', fontWeight: 600 }}>命理师 ·</div>
              )}
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {msg.content}
                {loading && i === messages.length - 1 && msg.role === 'assistant' && (
                  <span style={{ display: 'inline-block', width: '6px', height: '14px', marginLeft: '2px', background: 'var(--gold)', opacity: 0.6, verticalAlign: 'middle' }} />
                )}
              </div>
            </div>
          </div>
        ))}
        {apiError && (
          <div style={{ padding: '10px 14px', background: 'rgba(168,50,40,0.06)', border: '1px solid rgba(168,50,40,0.2)', borderRadius: '8px', fontSize: '12px', color: '#c0392b', textAlign: 'center' }}>
            {apiError}
          </div>
        )}
      </div>

      {/* 预设问题 */}
      {messages.length === 0 && (
        <div style={{ padding: '0 12px 8px', flexShrink: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {PRESET_QUESTIONS.map((q, i) => (
              <button key={i} onClick={() => sendMessage(q)} disabled={loading}
                style={{ textAlign: 'left', fontSize: '11px', borderRadius: '8px', padding: '8px 10px', color: 'var(--tx-2)', border: '1px solid var(--bdr)', background: 'transparent', cursor: 'pointer', lineHeight: 1.5 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--gold)'; (e.currentTarget as HTMLElement).style.background = 'var(--gold-pale)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--bdr)'; (e.currentTarget as HTMLElement).style.color = 'var(--tx-2)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >{q}</button>
            ))}
          </div>
        </div>
      )}

      {/* 输入框 */}
      <div style={{ padding: '10px 12px 14px', borderTop: '1px solid var(--bdr)', flexShrink: 0, display: 'flex', gap: '8px' }}>
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
          placeholder="输入问题，如：我的感情运势如何？" disabled={loading}
          style={{ flex: 1, height: '40px', background: 'var(--bg-0)', border: '1.5px solid var(--bdr-med)', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: 'var(--tx-1)', outline: 'none' }}
          onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)'; }}
          onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--bdr-med)'; }}
        />
        <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
          style={{ height: '40px', padding: '0 16px', borderRadius: '8px', background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 100%)', color: '#FFFFFF', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer', opacity: loading || !input.trim() ? 0.45 : 1, whiteSpace: 'nowrap' }}
        >{loading ? '…' : '解读'}</button>
      </div>
    </div>
  );
}
